#pragma once

#ifdef __cplusplus
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <jsi/jsi.h>
#include <memory>
#include <string>
#include <thread>
#include <unordered_set>
#include <vector>

// ... (keep existing includes)

// ...

// Cross-platform logging
#if defined(__ANDROID__)
#include <android/log.h>
#define TAG "ExpoVectorSearch"
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)
#else
#include <iostream>
#define LOGD(...)                                                              \
  fprintf(stderr, "[ExpoVectorSearch] " __VA_ARGS__);                          \
  fprintf(stderr, "\n")
#define LOGE(...)                                                              \
  fprintf(stderr, "[ExpoVectorSearch] ERROR: " __VA_ARGS__);                   \
  fprintf(stderr, "\n")
#endif

// Polyfill for aligned_alloc on Android API < 28
#if defined(__ANDROID__) && __ANDROID_API__ < 28
#include <stdlib.h>
extern "C" void *aligned_alloc(size_t alignment, size_t size) {
  void *ptr = nullptr;
  if (posix_memalign(&ptr, alignment, size) != 0) {
    return nullptr;
  }
  return ptr;
}
#endif

#include "usearch/index_dense.hpp"

using namespace facebook;
using namespace unum::usearch;

namespace expo {
namespace vectorsearch {

// Helper function to get raw pointer from a Float32Array
inline std::pair<const float *, size_t> getRawVector(jsi::Runtime &runtime,
                                                     const jsi::Value &val) {
  if (!val.isObject()) {
    throw jsi::JSError(runtime, "Invalid argument: Expected a Float32Array.");
  }
  jsi::Object obj = val.asObject(runtime);

  if (!obj.hasProperty(runtime, "buffer")) {
    throw jsi::JSError(
        runtime,
        "Invalid argument: Object must have a 'buffer' (Float32Array).");
  }

  auto bufferValue = obj.getProperty(runtime, "buffer");
  if (!bufferValue.isObject() ||
      !bufferValue.asObject(runtime).isArrayBuffer(runtime)) {
    throw jsi::JSError(
        runtime, "Internal failure: 'buffer' is not a valid ArrayBuffer.");
  }
  auto arrayBuffer = bufferValue.asObject(runtime).getArrayBuffer(runtime);

  if (arrayBuffer.size(runtime) == 0) {
    throw jsi::JSError(runtime, "Invalid argument: Float32Array is empty.");
  }

  size_t byteOffset =
      obj.hasProperty(runtime, "byteOffset")
          ? static_cast<size_t>(
                obj.getProperty(runtime, "byteOffset").asNumber())
          : 0;

  size_t byteLength =
      obj.hasProperty(runtime, "byteLength")
          ? static_cast<size_t>(
                obj.getProperty(runtime, "byteLength").asNumber())
          : arrayBuffer.size(runtime);

  uint8_t *rawBytes = arrayBuffer.data(runtime) + byteOffset;

  if (reinterpret_cast<uintptr_t>(rawBytes) % sizeof(float) != 0) {
    throw jsi::JSError(
        runtime,
        "Memory Alignment Error: Float32Array buffer is not 4-byte aligned.");
  }

  const float *floatPtr = reinterpret_cast<const float *>(rawBytes);
  size_t count = byteLength / sizeof(float);

  return {floatPtr, count};
}

inline std::string normalizePath(jsi::Runtime &runtime, std::string path) {
  if (path.compare(0, 7, "file://") == 0) {
    path = path.substr(7);
  }
  if (path.find("..") != std::string::npos) {
    throw jsi::JSError(runtime,
                       "Security violation: Path traversal is not allowed.");
  }
  return path;
}

// Custom Jaccard metric for float vectors (treats values > 0.5 as 1, else 0)
// This is used because USearch default Jaccard is bitset-oriented.
inline float jaccard_f32(const float *a, const float *b, std::size_t n,
                         std::size_t) {
  float intersection = 0;
  float union_count = 0;

  for (std::size_t i = 0; i < n; ++i) {
    bool in_a = a[i] > 0.5f;
    bool in_b = b[i] > 0.5f;
    if (in_a && in_b)
      intersection += 1.0f;
    if (in_a || in_b)
      union_count += 1.0f;
  }

  if (union_count == 0)
    return 0.0f;
  return 1.0f - (intersection / union_count);
}

class VectorIndexHostObject : public jsi::HostObject {
public:
  using Index = index_dense_t;

