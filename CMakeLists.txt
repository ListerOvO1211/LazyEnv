# =============================================================================
# LazyEnv - CMakeLists.txt
# Build configuration for the LazyEnv development environment setup tool
# =============================================================================
cmake_minimum_required(VERSION 3.24)

project(LazyEnv
    VERSION   0.1.0
    LANGUAGES CXX
)

# ---------------------------------------------------------------------------
# C++23 standard
# ---------------------------------------------------------------------------
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ---------------------------------------------------------------------------
# Platform check
# ---------------------------------------------------------------------------
if(NOT WIN32)
    message(FATAL_ERROR "LazyEnv currently supports Windows only.")
endif()

# ---------------------------------------------------------------------------
# WebView2 SDK via NuGet (fetched automatically)
# ---------------------------------------------------------------------------
include(FetchContent)

FetchContent_Declare(
    webview2
    URL      https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2903.40
    DOWNLOAD_NO_EXTRACT FALSE
)

FetchContent_Declare(
    wil
    URL      https://www.nuget.org/api/v2/package/Microsoft.Windows.ImplementationLibrary/1.0.240803.1
    DOWNLOAD_NO_EXTRACT FALSE
)

FetchContent_MakeAvailable(webview2 wil)

# Locate WebView2 headers and libraries
set(WEBVIEW2_INCLUDE_DIR "${webview2_SOURCE_DIR}/build/native/include")
set(WIL_INCLUDE_DIR      "${wil_SOURCE_DIR}/include")

# Determine architecture-specific lib path
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
    set(WEBVIEW2_LIB_DIR "${webview2_SOURCE_DIR}/build/native/x64")
else()
    set(WEBVIEW2_LIB_DIR "${webview2_SOURCE_DIR}/build/native/x86")
endif()

# ---------------------------------------------------------------------------
# Source files
# ---------------------------------------------------------------------------
set(SOURCES
    main.cpp
    webview_host.cpp
    webview_host.h
    installer.cpp
    installer.h
    rollback.cpp
    rollback.h
)

# ---------------------------------------------------------------------------
# Resource file (icon + version info)
# ---------------------------------------------------------------------------
set(RESOURCE_FILE LazyEnv.rc)

# ---------------------------------------------------------------------------
# Executable (WIN32 = no console window)
# ---------------------------------------------------------------------------
add_executable(LazyEnv WIN32
    ${SOURCES}
    ${RESOURCE_FILE}
)

# ---------------------------------------------------------------------------
# Include directories
# ---------------------------------------------------------------------------
target_include_directories(LazyEnv PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${WEBVIEW2_INCLUDE_DIR}
    ${WIL_INCLUDE_DIR}
)

# ---------------------------------------------------------------------------
# Link libraries
# ---------------------------------------------------------------------------
target_link_libraries(LazyEnv PRIVATE
    ${WEBVIEW2_LIB_DIR}/WebView2LoaderStatic.lib
    Shlwapi.lib
    Ole32.lib
    Shell32.lib
    Advapi32.lib
    User32.lib
    Gdi32.lib
    Dwmapi.lib
    Shcore.lib
)

# ---------------------------------------------------------------------------
# Compiler options
# ---------------------------------------------------------------------------
if(MSVC)
    target_compile_options(LazyEnv PRIVATE
        /W4         # Warning level 4
        /utf-8      # Source and execution charset UTF-8
        /permissive-
        /Zc:__cplusplus
    )
    # Suppress specific warnings that are noisy with Win32 API
    target_compile_definitions(LazyEnv PRIVATE
        _CRT_SECURE_NO_WARNINGS
        NOMINMAX
        WIN32_LEAN_AND_MEAN
        UNICODE
        _UNICODE
    )
elseif(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(LazyEnv PRIVATE
        -Wall -Wextra -Wpedantic
    )
    target_compile_definitions(LazyEnv PRIVATE
        NOMINMAX
        WIN32_LEAN_AND_MEAN
        UNICODE
        _UNICODE
    )
endif()

# ---------------------------------------------------------------------------
# Post-build: copy resources next to executable
# ---------------------------------------------------------------------------
add_custom_command(TARGET LazyEnv POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory
        "$<TARGET_FILE_DIR:LazyEnv>/resources"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/index.html"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/index.html"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/style.css"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/style.css"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/script.js"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/script.js"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/i18n.js"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/i18n.js"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/icons.js"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/icons.js"
    COMMENT "Copying web resources to output directory"
)

# ---------------------------------------------------------------------------
# Install rules
# ---------------------------------------------------------------------------
install(TARGETS LazyEnv RUNTIME DESTINATION bin)
install(DIRECTORY resources/ DESTINATION bin/resources
    FILES_MATCHING
    PATTERN "*.html"
    PATTERN "*.css"
    PATTERN "*.js"
    PATTERN "*.ico"
)

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
message(STATUS "")
message(STATUS "  LazyEnv v${PROJECT_VERSION}")
message(STATUS "  C++ Standard:    ${CMAKE_CXX_STANDARD}")
message(STATUS "  Compiler:        ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "  WebView2 SDK:    ${WEBVIEW2_INCLUDE_DIR}")
message(STATUS "  WIL:             ${WIL_INCLUDE_DIR}")
message(STATUS "")
