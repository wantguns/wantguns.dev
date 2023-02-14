+++
title = "Building LMDB JNI for Jetson Nano"
date = "2022-02-20"
[taxonomies]
tags = ["jetson-nano", "lmdb", "compilation"]
+++

## Building 

Once again, I hate to use docker for automating VM purposes, but I acknowledge
it as an ad-hoc method for this instance.

We will be compiling natively for arm64 in a qemu image which is running
inside a docker container.

```Dockerfile
# Import info for 64-bit Qemu based build
FROM balenalib/raspberrypi4-64-python:latest-bullseye-build

ARG LMDB_REPO=https://github.com/deephacks/lmdbjni
ARG LMDB_REPO_BRANCH=master

# Enforces cross-compilation through Qemu.
RUN [ "cross-build-start" ]

RUN sudo apt update -y && sudo apt upgrade -y
RUN sudo apt install -y \
    build-essential \
    git \
    tar \
    default-jdk \
    automake \
    libtool \
    maven \
    neovim

# Prepare LMDB-JNI Repo
WORKDIR /code
RUN git clone --single-branch --branch ${LMDB_REPO_BRANCH} --recursive ${LMDB_REPO} lmdb

# Start build
RUN cd lmdb && \
    sed pom.xml -i -e "s/<hawtjni-version>.*<\/hawtjni-version>/<hawtjni-version>1.15<\/hawtjni-version>/" && \
    mvn clean install -P linux64 -Dhttps.protocols=TLSv1.2

# Build Output
RUN find . | grep *.jar*
VOLUME ["./artifacts"]

RUN [ "cross-build-end" ]%
```

## Pitfalls

### SSL

```groovy
SSL peer shut down incorrectly
```

**Fix**: use the `-Dhttps.protocols=TLSv1.2` flag when invoking maven.

### Hawtjni 
```groovy
[INFO]       |   ^~~~~~~~~~
[INFO] src/hawtjni-callback.c:479:3: error: initializer element is not constant
[INFO]   479 |   (jintLong)FN(127, args), \
[INFO]       |   ^
[INFO] src/hawtjni-callback.c:498:3: note: in expansion of macro ‘FN_A_BLOCK’
[INFO]   498 |   FN_A_BLOCK(12)
[INFO]       |   ^~~~~~~~~~
[INFO] src/hawtjni-callback.c:479:3: note: (near initialization for ‘fnx_array[12][127]’)
[INFO]   479 |   (jintLong)FN(127, args), \
[INFO]       |   ^
[INFO] src/hawtjni-callback.c:498:3: note: in expansion of macro ‘FN_A_BLOCK’
[INFO]   498 |   FN_A_BLOCK(12)
[INFO]       |   ^~~~~~~~~~
[INFO] make: *** [Makefile:410: hawtjni-callback.lo] Error 1
[INFO] rc: 2
[INFO] ------------------------------------------------------------------------
[INFO] Reactor Summary for lmdbjni-project 0.4.8-SNAPSHOT:
[INFO]
[INFO] lmdbjni-project .................................... SUCCESS [02:08 min]
[INFO] lmdbjni ............................................ SUCCESS [04:50 min]
[INFO] lmdbjni-linux64 .................................... FAILURE [01:50 min]
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  08:49 min
[INFO] Finished at: 2022-02-21T09:40:07Z
[INFO] ------------------------------------------------------------------------
[ERROR] Failed to execute goal org.fusesource.hawtjni:maven-hawtjni-plugin:1.11:build (default) on project lmdbjni-linux64: build failed: org.apache.maven.plugin.MojoExecutionException: make based build failed with exit code: 2 -> [Help 1]
```
The error arises due to hardcoding a macro defining the system
architecture to `__x86_64__` instead of using something more generic.

This [pull request](https://github.com/fusesource/hawtjni/pull/20) fixes
the bug, but it got merged into hawtjni `v1.15` and LMDB-jni uses
hawtjni `v1.11`.

**Fix**

Apply basic substitution[^1]:   
```bash
sed pom.xml -i -e "s/<hawtjni-version>.*<\/hawtjni-version>/<hawtjni-version>1.15<\/hawtjni-version>/"
```

---

[^1]: 
We could have used a more recent version, but
[org.fusesource.hawtjni](https://mvnrepository.com/artifact/org.fusesource.hawtjni)
changed the package name [after
`v1.15`](https://mvnrepository.com/artifact/org.fusesource.hawtjni/hawtjni-maven-plugin)
and would therefore require more work. 
tldr; i am lazy.

