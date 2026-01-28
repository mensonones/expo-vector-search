# expo-vector-search

`expo-vector-search` is a high-performance, on-device **vector search engine** module for Expo and React Native.

> [!NOTE]
> This module is **cross-platform** (Android & iOS). The C++ JSI core and build configurations have been validated on production devices (Galaxy S23 FE and iPhone 12).

## Performance (Release Benchmarks)

Benchmark results obtained using **Release builds** on physical devices (1,000 vectors, 128 dimensions for search/ingestion; 10,000 vectors, 384 dimensions for memory optimization).

### JS vs. Native Engine Race
| Platform | JavaScript (Runtime Loop) | Expo Vector Search (Native) | Speedup |
| :--- | :--- | :--- | :--- |
| **Android** (S23 FE) | 6.20 ms | 0.15 ms | **~41x** |
| **iOS** (iPhone 12) | 12.06 ms | 0.10 ms | **~120x** |

### Bulk Ingestion (1,000 items)
| Platform | Individual `.add` | Batch `.addBatch` |
| :--- | :--- | :--- |
| **Android** (S23 FE) | 79.87 ms | 76.70 ms |
| **iOS** (iPhone 12) | 107.94 ms | 102.59 ms |

### Memory Optimization (10,000 items, 384 dims)
| Platform | Full Precision (F32) | Quantized (Int8) | Savings |
| :--- | :--- | :--- | :--- |
| **Android** (S23 FE) | 36,943.84 KB | 20,559.84 KB | **~44%** |
| **iOS** (iPhone 12) | 36,943.97 KB | 20,559.97 KB | **~44%** |

## Key Features

- **Blazing Fast Performance**: Powered by the HNSW (Hierarchical Navigable Small World) algorithm, capable of sub-millisecond search latencies on modern mobile hardware.
- **Direct JSI Integration**: Uses direct memory access between the JavaScript engine and C++ layer, eliminating serialization overhead.
- **Production-Grade Quantization**: Support for Int8 quantization to reduce memory footprint by up to 4x with minimal impact on search accuracy.
- **Disk Persistence**: Built-in methods to save and load vector indices to/from the local file system.
- **Memory Safety**: Strict buffer alignment checks and type validation to ensure native stability.
- **Explicit Memory Management**: Provision for deterministic resource release via the `delete()` method.

## Installation

