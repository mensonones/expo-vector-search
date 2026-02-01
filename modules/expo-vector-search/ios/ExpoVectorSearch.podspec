Pod::Spec.new do |s|
  s.name           = 'ExpoVectorSearch'
  s.version        = '0.4.0'
  s.summary        = 'High-performance on-device vector search for Expo'
  s.description    = 'Fast similarity search using HNSW and JSI for React Native'
  s.author         = 'Emerson Vieira'
  s.homepage       = 'https://github.com/mensonones/expo-vector-search'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}", "../cpp/**/*.{h,cpp,hpp}"
  
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'OTHER_CPLUSPLUSFLAGS' => '-fexceptions -DUSEARCH_USE_FP16LIB=0 -DUSEARCH_USE_SIMSIMD=1',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/../cpp"'
  }
end
