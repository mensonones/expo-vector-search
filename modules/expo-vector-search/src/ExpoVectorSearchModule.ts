import { requireNativeModule } from 'expo';
import { DistanceMetric, SearchResult, Vector } from './ExpoVectorSearch.types';

// The native module is loaded to ensure JSI installation occurs (OnCreate)
requireNativeModule('ExpoVectorSearch');

// Index creation options
export type QuantizationMode = 'f32' | 'f16' | 'i8';

export interface VectorIndexOptions {
  quantization?: QuantizationMode;
  metric?: DistanceMetric;
}

export interface SearchOptions {
  allowedKeys?: number[] | Int32Array | Uint32Array;
}

export type AddResult = {
  duration: number; // in milliseconds
};

export type VectorAddBatchResult = {
  duration: number; // in milliseconds
  count: number;
};

export type VectorLoadResult = {
  duration: number; // in milliseconds
  count: number;
};

export type IndexingProgress = {
  current: number;
  total: number;
  percentage: number;
};

// C++ HostObject Interface (Index Instance)
interface VectorIndexHostObject {
  dimensions: number;
  count: number;
  memoryUsage: number;
  isa: string;
  isIndexing: boolean;
  indexingProgress: IndexingProgress;
  add(key: number, vector: Vector): AddResult;
  remove(key: number): void;
  update(key: number, vector: Vector): void;
  search(
    vector: Vector,
    count: number,
    options?: SearchOptions
  ): SearchResult[];
  save(path: string): void;
  load(path: string): void;
  delete(): void;
  addBatch(keys: Int32Array, vectors: Float32Array): void;
  loadVectorsFromFile(path: string): void;
  getItemVector(key: number): Float32Array | undefined;
  getLastResult(): VectorLoadResult;
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
    if (!globalThis.ExpoVectorSearch) {
      throw new Error("ExpoVectorSearch JSI module is not available.");
    }
    this._index = globalThis.ExpoVectorSearch.createIndex(dimensions, options);
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
   * The SIMD Instruction Set Architecture being used (e.g. 'neon', 'avx2', 'serial').
   */
  get isa(): string {
    return this._index.isa;
  }

  /**
   * Whether the index is currently processing an asynchronous operation (like addBatch).
   */
  get isIndexing(): boolean {
    return this._index.isIndexing;
  }

  /**
   * The real-time progress of an ongoing indexing operation.
   */
  get indexingProgress(): IndexingProgress {
    return this._index.indexingProgress;
  }

  /**
   * Adds a vector to the index.
   * @param key A unique numeric identifier for the vector.
   * @param vector A Float32Array containing the vector data.
   * @throws Error if the vector dimension doesn't match or memory allocation fails.
   */
  add(key: number, vector: Vector): AddResult {
    return this._index.add(key, vector);
  }

  /**
   * Adds multiple vectors in a single high-performance batch operation.
   * This is significantly faster than calling `.add()` in a loop.
   * @param keys An Int32Array of unique numeric identifiers.
   * @throws Error if buffer sizes or alignment do not match.
   */
  async addBatch(
    keys: Int32Array,
    vectors: Float32Array
  ): Promise<VectorAddBatchResult> {
    this._index.addBatch(keys, vectors);
    return this._waitForOperation();
  }

  /**
   * Internal helper to poll for operation completion.
   */
  private async _waitForOperation(): Promise<VectorLoadResult> {
    while (this._index.isIndexing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return this._index.getLastResult();
  }

  /**
   * Removes a vector from the index.
   * @param key The unique numeric identifier of the vector to remove.
   * @throws Error if the key is not found or removal fails.
   */
  remove(key: number): void {
    this._index.remove(key);
  }

  /**
   * Updates an existing vector in the index.
   * This is equivalent to removing the old vector and adding a new one.
   * @param key The unique numeric identifier.
   * @param vector The new vector data.
   * @throws Error if dimensions mismatch or update fails.
   */
  update(key: number, vector: Vector): void {
    this._index.update(key, vector);
  }

  /**
   * Performs an Approximate Nearest Neighbor (ANN) search.
   * @param vector The query vector.
   * @param count The number of nearest neighbors to return.
   * @param options Optional SearchOptions (e.g., allowedKeys for filtering).
   * @returns An array of SearchResult objects (key and distance).
   * @throws Error if dimensions mismatch or search fails.
   */
  search(
    vector: Vector,
    count: number,
    options?: SearchOptions
  ): SearchResult[] {
    return this._index.search(vector, count, options);
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
   * Loads raw vectors directly from a binary file.
   * This avoids JS parsing overhead and is much faster for initialization.
   * @param path The absolute path to the binary file containing packed floats.
   * @returns An object containing the number of vectors loaded and the duration.
   */
  async loadVectorsFromFile(path: string): Promise<VectorLoadResult> {
    this._index.loadVectorsFromFile(path);
    return this._waitForOperation();
  }

  /**
   * Retrieves the vector associated with a specific key from the index.
   * Useful when vectors are stored only in native memory (e.g., after loadVectorsFromFile).
   * @param key The unique key of the item.
   * @returns The vector as a Float32Array, or undefined if not found.
   */
  getItemVector(key: number): Float32Array | undefined {
    return this._index.getItemVector(key);
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