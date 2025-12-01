cmake_minimum_required(VERSION 3.16)
project(AIMatrixClassifier VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Optimization flags for high performance
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -march=native -flto")
set(CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE} -O3 -march=native -flto")

# Find required packages
find_package(PkgConfig REQUIRED)

# Drogon (HTTP server)
pkg_check_modules(DROGON REQUIRED drogon)

# ONNX Runtime
pkg_check_modules(ONNXRUNTIME REQUIRED libonnxruntime)

# JSON libraries
pkg_check_modules(JSONCPP REQUIRED jsoncpp)
find_package(nlohmann_json REQUIRED)

# CPR (HTTP client)
find_package(cpr REQUIRED)

# Threads
find_package(Threads REQUIRED)

# Source files
set(SOURCES
    main.cpp
)

# Create executable
add_executable(${PROJECT_NAME} ${SOURCES})

# Include directories
target_include_directories(${PROJECT_NAME} PRIVATE
    ${DROGON_INCLUDE_DIRS}
    ${ONNXRUNTIME_INCLUDE_DIRS}
    ${JSONCPP_INCLUDE_DIRS}
)

# Link libraries
target_link_libraries(${PROJECT_NAME} PRIVATE
    ${DROGON_LIBRARIES}
    ${ONNXRUNTIME_LIBRARIES}
    ${JSONCPP_LIBRARIES}
    nlohmann_json::nlohmann_json
    cpr::cpr
    Threads::Threads
)

# Set compile definitions
target_compile_definitions(${PROJECT_NAME} PRIVATE
    ${DROGON_DEFINITIONS}
    ${ONNXRUNTIME_DEFINITIONS}
)

# Installation
install(TARGETS ${PROJECT_NAME}
    RUNTIME DESTINATION bin
)

# Print build info
message(STATUS "=== AI Matrix Classifier Build Configuration ===")
message(STATUS "C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "Compiler: ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "Install Path: ${CMAKE_INSTALL_PREFIX}")
message(STATUS "ONNX Runtime: ${ONNXRUNTIME_VERSION}")
message(STATUS "Drogon: ${DROGON_VERSION}")
message(STATUS "Use ccache: ${CCACHE_FOUND}")
message(STATUS "==================================================")
