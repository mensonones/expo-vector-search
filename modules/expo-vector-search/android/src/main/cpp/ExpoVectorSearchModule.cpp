#include <jni.h>
#include <string>
#include <vector>
#include <memory>
#include <android/log.h>

#define TAG "ExpoVectorSearch"
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

// Include the correct USearch header (Dense Index)
// Polyfill for aligned_alloc on Android API < 28
#if defined(__ANDROID__) && __ANDROID_API__ < 28
#include <stdlib.h>
extern "C" void* aligned_alloc(size_t alignment, size_t size) {
    void* ptr = nullptr;
    if (posix_memalign(&ptr, alignment, size) != 0) {
        return nullptr;
    }
    return ptr;
}
#endif

#include <usearch/index_dense.hpp>

// JSI Headers
#include <jsi/jsi.h>

using namespace facebook;
using namespace unum::usearch;

// Helper function to get raw pointer from a Float32Array
// Returns {float_pointer, element_count}
std::pair<const float*, size_t> getRawVector(jsi::Runtime &runtime, const jsi::Value &val) {
    if (!val.isObject()) {
        throw jsi::JSError(runtime, "Invalid argument: Expected a Float32Array.");
    }
    jsi::Object obj = val.asObject(runtime);

    // Check if it has the 'buffer' property (indicates it's a TypedArray)
    if (!obj.hasProperty(runtime, "buffer")) {
        throw jsi::JSError(runtime, "Invalid argument: Object must have a 'buffer' (Float32Array).");
    }

    // Access the ArrayBuffer
    auto bufferValue = obj.getProperty(runtime, "buffer");
    if (!bufferValue.isObject() || !bufferValue.asObject(runtime).isArrayBuffer(runtime)) {
        throw jsi::JSError(runtime, "Internal failure: 'buffer' is not a valid ArrayBuffer.");
    }
    auto arrayBuffer = bufferValue.asObject(runtime).getArrayBuffer(runtime);

    // Google-grade Hardening: Buffer length validation
    if (arrayBuffer.size(runtime) == 0) {
        throw jsi::JSError(runtime, "Invalid argument: Float32Array is empty.");
    }

    // Read offset and length to support Views (sub-arrays)
    size_t byteOffset = 0;
    if (obj.hasProperty(runtime, "byteOffset")) {
        byteOffset = static_cast<size_t>(obj.getProperty(runtime, "byteOffset").asNumber());
    }
    
    size_t byteLength = arrayBuffer.size(runtime); // Default full size
    if (obj.hasProperty(runtime, "byteLength")) {
         byteLength = static_cast<size_t>(obj.getProperty(runtime, "byteLength").asNumber());
    }

    // ZERO-COPY access to the memory pointer
    uint8_t* rawBytes = arrayBuffer.data(runtime) + byteOffset;

    // Google-grade Hardening: Memory Alignment Check
    // Float32 needs 4-byte alignment. reinterpret_cast on unaligned memory is undefined behavior.
    if (reinterpret_cast<uintptr_t>(rawBytes) % sizeof(float) != 0) {
        throw jsi::JSError(runtime, "Memory Alignment Error: Float32Array buffer is not 4-byte aligned.");
    }
    
    // Cast to float*
    const float* floatPtr = reinterpret_cast<const float*>(rawBytes);
    size_t count = byteLength / sizeof(float);

    return {floatPtr, count};
}

// Helper to normalize and sanitize paths (strips file:// and prevents traversal)
std::string normalizePath(jsi::Runtime &runtime, std::string path) {
    // Strips file:// prefix if present
    if (path.compare(0, 7, "file://") == 0) {
        path = path.substr(7);
    }
    
    // Security Audit: Basic prevention of path traversal
    if (path.find("..") != std::string::npos) {
        throw jsi::JSError(runtime, "Security violation: Path traversal is not allowed.");
    }
    
    return path;
}

// Class that encapsulates a USearch index instance
class VectorIndex : public facebook::jsi::HostObject {
public:
    using Index = index_dense_t;

    VectorIndex(int dimensions, bool quantized) {
        metric_kind_t metric_kind = metric_kind_t::cos_k;
        scalar_kind_t scalar_kind = quantized ? scalar_kind_t::i8_k : scalar_kind_t::f32_k;
        metric_punned_t metric(dimensions, metric_kind, scalar_kind);
        
        _index = std::make_unique<Index>(Index::make(metric));
        if (!_index) throw std::runtime_error("Failed to initialize USearch index");
        
        if (!_index->reserve(100)) LOGE("Failed to reserve initial capacity");
    }

