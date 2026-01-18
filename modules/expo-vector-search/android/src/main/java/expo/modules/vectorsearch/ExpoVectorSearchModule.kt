package expo.modules.vectorsearch

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

import com.facebook.react.bridge.ReactContext

class ExpoVectorSearchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoVectorSearch")

    // Module installation event (when the app opens)
    OnCreate {
      val reactContext = appContext.reactContext as? ReactContext
      reactContext?.let {
        // Get the JSI pointer from the JavaScriptContextHolder
        val jsiPtr = it.javaScriptContextHolder?.get()
        if (jsiPtr != null && jsiPtr != 0L) {
          nativeInstall(jsiPtr)
        }
      }
    }
  }

  // C++ native method declaration
  private external fun nativeInstall(jsiPtr: Long)

  companion object {
    init {
      // Load the library compiled by CMake
      System.loadLibrary("expo-vector-search")
    }
  }
}