# Expo Vector Search

A high-performance, on-device **vector search engine** demonstration for Expo and React Native. This project showcases the capabilities of the `expo-vector-search` module, providing a real-world implementation of semantic similarity search and machine learning features without server-side dependencies.

## Key Features

- **Blazing Fast On-Device Search**: Sub-millisecond similarity search over 10,000+ vectors using the HNSW algorithm.
- **Privacy-First Architecture**: All vector indexing and similarity matching occurs locally on the device.
- **Production-Grade Features**: Support for Int8 quantization, native persistence, and high-fidelity JSI communication.
- **Extended Metrics**: Support for Cosine, Euclidean (L2), Hamming (Binary), and Jaccard (Set) distances.
- **Cross-Industry Use Cases**:
  - **E-commerce**: Visual product similarity matching.
  - **Support**: Automated message classification and routing.
  - **Safety**: On-device moderation and anomaly detection.

3. **Application Layer**: A modern Expo app demonstrating real-world use cases, benchmarks, and diagnostic tools.

## How it Works

Unlike traditional databases that search for exact matches (e.g., "Product ID = 123"), this engine uses **Vector Embeddings**. 
- **Embeddings**: Data (images, text) is converted into an array of numbers (vectors) that represent its meaning.
- **Distance**: The "similarity" between two items is calculated using the **Cosine Distance** between their vectors.
- **Native Binary Loading**: Since `v0.2.0`, vectors can be loaded directly from `.bin` files into C++ memory, eliminating the JavaScript bridge bottleneck for large datasets.
- **Dynamic CRUD & Hooks**: Since `v0.3.0`, the engine supports live updates (`remove`/`update`) and provides a simplified `useVectorSearch` hook for React.
- **True Background Indexing**: Since `v0.5.0`, heavy ingestion tasks (`addBatch`) run in dedicated background threads, ensuring 60fps UI performance.
- **HNSW Algorithm**: Instead of checking every single item (slow), we use a mathematical graph that lets us jump through the data to find the nearest neighbors in sub-millisecond time.

## Project Structure

This repository is organized as a monorepo-style Expo project:

```text
├── app/                    # Demo Application (Expo Router)
│   ├── (tabs)/             # Main search and performance lab screens
│   └── ...
├── modules/
│   └── expo-vector-search/ # Core Engine (Native Module)
│       ├── ios/            # Swift & C++ bindings for iOS
│       ├── android/        # Kotlin & C++ (JNI) for Android
│       ├── src/            # TypeScript API & types
│       └── README.md       # Technical module documentation
├── assets/                 # Demo assets (product data & images)
├── scripts/                # Python scripts for data generation
└── README.md               # You are here
```

## Getting Started

### Prerequisites

- Node.js and npm/yarn.
- Development Build environment (required for custom native modules).

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npx expo start
   ```

3. Run the application:
   - For Android: Press `a`.
   - For iOS: Press `i`.
   - *Note: This project requires a development build to run the custom native module.*

## Demo Data Setup

To test the **Visual Search** demo, you need to download and process the sample product dataset. Follow these steps:

### 1. Prerequisites (Python)
Ensure you have Python 3.8+ installed. Install the processing dependencies:
```bash
pip install -r scripts/requirements.txt
```

### 2. Download & Process Data
Run the following commands from the **project root**:

```bash
# Step A: Download the dataset and convert to JSON (~150MB)
python scripts/download_and_convert_products.py

# Step B: Split the dataset into optimized chunks for the mobile app
python scripts/split_dataset.py

# Step C: Convert to Binary for Native C++ Loader (Ultra Fast)
python scripts/convert_to_binary.py
```

### 3. Verify
After running the scripts, your `assets/chunks/` directory should contain multiple `.json` files and an `index.ts`. The app will automatically load these files on the next launch.

## Platform Support

> [!IMPORTANT]
> - **Android**: Fully supported (tested on Galaxy S23 FE).
> - **iOS**: Fully supported (tested on iPhone 12).

## Module Documentation

The core logic resides in the `modules/expo-vector-search` directory. For detailed API documentation, performance specifications, and implementation details, please refer to the [Module README](./modules/expo-vector-search/README.md).

## Performance and Benchmarks

The application includes a built-in benchmark tool that compares the native C++ implementation against a naive JavaScript baseline. Results obtained using **Release builds** on physical devices.

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

### Memory Optimization (10,000 items, 384 dims)
| Platform | Feature | Base C++ (v0.2.0) | SIMD/NEON (v0.4.0) | Improvement |
| :--- | :--- | :--- | :--- | :--- |
| **Android** (S23 FE) | F32 Indexing | ~9.284 ms | 10.591 ms | Proxy Overhead |
| **Android** (S23 FE) | Int8 Indexing | ~34.608 ms | **3.509 ms** | **~10x Faster** |
| **iOS** (iPhone 12) | F32 Indexing | ~9.200 ms | **8.803 ms** | **Fastest** |
| **iOS** (iPhone 12) | Int8 Indexing | ~34.000 ms | **1.867 ms** | **~18x Faster** |

## Acknowledgements

- **[USearch](https://github.com/unum-cloud/usearch)**: The high-performance C++ engine powering the similarity search.
- **[Expo Modules SDK](https://docs.expo.dev/modules/overview/)**: For the robust infrastructure that makes JSI modules accessible in the Expo ecosystem.
- **[Crossing Minds](https://huggingface.co/datasets/crossingminds/shopping-queries-image-dataset)**: For the sample product dataset.

## Future Roadmap

- [x] **Dynamic CRUD Support**: Implement `remove(key)` and `update(key, vector)` for live index management.
- [x] **Metadata Filtering**: Enable search with predicates (e.g., filtering by category or availability).
- [x] **Simplified React Hooks**: Abstractions like `useVectorSearch` for automatic resource management.
- [x] **Architecture-Specific SIMD**: Enabled NEON/AVX optimizations via SimSIMD for Android and iOS.
- [x] **Background Indexing**: Offload heavy ingestion to native threads to prevent UI stutters.
- [x] **USearch Engine Upgrade**: Migrate from `v2.9.0` to `v2.23.0+` for better precision.
- [ ] **Hybrid Search**: Combine vector similarity with traditional keyword-based search.
- [ ] **SQLite Synchronization**: Built-in utilities to sync vector indices with `expo-sqlite`.

## License

This project is licensed under the [MIT License](./LICENSE).

---
*Maintained with a focus on high-performance mobile engineering.*
