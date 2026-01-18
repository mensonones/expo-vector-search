# expo-vector-search

`expo-vector-search` is a high-performance, on-device **vector search engine** module for Expo and React Native.

> [!NOTE]
> This module is currently **optimized and validated for Android**. The C++ JSI layer is fully functional, but the build configuration and native runtime have been primarily verified on Android devices. iOS support is on the roadmap.

## Performance (Real-world Benchmarks)
Results obtained on a **Samsung Galaxy S23 FE**:
- **Search (1000 items, 128 dims)**: **0.08ms** per query.
- **Batch Ingest (1000 items)**: **74.44ms** total time.
- **Memory Optimization (10k items, 384 dims)**:
    - F32 Footprint: 36,964.94 KB.
    - Int8 Footprint: 20,580.94 KB.

![Performance Lab Benchmarks on S23 FE](../../assets/images/perf_lab.jpg)

## Key Features

- **Blazing Fast Performance**: Powered by the HNSW (Hierarchical Navigable Small World) algorithm, capable of sub-millisecond search latencies on modern mobile hardware.
- **Direct JSI Integration**: Uses direct memory access between the JavaScript engine and C++ layer, eliminating serialization overhead.
- **Production-Grade Quantization**: Support for Int8 quantization to reduce memory footprint by up to 4x with minimal impact on search accuracy.
- **Disk Persistence**: Built-in methods to save and load vector indices to/from the local file system.
- **Memory Safety**: Strict buffer alignment checks and type validation to ensure native stability.
- **Explicit Memory Management**: Provision for deterministic resource release via the `delete()` method.

## Installation

This module contains custom native code. You must use development builds to use this module.

```bash
npx expo install expo-vector-search
```

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

## License
MIT
