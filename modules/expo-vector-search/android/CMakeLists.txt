cmake_minimum_required(VERSION 3.10.2)
project(ExpoVectorSearch)

# 1. React Native / Expo Configuration (Default)
set(CMAKE_VERBOSE_MAKEFILE OFF)
set(CMAKE_CXX_STANDARD 17)
# Disable external FP16 library requirement (use native or fallback)
add_compile_definitions(USEARCH_USE_FP16LIB=0)
# Enable SimSIMD for hardware acceleration (only on 64-bit architectures)
if(${ANDROID_ABI} STREQUAL "arm64-v8a" OR ${ANDROID_ABI} STREQUAL "x86_64")
    add_compile_definitions(USEARCH_USE_SIMSIMD=1)
else()
    add_compile_definitions(USEARCH_USE_SIMSIMD=0)
endif()

# 2. Configure USearch (Use Local Headers)
# We use the local version in ../cpp/usearch to ensure consistency with iOS
# and to avoid version drift or network dependencies during build.

# 3. Define the shared library
add_library(
  expo-vector-search
  SHARED
  src/main/cpp/ExpoVectorSearchModule.cpp
)

# 4. Include directories (USearch and React Native JSI)
target_include_directories(
  expo-vector-search
  PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}/../cpp
)

# 5. Link libraries (Android Log and JS Engine libraries)
# Important: React Native uses Prefab, so we need to find the ReactAndroid package
find_package(ReactAndroid REQUIRED CONFIG)

target_link_libraries(
  expo-vector-search
  log
  ReactAndroid::jsi
  # Depending on the Expo/RN version, linking might be necessary:
  # ReactAndroid::react_nativemodule_core
)