  size_t _threads;

  VectorIndexHostObject(int dimensions, bool quantized,
                        metric_kind_t metric_kind = metric_kind_t::cos_k) {
    _threads = std::thread::hardware_concurrency();
    if (_threads == 0)
      _threads = 1;

    scalar_kind_t scalar_kind =
        quantized ? scalar_kind_t::i8_k : scalar_kind_t::f32_k;

    // Special case: Jaccard with f32 (not bitsets)
    if (metric_kind == metric_kind_t::jaccard_k && !quantized) {
      metric_punned_t metric(dimensions,
                             reinterpret_cast<std::uintptr_t>(&jaccard_f32),
                             metric_punned_signature_t::array_array_size_k,
                             metric_kind_t::jaccard_k, scalar_kind_t::f32_k);
      _index = std::make_unique<Index>(Index::make(metric));
    } else {
      metric_punned_t metric(dimensions, metric_kind, scalar_kind);
      _index = std::make_unique<Index>(Index::make(metric));
    }

    LOGD("Initializing Index HostObject: dims=%d, quantized=%d, metric=%d",
         dimensions, (int)quantized, (int)metric_kind);
    if (!_index) {
      LOGD("Index creation failed early!");
      throw std::runtime_error("Failed to initialize USearch index");
    }
    LOGD("Index created successfully. Cap=%zu", _index->capacity());

    LOGD("Reserving index: threads=%zu", _threads);
    if (!_index->reserve(index_limits_t(100, _threads))) {
      LOGE("Failed to reserve initial capacity");
    }
    LOGD("Initial reserve done. Index cap=%zu, size=%zu, threads=%zu",
         _index->capacity(), _index->size(), _index->limits().threads());
  }

  jsi::Value get(jsi::Runtime &runtime, const jsi::PropNameID &name) override {
    std::string methodName = name.utf8(runtime);

    if (methodName == "dimensions")
      return jsi::Value((double)_index->dimensions());
    if (methodName == "count")
      return jsi::Value(_index ? (double)_index->size() : 0);
    if (methodName == "memoryUsage")
      return jsi::Value(_index ? (double)_index->memory_usage() : 0);
    if (methodName == "isa") {
      const char *isa = _index ? _index->metric().isa_name() : "unknown";
      LOGD("isa property accessed: %s", isa);
      return jsi::String::createFromUtf8(runtime, isa);
    }

    if (methodName == "delete") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 0,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            _index.reset();
            return jsi::Value::undefined();
          });
    }

    if (methodName == "add") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 2,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            if (count < 2)
              throw jsi::JSError(runtime,
                                 "add expects 2 arguments: key, vector");
            if (!_index)
              throw jsi::JSError(runtime, "VectorIndex has been deleted.");

            default_key_t key =
                static_cast<default_key_t>(arguments[0].asNumber());
            auto [vecData, vecSize] = getRawVector(runtime, arguments[1]);

            // LOGD("add called: key=%llu, vecSize=%zu, capacity=%zu",
            //      (unsigned long long)key, vecSize, _index->capacity());

            if (vecSize != _index->dimensions()) {
              LOGE("Dimension mismatch: expected %zu, got %zu",
                   _index->dimensions(), vecSize);
              throw jsi::JSError(runtime, "Incorrect dimension.");
            }

            if (_index->size() >= _index->capacity()) {
              size_t newCapacity = _index->capacity() * 2;
              if (newCapacity == 0)
                newCapacity = 100;
              LOGD("Resizing index to: %zu", newCapacity);
              _index->reserve(index_limits_t(newCapacity, _threads));
            }
            LOGD("Attempting to add: key=%llu, ptr=%p, dim=%zu",
                 (unsigned long long)key, vecData, _index->dimensions());
            auto result = _index->add(key, vecData);
            LOGD("Add completed: key=%llu", (unsigned long long)key);
            if (!result) {
              LOGE("Failed to add vector: %s", result.error.what());
              throw jsi::JSError(runtime, "Error adding: " +
                                              std::string(result.error.what()));
            }

