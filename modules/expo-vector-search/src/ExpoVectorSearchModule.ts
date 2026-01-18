import { requireNativeModule } from 'expo';
import { SearchResult, Vector } from './ExpoVectorSearch.types';

// The native module is loaded to ensure JSI installation occurs (OnCreate)
requireNativeModule('ExpoVectorSearch');

// Index creation options
export type QuantizationMode = 'f32' | 'f16' | 'i8';

export interface VectorIndexOptions {
  quantization?: QuantizationMode;
}

// C++ HostObject Interface (Index Instance)
interface VectorIndexHostObject {
  dimensions: number;
  count: number;
  memoryUsage: number;
  add(key: number, vector: Vector): void;
  search(vector: Vector, count: number): SearchResult[];
  save(path: string): void;
  load(path: string): void;
  delete(): void;
  addBatch(keys: Int32Array, vectors: Float32Array): void;
}

// Global Module Interface (Factory)
interface ExpoVectorSearchFactory {
  createIndex(dimensions: number, options?: VectorIndexOptions): VectorIndexHostObject;
}

declare global {
  var ExpoVectorSearch: ExpoVectorSearchFactory;
}

/**
 * High-performance Vector Index powered by USearch (C++ JSI).
 * Allows for ultra-fast, on-device semantic search and similarity matching.
 */
export class VectorIndex {
  private _index: VectorIndexHostObject;

  /**
   * Creates a new vector index.
   * @param dimensions The dimensionality of the vectors (e.g., 768 or 1536).
   * @param options Configuration options for the index.
   * @throws Error if the native JSI module is not available.
   */
  constructor(dimensions: number, options?: VectorIndexOptions) {
    if (!global.ExpoVectorSearch) {
      throw new Error("ExpoVectorSearch JSI module is not available.");
    }
    this._index = global.ExpoVectorSearch.createIndex(dimensions, options);
  }

  /**
   * The dimensionality of the vectors in this index.
   */
  get dimensions(): number {
    return this._index.dimensions;
  }

  /**
   * The total number of vectors currently stored in the index.
   */
  get count(): number {
    return this._index.count;
  }

  /**
   * The estimated memory usage of the native index in bytes.
   * Does not include JavaScript object overhead.
   */
  get memoryUsage(): number {
    return this._index.memoryUsage;
  }

  /**
   * Adds a vector to the index.
   * @param key A unique numeric identifier for the vector.
   * @param vector A Float32Array containing the vector data.
   * @throws Error if the vector dimension doesn't match or memory allocation fails.
   */
  add(key: number, vector: Vector): void {
    this._index.add(key, vector);
  }

  /**
   * Adds multiple vectors in a single high-performance batch operation.
   * This is significantly faster than calling `.add()` in a loop.
   * @param keys An Int32Array of unique numeric identifiers.
   * @param vectors A single Float32Array containing all vectors concatenated.
   * @throws Error if buffer sizes or alignment do not match.
   */
  addBatch(keys: Int32Array, vectors: Float32Array): void {
    this._index.addBatch(keys, vectors);
  }

  /**
   * Performs an Approximate Nearest Neighbor (ANN) search.
   * @param vector The query vector.
   * @param count The number of nearest neighbors to return.
   * @returns An array of results containing keys and distances (cosine distance).
   */
  search(vector: Vector, count: number): SearchResult[] {
    return this._index.search(vector, count);
  }

  /**
   * Saves the index to a file.
   * @param path The absolute path to the file (e.g., in Expo.FileSystem.documentDirectory).
   */
  save(path: string): void {
    this._index.save(path);
  }

  /**
   * Loads the index from a file.
   * @param path The absolute path to the file.
   */
  load(path: string): void {
    this._index.load(path);
  }

  /**
   * Explicitly releases the native memory associated with this index.
   * Once called, the index can no longer be used.
   */
  delete(): void {
    this._index.delete();
  }
}

export default VectorIndex;