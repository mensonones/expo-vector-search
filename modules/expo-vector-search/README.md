# expo-vector-search

`expo-vector-search` is a high-performance, on-device **vector search engine** module for Expo and React Native.

> [!NOTE]
> This module is **cross-platform** (Android & iOS). The C++ JSI core and build configurations have been validated on production devices (Galaxy S23 FE and iPhone 12).

## Performance (Release Benchmarks)

Benchmark results obtained using **Release builds** on physical devices (1,000 vectors, 128 dimensions for search/ingestion; 10,000 vectors, 384 dimensions for memory optimization).

### JS vs. Native Engine Race
| Platform | JavaScript | Native (Base C++) | Native (SIMD/NEON) | Speedup |
| :--- | :--- | :--- | :--- | :--- |
| **Android** (S23 FE) | 7.08 ms | 0.15 ms | **0.09 ms** | **~78x** |
| **iOS** (iPhone 12) | 13.21 ms | 0.10 ms | **0.06 ms** | **~220x** |

### Bulk Ingestion (1,000 items)
| Platform | Method | Base C++ (v0.2.0) | SIMD/NEON (v0.4.0) | Improvement |
| :--- | :--- | :--- | :--- | :--- |
| **Android** (S23 FE) | Batch `.addBatch` | 76.70 ms | **81.35 ms** | **Zero-Copy + Proxy** |
| **iOS** (iPhone 12) | Batch `.addBatch` | 102.59 ms | **73.14 ms** | **NEON + Proxy** |

### Memory & Indexing Performance (10,000 items, 384d)
| Platform | Feature | Base C++ (v0.2.0) | SIMD/NEON (v0.4.0) | Improvement |
| :--- | :--- | :--- | :--- | :--- |
| **Android** (S23 FE) | F32 Indexing | ~9.284 ms | 10.591 ms | Proxy Overhead |
| **Android** (S23 FE) | Int8 Indexing | ~34.608 ms | **3.509 ms** | **~10x Faster** |
| **iOS** (iPhone 12) | F32 Indexing | ~9.200 ms | **8.803 ms** | **Fastest** |
| **iOS** (iPhone 12) | Int8 Indexing | ~34.000 ms | **1.867 ms** | **~18x Faster** |

## Key Features

- **Blazing Fast Performance**: Powered by the HNSW (Hierarchical Navigable Small World) algorithm, capable of sub-millisecond search latencies on modern mobile hardware.
- **Direct JSI Integration**: Uses direct memory access between the JavaScript engine and C++ layer, eliminating serialization overhead.
- **Production-Grade Quantization**: Support for Int8 quantization to reduce memory footprint by up to 4x with minimal impact on search accuracy.
- **Disk Persistence**: Built-in methods to save and load vector indices to/from the local file system.
- **Memory Safety**: Strict buffer alignment checks and type validation to ensure native stability.
- **Extended Distance Metrics**: Support for Cosine, Euclidean (L2), Inner Product, Hamming (binary), and Jaccard distances.
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

### useVectorSearch (React Hook)

A wrapper hook that manages the lifecycle of a `VectorIndex`, handling creation and cleanup automatically.

```typescript
const { index, search, add } = useVectorSearch(384, {
  quantization: 'i8',
  metric: 'cos'
});
```

### VectorIndex

The primary class for managing a vector collection.

#### `constructor(dimensions: number, options?: VectorIndexOptions)`
Initializes a new vector index.
- `dimensions`: The dimensionality of the vectors (e.g., 128, 384, 768).
- `options.quantization`: Scaling mode (`'f32'` or `'i8'`). Use `'i8'` for significant memory savings.
- `options.metric`: Distance metric calculation (`'cos'`, `'l2sq'`, `'ip'`, `'hamming'`, `'jaccard'`). Default is `'cos'`.

#### `add(key: number, vector: Float32Array): void`
Inserts a vector into the index.
- `key`: A unique numeric identifier.
- `vector`: A `Float32Array` containing the embeddings.

#### `async addBatch(keys: Int32Array, vectors: Float32Array): Promise<VectorAddBatchResult>`
High-performance **asynchronous** batch insertion. Runs in a background thread to prevent UI freezing.
- `keys`: An `Int32Array` of unique identifiers.
- `vectors`: A single `Float32Array` containing all vectors concatenated (must match `keys.length * dimensions`).
- **Returns**: A promise resolving to `{ duration: number, count: number }`.

#### `search(vector: Float32Array, count: number, options?: SearchOptions): SearchResult[]`
Performs an ANN search.
- `vector`: The query embedding.
- `count`: Number of nearest neighbors to retrieve.
- `options.allowedKeys`: Optional array of keys to restrict the search to (filtering).
- **Returns**: An array of `SearchResult` objects `{ key: number, distance: number }`.

#### `remove(key: number): void`
Removes a vector from the index.
- `key`: The unique numeric identifier of the vector to remove.

#### `update(key: number, vector: Float32Array): void`
Updates an existing vector in the index (upsert operation).
- `key`: The unique numeric identifier.
- `vector`: The new vector data.

#### `save(path: string): void`
Serializes the current state of the index to a specified file path.

#### `load(path: string): void`
Deserializes an index from a file path.

#### `delete(): void`
Manually releases native memory resources. The index instance becomes unusable after this call.

#### `async loadVectorsFromFile(path: string): Promise<VectorLoadResult>`
**Asynchronously** loads raw vectors directly from a binary file into the index.
- `path`: Absolute path to the binary file containing packed floats.
- **Returns**: A promise resolving to `{ duration: number, count: number }`.
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

#### `isa: string` (readonly)
Returns the active SIMD instruction set name (e.g., `'NEON'`, `'AVX2'`, `'SVE'`, or `'Serial'`). Useful for verifying hardware acceleration at runtime.

#### `isIndexing: boolean` (readonly)
Returns `true` if a background indexing operation (`addBatch` or `loadVectorsFromFile`) is currently in progress.

#### `indexingProgress: { current: number, total: number, percentage: number }` (readonly)
Returns real-time progress of the current background indexing operation.

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

// High-Performance Async Batch Insertion
const manyKeys = new Int32Array([10, 11, 12]);
const manyVectors = new Float32Array(384 * 3).fill(0.1);
await index.addBatch(manyKeys, manyVectors);

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
**Int8 Quantization** provides significant memory savings (~44% total index reduction and ~75% raw vector reduction) AND improved indexing performance on modern ARM hardware (S23 FE). 

Recent benchmarks show that Int8 indexing is actually ~4x faster than F32 precision on supported devices, thanks to specialized SIMD kernels.

### Future Roadmap
- [x] **Dynamic CRUD Support**: Implemented `remove(key)` and `update(key, vector)`.
- [x] **Metadata Filtering**: Support for `allowedKeys` filtering during search.
- [x] **Simplified React Hooks**: Abstractions like `useVectorSearch` for automatic resource management.
- [x] **Architecture-Specific SIMD**: Enabled NEON/AVX optimizations via SimSIMD for Android and iOS.
- [x] **Background Indexing**: True multithreaded ingestion to avoid JS thread locks.
- [x] **Extended Distance Metrics**: Support for L2, IP, Hamming, and Jaccard.
- [x] **USearch Upgrade**: Migration to `v2.23.0+` for enhanced performance.
- [ ] **Hybrid Search**: Combine vector similarity with traditional keyword-based search.
- [ ] **SQLite Synchronization**: Built-in utilities to sync vector indices with `expo-sqlite`.


## License
MIT
