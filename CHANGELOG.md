# Changelog

## [0.5.2] - 

### Fixed
- **Android (16KB Page)**: Enabled 16KB page size compatibility for modern Android environments (Android 15+) by updating native library alignment.

## [0.5.1] - 2026-02-15

### Fixed
- **Core (SIGSEGV)**: Resolved segmentation fault (SIGSEGV) in `addBatch` and `loadVectorsFromFile` by making these operations synchronous to avoid race conditions in native memory.

## [0.5.0] - 2026-02-14

### Changed
- Base version for stability fixes.

## [0.4.1] - 2026-02-12

### Fixed
- Minor stability improvements in the native module.

## [0.4.0] - 2026-02-10

### Added
- Initial support for index persistence on Android.

## [0.3.0] - 2026-01-31

### Added
- **Full CRUD**: Support for `remove(key)` and `update(key, vector)` in the native engine.
- **`useVectorSearch` Hook**: New React abstraction for automatic index and memory management.
- **Native Filtering**: Support for `allowedKeys` in the `search` method, allowing results to be filtered directly in C++.
- **Custom Jaccard Metric**: Optimized implementation for `f32` vectors (useful for skill/sparse set search).

### Fixed
- **Android Freeze**: Fixed initialization bug in USearch that caused app freezes when using custom metrics.
- **iOS Memory Garbage**: Resolved imprecise results (100% false match) due to memory garbage during dimension initialization.
- **Deterministic Demos**: Data generation in "Skills" and "Colors" demos now uses a fixed seed, ensuring identical results on Android and iOS.

### Changed
- Improved native logging to facilitate debugging of memory alignment errors.
- Reverted Jaccard demo instructions to English.

---
[0.5.1]: https://github.com/mensonones/expo-vector-search/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/mensonones/expo-vector-search/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/mensonones/expo-vector-search/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/mensonones/expo-vector-search/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mensonones/expo-vector-search/milestone/1