    // Expose methods to JavaScript
    jsi::Value get(jsi::Runtime& runtime, const jsi::PropNameID& name) override {
        std::string methodName = name.utf8(runtime);

        // dimensions
        if (methodName == "dimensions") {
            return jsi::Value((double)_index->dimensions());
        }
        
        // count
        if (methodName == "count") {
             if (!_index) return jsi::Value(0);
             return jsi::Value((double)_index->size());
        }

        // memoryUsage (bytes)
        if (methodName == "memoryUsage") {
             if (!_index) return jsi::Value(0);
             return jsi::Value((double)_index->memory_usage());
        }

        // delete() - Explicit Memory Release
        if (methodName == "delete") {
            return jsi::Function::createFromHostFunction(runtime, name, 0, 
                [this](jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* arguments, size_t count) -> jsi::Value {
                    _index.reset(); // Destroy the unique_ptr and release memory
                    return jsi::Value::undefined();
                });
        }

        // add(key: number, vector: Float32Array)
        if (methodName == "add") {
            return jsi::Function::createFromHostFunction(runtime, name, 2, 
                [this](jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* arguments, size_t count) -> jsi::Value {
                    if (count < 2) throw jsi::JSError(runtime, "add expects 2 arguments: key, vector");
                    if (!_index) throw jsi::JSError(runtime, "VectorIndex has been deleted.");
                    
                    double keyDouble = arguments[0].asNumber();
                    default_key_t key = static_cast<default_key_t>(keyDouble);
                    
                    auto [vecData, vecSize] = getRawVector(runtime, arguments[1]);
                    
                    if (vecSize != _index->dimensions()) {
                         throw jsi::JSError(runtime, "Incorrect dimension.");
                    }

                    if (_index->size() >= _index->capacity()) _index->reserve(_index->capacity() * 2);
                    auto result = _index->add(key, vecData);
                    if (!result) throw jsi::JSError(runtime, "Error adding: " + std::string(result.error.what()));
                    
                    return jsi::Value::undefined();
                });
        }

        // addBatch(keys: Int32Array, vectors: Float32Array)
        if (methodName == "addBatch") {
            return jsi::Function::createFromHostFunction(runtime, name, 2, 
                [this](jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* arguments, size_t count) -> jsi::Value {
                    if (count < 2) throw jsi::JSError(runtime, "addBatch expects 2 arguments: keys, vectors");
                    if (!_index) throw jsi::JSError(runtime, "VectorIndex has been deleted.");

                    // 1. Get Keys (Int32Array)
                    jsi::Object keysArray = arguments[0].asObject(runtime);
                    auto keysBufferValue = keysArray.getProperty(runtime, "buffer");
                    auto keysBuffer = keysBufferValue.asObject(runtime).getArrayBuffer(runtime);
                    
                    size_t keysByteOffset = keysArray.hasProperty(runtime, "byteOffset") ? 
                        (size_t)keysArray.getProperty(runtime, "byteOffset").asNumber() : 0;
                    size_t keysCount = (keysArray.hasProperty(runtime, "byteLength") ? 
                        (size_t)keysArray.getProperty(runtime, "byteLength").asNumber() : keysBuffer.size(runtime)) / sizeof(int32_t);
                    
                    const int32_t* keysData = reinterpret_cast<const int32_t*>(keysBuffer.data(runtime) + keysByteOffset);

                    // 2. Get Vectors (Float32Array)
                    auto [vecData, vecTotalElements] = getRawVector(runtime, arguments[1]);
                    size_t dims = _index->dimensions();
                    size_t batchCount = vecTotalElements / dims;

                    // 3. Validation
                    if (batchCount != keysCount) {
                        throw jsi::JSError(runtime, "Batch mismatch: keys and vectors must have compatible sizes.");
                    }

                    // 4. Optimization: Single Reserve
                    if (_index->size() + batchCount > _index->capacity()) {
                        _index->reserve(_index->size() + batchCount);
                    }

                    // 5. Bulk Add
                    for (size_t i = 0; i < batchCount; ++i) {
                        auto result = _index->add((default_key_t)keysData[i], vecData + (i * dims));
                        if (!result) throw jsi::JSError(runtime, "Error adding in batch at index " + std::to_string(i));
                    }

                    return jsi::Value::undefined();
                });
        }

        // search(vector: Float32Array, count: number)
        if (methodName == "search") {
            return jsi::Function::createFromHostFunction(runtime, name, 2, 
                [this](jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* arguments, size_t count) -> jsi::Value {
                    if (count < 2) throw jsi::JSError(runtime, "search expects 2 arguments: vector, count");
                    if (!_index) throw jsi::JSError(runtime, "VectorIndex has been deleted.");

                    auto [queryData, querySize] = getRawVector(runtime, arguments[0]);
                    int resultsCount = static_cast<int>(arguments[1].asNumber());

                    if (querySize != _index->dimensions()) {
                         throw jsi::JSError(runtime, "Query vector dimension mismatch.");
                    }

                    auto results = _index->search(queryData, resultsCount);
                    jsi::Array returnArray(runtime, results.size());
                    for (size_t i = 0; i < results.size(); ++i) {
                        auto pair = results[i];
                        jsi::Object resultObj(runtime);
                        resultObj.setProperty(runtime, "key", static_cast<double>(pair.member.key));
                        resultObj.setProperty(runtime, "distance", static_cast<double>(pair.distance));
                        returnArray.setValueAtIndex(runtime, i, resultObj);
                    }
                    return returnArray;
                });
        }

        // save(path: string)
        if (methodName == "save") {
            return jsi::Function::createFromHostFunction(runtime, name, 1, 
                [this](jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* arguments, size_t count) -> jsi::Value {
                    if (count < 1 || !arguments[0].isString()) throw jsi::JSError(runtime, "save expects path");
                    std::string path = normalizePath(runtime, arguments[0].asString(runtime).utf8(runtime));
                    
                    if (!_index->save(path.c_str())) throw jsi::JSError(runtime, "Critical error saving index to disk: " + path);
                    return jsi::Value::undefined();
                });
        }

        // load(path: string)
        if (methodName == "load") {
            return jsi::Function::createFromHostFunction(runtime, name, 1, 
                [this](jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* arguments, size_t count) -> jsi::Value {
                    if (count < 1 || !arguments[0].isString()) throw jsi::JSError(runtime, "load expects path");
                    std::string path = normalizePath(runtime, arguments[0].asString(runtime).utf8(runtime));
                    
                    if (!_index->load(path.c_str())) throw jsi::JSError(runtime, "Critical error loading index from disk: " + path);
                    return jsi::Value::undefined();
                });
        }

        return jsi::Value::undefined();
    }

private:
    std::unique_ptr<Index> _index;
};