            return jsi::Value::undefined();
          });
    }

    if (methodName == "addBatch") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 2,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            LOGD("addBatch called");
            if (count < 2)
              throw jsi::JSError(runtime,
                                 "addBatch expects 2 arguments: keys, vectors");
            if (!_index)
              throw jsi::JSError(runtime, "VectorIndex has been deleted.");

            jsi::Object keysArray = arguments[0].asObject(runtime);
            auto keysBuffer = keysArray.getProperty(runtime, "buffer")
                                  .asObject(runtime)
                                  .getArrayBuffer(runtime);
            size_t keysByteOffset =
                keysArray.hasProperty(runtime, "byteOffset")
                    ? (size_t)keysArray.getProperty(runtime, "byteOffset")
                          .asNumber()
                    : 0;
            size_t keysCount =
                (keysArray.hasProperty(runtime, "byteLength")
                     ? (size_t)keysArray.getProperty(runtime, "byteLength")
                           .asNumber()
                     : keysBuffer.size(runtime)) /
                sizeof(int32_t);
            const int32_t *keysData = reinterpret_cast<const int32_t *>(
                keysBuffer.data(runtime) + keysByteOffset);

            auto [vecData, vecTotalElements] =
                getRawVector(runtime, arguments[1]);
            size_t dims = _index->dimensions();
            size_t batchCount = vecTotalElements / dims;

            LOGD("addBatch processing: keysCount=%zu, batchCount=%zu, "
                 "dims=%zu",
                 keysCount, batchCount, dims);

            if (batchCount != keysCount)
              throw jsi::JSError(runtime, "Batch mismatch: keys and vectors "
                                          "must have compatible sizes.");

            if (_index->size() + batchCount > _index->capacity()) {
              size_t newCapacity = _index->capacity() + batchCount;
              // Double it if small to avoid frequent realloc
              if (newCapacity < _index->capacity() * 2)
                newCapacity = _index->capacity() * 2;
              if (newCapacity < _index->size() + batchCount)
                newCapacity = _index->size() + batchCount + 100;

              LOGD("Resizing index for batch to: %zu", newCapacity);
              _index->reserve(index_limits_t(newCapacity, _threads));
            }

            for (size_t i = 0; i < batchCount; ++i) {
              auto result =
                  _index->add((default_key_t)keysData[i], vecData + (i * dims));
              if (!result) {
                LOGE("Error adding in batch at index %zu: %s", i,
                     result.error.what());
                throw jsi::JSError(runtime, "Error adding in batch at index " +
                                                std::to_string(i));
              }
            }
            LOGD("addBatch completed successfully");
            return jsi::Value::undefined();
          });
    }

    if (methodName == "remove") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 1,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            if (count < 1)
              throw jsi::JSError(runtime, "remove expects 1 argument: key");
            if (!_index)
              throw jsi::JSError(runtime, "VectorIndex has been deleted.");

            default_key_t key =
                static_cast<default_key_t>(arguments[0].asNumber());

            auto result = _index->remove(key);
            if (!result) {
              LOGE("Failed to remove vector: %s", result.error.what());
              throw jsi::JSError(runtime, "Error removing: " +
                                              std::string(result.error.what()));
            }

            return jsi::Value::undefined();
          });
    }

    if (methodName == "update") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 2,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            if (count < 2)
              throw jsi::JSError(runtime,
                                 "update expects 2 arguments: key, vector");
            if (!_index)
              throw jsi::JSError(runtime, "VectorIndex has been deleted.");

            default_key_t key =
                static_cast<default_key_t>(arguments[0].asNumber());
            auto [vecData, vecSize] = getRawVector(runtime, arguments[1]);

            if (vecSize != _index->dimensions()) {
              throw jsi::JSError(runtime, "Incorrect dimension for update.");
            }

            // Remove existing if it exists (USearch remove is safe if key
            // doesn't exist? Usually returns error, but we want to ensure we
            // can 'upsert')
            _index->remove(key);

            auto result = _index->add(key, vecData);
            if (!result) {
              LOGE("Failed to update vector: %s", result.error.what());
              throw jsi::JSError(runtime, "Error updating: " +
                                              std::string(result.error.what()));
            }

            return jsi::Value::undefined();
          });
    }

    if (methodName == "search") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 2,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            if (count < 2)
              throw jsi::JSError(runtime,
                                 "search expects 2 arguments: vector, count");
            if (!_index)
              throw jsi::JSError(runtime, "VectorIndex has been deleted.");

            LOGD("search: starting...");
            auto [queryData, querySize] = getRawVector(runtime, arguments[0]);
            int resultsCount = static_cast<int>(arguments[1].asNumber());
            LOGD("search: querySize=%zu, count=%d", querySize, resultsCount);

            bool hasFilter = false;
            std::unordered_set<default_key_t> allowedSet;

            if (count > 2 && arguments[2].isObject()) {
              jsi::Object options = arguments[2].asObject(runtime);
              if (options.hasProperty(runtime, "allowedKeys")) {
                jsi::Value keysValue =
                    options.getProperty(runtime, "allowedKeys");
                if (keysValue.isObject() &&
                    keysValue.asObject(runtime).isArray(runtime)) {
                  jsi::Array keysArray =
                      keysValue.asObject(runtime).asArray(runtime);
                  size_t size = keysArray.size(runtime);
                  allowedSet.reserve(size);
                  for (size_t i = 0; i < size; ++i) {
                    allowedSet.insert(static_cast<default_key_t>(
                        keysArray.getValueAtIndex(runtime, i).asNumber()));
                  }
                  hasFilter = true;
                }
              }
            }

            if (querySize != _index->dimensions()) {
              LOGE("Search dimension mismatch: expected %zu, got %zu",
                   _index->dimensions(), querySize);
              throw jsi::JSError(runtime, "Query vector dimension mismatch.");
            }

            Index::search_result_t results;
            if (hasFilter) {
              results = _index->search_filtered(
                  (f32_t *)queryData, resultsCount,
                  [&](Index::member_cref_t const &member) noexcept {
                    return allowedSet.count(member.key) > 0;
                  });
            } else {
              results = _index->search(queryData, resultsCount);
            }

            jsi::Array returnArray(runtime, results.size());
            for (size_t i = 0; i < results.size(); ++i) {
              auto pair = results[i];
              jsi::Object resultObj(runtime);
              resultObj.setProperty(runtime, "key",
                                    static_cast<double>(pair.member.key));
              resultObj.setProperty(runtime, "distance",
                                    static_cast<double>(pair.distance));
              returnArray.setValueAtIndex(runtime, i, resultObj);
            }
            return returnArray;
          });
    }

    if (methodName == "getItemVector") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 1,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            if (count < 1 || !arguments[0].isNumber())
              throw jsi::JSError(runtime, "getItemVector expects key (number)");

            default_key_t key =
                static_cast<default_key_t>(arguments[0].asNumber());
            size_t dims = _index->dimensions();

            jsi::ArrayBuffer buffer =
                runtime.global()
                    .getPropertyAsFunction(runtime, "ArrayBuffer")
                    .callAsConstructor(runtime, (double)(dims * sizeof(float)))
                    .getObject(runtime)
                    .getArrayBuffer(runtime);

            // We need raw access to write to it
            // JSI ArrayBuffer doesn't give direct mutable pointer easily
            // without a TypedArray view? Actually getArrayBuffer ->
            // data(runtime) gives pointer.

            uint8_t *data = buffer.data(runtime);
            float *vecData = reinterpret_cast<float *>(data);

            // USearch get() signature: bool get(key_t key, scalar_t* vector)
            // const
            bool found = _index->get(key, vecData);

            if (!found) {
              return jsi::Value::undefined();
            }

            // Return Float32Array view
            // Float32Array constructor: new Float32Array(buffer)
            jsi::Object float32ArrayCtor =
                runtime.global().getPropertyAsObject(runtime, "Float32Array");
            jsi::Object float32Array = float32ArrayCtor.asFunction(runtime)
                                           .callAsConstructor(runtime, buffer)
                                           .asObject(runtime);

            return float32Array;
          });
    }

    if (methodName == "save") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 1,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            if (count < 1 || !arguments[0].isString())
              throw jsi::JSError(runtime, "save expects path");
            std::string path = normalizePath(
                runtime, arguments[0].asString(runtime).utf8(runtime));
            if (!_index->save(path.c_str()))
              throw jsi::JSError(
                  runtime, "Critical error saving index to disk: " + path);
            return jsi::Value::undefined();
          });
    }

    if (methodName == "loadVectorsFromFile") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 1,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            if (count < 1 || !arguments[0].isString())
              throw jsi::JSError(runtime, "loadVectorsFromFile expects path");
            std::string path = normalizePath(
                runtime, arguments[0].asString(runtime).utf8(runtime));

            std::ifstream file(path, std::ios::binary | std::ios::ate);
            if (!file)
              throw jsi::JSError(runtime, "Could not open file: " + path);

            std::streamsize size = file.tellg();
            file.seekg(0, std::ios::beg);

            if (size <= 0)
              return jsi::Value::undefined();

            size_t dims = _index->dimensions();
            if (size % (dims * sizeof(float)) != 0) {
              throw jsi::JSError(runtime,
                                 "File size is not multiple of dimension");
            }

            size_t numVectors = size / (dims * sizeof(float));
            std::vector<char> buffer(size);
            if (!file.read(buffer.data(), size))
              throw jsi::JSError(runtime, "Failed to read file");

            const float *vectorData =
                reinterpret_cast<const float *>(buffer.data());

            // Reserve capacity
            if (_index->size() + numVectors > _index->capacity()) {
              size_t newCap = _index->size() + numVectors + 100;
              LOGD("Resizing index for large binary load: %zu", newCap);
              _index->reserve(newCap);
            }

            // Batch insert assuming keys 0..N
            for (size_t i = 0; i < numVectors; ++i) {
              _index->add((default_key_t)i, vectorData + (i * dims));
            }

            LOGD("Appended %zu vectors from file", numVectors);
            return jsi::Value((double)numVectors);
          });
    }

    if (methodName == "load") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 1,
          [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
                 const jsi::Value *arguments, size_t count) -> jsi::Value {
            if (count < 1 || !arguments[0].isString())
              throw jsi::JSError(runtime, "load expects path");
            std::string path = normalizePath(
                runtime, arguments[0].asString(runtime).utf8(runtime));
            if (!_index->load(path.c_str()))
              throw jsi::JSError(
                  runtime, "Critical error loading index from disk: " + path);
            return jsi::Value::undefined();
          });
    }

    return jsi::Value::undefined();
  }