This module contains custom native code (C++/JSI). **It does not work in [Expo Go](https://expo.dev/go).** You must generate and build the native project.

### 1. Install the package
```bash
npx expo install expo-vector-search
```

### 2. Generate Native Folders
To access the `ios` and `android` directories and include the C++ engine, run:
```bash
npx expo prebuild
```
> [!NOTE]
> This command generates the native projects based on your `app.json`. If you already have `ios` and `android` folders (Bare Workflow), you can skip this step.

### 3. Build and Run
You must compile the native code to use the module. Use the following commands to build and launch the app:
```bash
npx expo run:android
# or
npx expo run:ios
```

---

### Compatibility

| Environment | Supported | Requirement |
| :--- | :--- | :--- |
| **Expo Go** | ❌ No | Requires custom native engine |
| **Bare Workflow** | ✅ Yes | Standard `ios`/`android` folders |

## Architecture

The module is designed for performance-critical applications where latency and battery efficiency are paramount.

- **Engine**: [USearch](https://github.com/unum-cloud/usearch) (unum-cloud).
- **Bindings**: Custom JSI `HostObject` implementation for low-overhead synchronous execution.
- **Memory**: Direct data sharing via `ArrayBuffer` and raw pointers, avoiding the JSON serialization bottleneck of the legacy bridge.
- **Threading**: Native operations run on the JS thread for zero-copy efficiency.

## API Reference

### VectorIndex

The primary class for managing a vector collection.

#### `constructor(dimensions: number, options?: VectorIndexOptions)`
Initializes a new vector index.
- `dimensions`: The dimensionality of the vectors (e.g., 128, 384, 768).
- `options.quantization`: Scaling mode (`'f32'` or `'i8'`). Use `'i8'` for significant memory savings.

#### `add(key: number, vector: Float32Array): void`
Inserts a vector into the index.
- `key`: A unique numeric identifier.
- `vector`: A `Float32Array` containing the embeddings.

#### `addBatch(keys: Int32Array, vectors: Float32Array): void`
High-performance batch insertion. Significantly reduces JSI overhead by processing multiple vectors in a single native call.
- `keys`: An `Int32Array` of unique identifiers.
- `vectors`: A single `Float32Array` containing all vectors concatenated (must match `keys.length * dimensions`).

#### `search(vector: Float32Array, count: number): SearchResult[]`
Performs an ANN search.
- `vector`: The query embedding.
- `count`: Number of nearest neighbors to retrieve.
- **Returns**: An array of `SearchResult` objects `{ key: number, distance: number }`.

#### `save(path: string): void`
Serializes the current state of the index to a specified file path.

#### `load(path: string): void`
Deserializes an index from a file path.

#### `delete(): void`
Manually releases native memory resources. The index instance becomes unusable after this call.

#### `loadVectorsFromFile(path: string): number`
Loads raw vectors directly from a binary file into the index.
- `path`: Absolute path to the binary file containing packed floats.
- **Returns**: The number of vectors successfully loaded.
- **Note**: This is significantly faster than parsing JSON/Base64 in JavaScript and adding vectors loop by loop.

#### `getItemVector(key: number): Float32Array | undefined`
Retrieves the vector associated with a specific key.
- `key`: The unique numeric identifier.
- **Returns**: A `Float32Array` copy of the vector, or `undefined` if the key does not exist.
- **Use Case**: Allows you to store vectors ONLY in native memory (saving JS RAM) and fetch them only when needed (e.g., for "Find Similar" queries).

#### `dimensions: number` (readonly)
Returns the dimensionality of the index.

#### `count: number` (readonly)
Returns the number of vectors currently indexed.

#### `memoryUsage: number` (readonly)
Returns the estimated memory usage of the native index in bytes.

## Example Usage

```typescript
import { VectorIndex } from 'expo-vector-search';

// Initialize a 384-dimension index with Int8 quantization
const index = new VectorIndex(384, { quantization: 'i8' });

// Add a vector
const myVector = new Float32Array(384).fill(0.5);
index.add(1, myVector);

// Search
const query = new Float32Array(384).fill(0.48);
const results = index.search(query, 5);

// High-Performance Batch Insertion
const manyKeys = new Int32Array([10, 11, 12]);
const manyVectors = new Float32Array(384 * 3).fill(0.1);
index.addBatch(manyKeys, manyVectors);

console.log(`Found ${results.length} neighbors`);
results.forEach(res => {
  console.log(`Key: ${res.key}, Distance: ${res.distance}`);
});

// Explicit cleanup when done
index.delete();
```

## Best Practices

### Memory Management
While the JavaScript garbage collector handles the wrapper object, the native memory associated with large indices can be significant. It is recommended to call `index.delete()` when an index is no longer needed (e.g., in a component's cleanup effect).

### Persistence
When using `save()` and `load()`, ensure the provided paths are within the application's sandbox (e.g., `expo-file-system` document directory). The module includes path sanitization to prevent directory traversal.

## Security
This module performs strict validation on input buffers.
- **Alignment**: `Float32Array` buffers must be 4-byte aligned for safe native access.
- **Type Safety**: Input vectors are validated against the index's defined dimensions to prevent out-of-bounds memory operations.

## Known Limitations & Roadmap

### Performance Considerations (F32 vs Int8)
While **Int8 Quantization** provides significant memory savings (~44% total index reduction and ~75% raw vector reduction), it currently involves a computational overhead during the ingestion process on Android:
- **Full Precision (F32)**: ~9,284 ms per 10k vectors (Standard).
- **Quantized (Int8)**: ~34,608 ms per 10k vectors (Slower due to real-time conversion).

This performance gap is a known characteristic of the current version. The Int8 path requires a conversion from `float` to `int8` for every dimension, which is not yet fully vectorized in the Android build.

### Future Roadmap
- [ ] **Dynamic CRUD**: Implement `remove(key)` and `update(key, vector)` in the JSI layer.
- [ ] **Metadata Filtering**: Support for predicates during ANN search (filters).
- [ ] **Architecture-Specific SIMD**: Enable NEON/SVE optimizations for Android builds.
- [ ] **Hybrid Search**: Integration with a keywords-based engine for hybrid results.
- [ ] **Background Indexing**: True multithreaded ingestion to avoid JS bridge/thread locks.
- [ ] **Extended Distance Metrics**: Support for L2, IP, and other USearch-native metrics.
- [ ] **USearch Upgrade**: Migration to `v2.23.0+` for enhanced performance.
- [ ] **Incremental Persistence**: Local storage optimizations for large datasets.

## License
MIT
