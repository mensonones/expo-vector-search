cmake_minimum_required(VERSION 3.10.2)
project(ExpoVectorSearch)

# 1. React Native / Expo Configuration (Default)
set(CMAKE_VERBOSE_MAKEFILE OFF)
set(CMAKE_CXX_STANDARD 17)
# Disable external FP16 library requirement (use native or fallback)
add_compile_definitions(USEARCH_USE_FP16LIB=0)

# 2. Download and Configure USearch
include(FetchContent)

FetchContent_Declare(
  usearch
  GIT_REPOSITORY https://github.com/unum-cloud/usearch.git
  GIT_TAG        v2.9.0 # Use a recent stable version
)

# Make usearch available to the project
FetchContent_MakeAvailable(usearch)

# 3. Define the shared library
add_library(
  expo-vector-search
  SHARED
  src/main/cpp/ExpoVectorSearchModule.cpp
)

# 4. Include directories (USearch and React Native JSI)
# Note: React Native defines variables for includes, but if it fails,
# usearch is header-only, so we need to focus on its include path.
target_include_directories(
  expo-vector-search
  PUBLIC
  ${usearch_SOURCE_DIR}/include
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