private:
  std::unique_ptr<Index> _index;
};

inline void install(jsi::Runtime &rt) {
  auto moduleObj = jsi::Object(rt);

  moduleObj.setProperty(
      rt, "createIndex",
      jsi::Function::createFromHostFunction(
          rt, jsi::PropNameID::forAscii(rt, "createIndex"), 1,
          [](jsi::Runtime &rt, const jsi::Value &thisValue,
             const jsi::Value *args, size_t count) -> jsi::Value {
            if (count < 1 || !args[0].isNumber())
              throw jsi::JSError(
                  rt, "createIndex expects at least 1 argument: dimensions");
            int dims = static_cast<int>(args[0].asNumber());

            bool quantized = false;
            metric_kind_t metric_kind = metric_kind_t::cos_k;

            if (count > 1 && args[1].isObject()) {
              jsi::Object options = args[1].asObject(rt);
              if (options.hasProperty(rt, "quantization")) {
                std::string q = options.getProperty(rt, "quantization")
                                    .asString(rt)
                                    .utf8(rt);
                if (q == "i8")
                  quantized = true;
              }
              if (options.hasProperty(rt, "metric")) {
                std::string m =
                    options.getProperty(rt, "metric").asString(rt).utf8(rt);
                if (m == "l2sq")
                  metric_kind = metric_kind_t::l2sq_k;
                else if (m == "ip")
                  metric_kind = metric_kind_t::ip_k;
                else if (m == "hamming")
                  metric_kind = metric_kind_t::hamming_k;
                else if (m == "jaccard")
                  metric_kind = metric_kind_t::jaccard_k;
              }
            }

            auto indexInstance = std::make_shared<VectorIndexHostObject>(
                dims, quantized, metric_kind);
            return jsi::Object::createFromHostObject(rt, indexInstance);
          }));

  rt.global().setProperty(rt, "ExpoVectorSearch", moduleObj);
}

} // namespace vectorsearch
} // namespace expo

#endif