// --------------------------------------------------------------------------
// Module Installation (Factory)
// --------------------------------------------------------------------------

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_vectorsearch_ExpoVectorSearchModule_nativeInstall(JNIEnv* env, jobject thiz, jlong jsiPtr) {
    auto runtime = reinterpret_cast<jsi::Runtime*>(jsiPtr);
    if (!runtime) return;
    auto &rt = *runtime;

    auto global = rt.global();
    auto moduleObj = jsi::Object(rt);

    // ExpoVectorSearch.createIndex(dimensions: number, options?: { quantization: 'f32' | 'i8' }) -> VectorIndex
    moduleObj.setProperty(rt, "createIndex", jsi::Function::createFromHostFunction(rt, jsi::PropNameID::forAscii(rt, "createIndex"), 1, 
        [](jsi::Runtime &rt, const jsi::Value &thisValue, const jsi::Value *args, size_t count) -> jsi::Value {
            if (count < 1 || !args[0].isNumber()) {
                throw jsi::JSError(rt, "createIndex expects at least 1 argument: dimensions");
            }
            int dims = static_cast<int>(args[0].asNumber());
            
            bool quantized = false;
            if (count > 1 && args[1].isObject()) {
                jsi::Object options = args[1].asObject(rt);
                if (options.hasProperty(rt, "quantization")) {
                    std::string q = options.getProperty(rt, "quantization").asString(rt).utf8(rt);
                    if (q == "i8") quantized = true;
                }
            }
            
            auto indexInstance = std::make_shared<VectorIndex>(dims, quantized);
            return jsi::Object::createFromHostObject(rt, indexInstance);
        }));

    global.setProperty(rt, "ExpoVectorSearch", moduleObj);
}