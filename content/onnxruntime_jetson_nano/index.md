+++
title = "Building ONNX Runtime for Jetson Nano"
date = "2022-02-20"
[taxonomies]
tags = ["jetson-nano", "onnx", "compilation"]
+++

## Building 

I hate to use docker for automating VM purposes, but I acknowledge it as
an ad-hoc method for this instance.

We will be compiling natively for arm64 in a qemu image which is running
inside a docker container.

#### Dockerfile

```Dockerfile
# Import info for 64-bit Qemu based build
# There are also raspberry pi 4 and 64-bit images available so adjust as required
FROM balenalib/raspberrypi4-64-python:latest-bullseye-build

ARG ONNXRUNTIME_REPO=https://github.com/Microsoft/onnxruntime
ARG ONNXRUNTIME_SERVER_BRANCH=master

# Enforces cross-compilation through Qemu.
RUN [ "cross-build-start" ]

RUN sudo apt update -y && sudo apt upgrade -y
RUN sudo apt install -y \
    sudo \
    build-essential \
    curl \
    libcurl4-openssl-dev \
    libssl-dev \
    wget \
    python3 \
    python3-dev \
    git \
    tar \
    libatlas-base-dev \
    default-jdk \
    unzip \
    neovim \
    cmake \
    openjdk-11-jdk

RUN wget --no-verbose --output-document=gradle.zip "https://services.gradle.org/distributions/gradle-6.3-bin.zip" &&\
    echo "Installing Gradle" &&\
    unzip gradle.zip &&\
    rm gradle.zip &&\
    mv "gradle-6.3" "/opt/gradle/" &&\
    ln --symbolic "/opt/gradle/bin/gradle" /usr/bin/gradle

# Set up build args
ARG BUILDTYPE=MinSizeRel
# if doing a 32-bit build change '--arm64' to '--arm'
ARG BUILDARGS="--config ${BUILDTYPE} --arm64"

# Prepare onnxruntime Repo
WORKDIR /code
RUN git clone --single-branch --branch ${ONNXRUNTIME_SERVER_BRANCH} --recursive ${ONNXRUNTIME_REPO} onnxruntime

# Build ORT including the shared lib and python bindings
WORKDIR /code/onnxruntime
RUN ./build.sh --use_openmp ${BUILDARGS} --update --build --build_shared_lib --build_java --parallel \
    --cmake_extra_defines JAVA_AWT_LIBRARY=NotNeeded JAVA_JVM_LIBRARY=NotNeeded

# Build Output
RUN ls -l /code/onnxruntime/build/Linux/${BUILDTYPE}/*.so*
VOLUME ["./artifacts"]

# Uncomment if building python wheels
# RUN ls -l /code/onnxruntime/build/Linux/${BUILDTYPE}/dist/*.whl

RUN [ "cross-build-end" ]%
```

## Pitfalls

### JNI

```cmake
Could NOT find JNI (missing: JAVA_AWT_LIBRARY JAVA_JVM_LIBRARY)
```

**Fix**: set JAVA_AWT_LIBRARY, JAVA_JVM_LIBRARY to not needed.


### C++ Version
  
```cmake
In file included from /code/onnxruntime/onnxruntime/test/onnx/tensorprotoutils.cc:15:0:
/code/onnxruntime/include/onnxruntime/core/framework/data_types.h: In static member function ‘static const onnxruntime::DataTypeImpl* onnxruntime::data_types_internal::OptionalTypeHelper::GetElemType()’:
/code/onnxruntime/include/onnxruntime/core/framework/data_types.h:427:8: error: expected ‘(’ before ‘constexpr’
     if constexpr (std::is_same<T, Tensor>::value) {
        ^~~~~~~~~
/code/onnxruntime/include/onnxruntime/core/framework/data_types.h:429:7: error: ‘else’ without a previous ‘if’
     } else {
       ^~~~
```

**Fix**: GCC Version not up to date, use gcc 7+.


