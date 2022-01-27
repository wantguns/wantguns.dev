+++
title = "Final Report - GSoC 2020"
description = "Spoiler alert, its not over yet"
tags = ["android", "gsoc2020", "sharkbait"]
date = "2020-08-26"
+++

Its almost 3 months since I have been officially working with the
SharkBait team at Gentoo. A lot of ground has been covered, a lot is
still left. In this blog, I will explain the scope of SharkBait right
now and how I plan its future.

---

## Work Covered

### Porting SharkBaitOS
When KireinaHoro started working on SharkBait, the latest Android
version of that time was 8 or Android Oreo. Sharkbait at that time,
supported all the Android devices because it targeted only a specific
boot order, which was common till Android 8. 
Then came Android 9, with its System-As-Root configuration, which
rendered SharkBait's original boot order non functional for all devices
shipping with Android 9. \
The first month of my work revolved around porting SharkBait to SAR
based devices. I succeeded in doing so, and wrote blogs about it:
- [**Android Boot High Jinks**](@/android_boot_high_jinks.md) \
    In this blog we discuss the different approaches at booting
    Android, Google has experimented with.
- [**Booting Gentoo from SAR-Preinit**](@/booting_gentoo_using_preinit.md) \
    This blog showcases how I patched my phone's kernel in order to
    boot Gentoo on my phone.
- [**Starting System-as-Root Android in a LXC container**](@/starting_android_in_gentoo/index.md) \
    This blog is the first class guide for launching SharkBait in
    System-As-Root devices. 

The projects made in efforts to port SharkBait for SAR were:
- [**SAR-Preinit**](https://gitlab.com/WantGuns/sar-preinit) \
    This repository acts as the setup which patches your custom kernel
    and makes it boot a GNU/Linux distro, instead of Android on your
    phone.
- [**Bootstrap-init**](https://gitlab.com/WantGuns/bootstrap-init) \
    This repository hosts the source of the init binary executed inside
    the LXC container which launches System-As-Root Android on top of 
    Gentoo.

### Introducing Android builds on AArch64 Hosts
As simple as it sounds, this part of my GSoC tenure turned out to be the
exact opposite. \
My first task was to provide a AArch64 native port of the LLVM toolchain
AOSP uses. I was stuck on compiling and testing my modified scripts till
the second month, when my mentor generously set up a beefy AArch64
server for me. I succeeded in delivering that toolchain. Related sources
are:
- [**Building Android: BTS**](@/build_android.md) \
    In this blog, I look what events get triggered under the hood when
    we build Android, as to seek insight on breaking down Android later.
- [**Toolchain_LLVM_Android**](https://github.com/WantGuns/toolchain_llvm_android) \
    This repository hosts the build scripts and instructions on building
    AOSP's LLVM distribution on AArch64 Host, which targets AArch64 and 
    Arm platforms

Once I dealt with the toolchains, I could focus on building Android.
Unfortunately this part is still unfinished due to the massive scale of
thought-process and work it requires. Still, I will report on whatever I
have been doing:
- [**Manifest**](https://github.com/WantGuns/manifest/) \
    This is the (yet-to-be) SharkBait Manifest. It houses the different
    AOSP components SharkBait pulls in order to build Android. Some of
    which I have been working on:
    -   [android_build_blueprint](https://github.com/WantGuns/android_build_soong/commits?author=WantGuns)
    -   [android_build_soong](https://github.com/WantGuns/android_build_soong/commits?author=WantGuns)
    -   [android_build](https://github.com/WantGuns/android_build/commits?author=WantGuns)

## Future Work
There are many things to be concerned with such as the flow of project 
development to follow, how exactly we should aim introducing
arm64 as an host. \
Plus the final goal of SharkBait is the ability to
upgrade its Android container with the use of Portage, thus providing
granular, GNU like updates to Android, quite possibly the first time
ever. Keeping all this in mind we needed a proper roadmap on how to 
achieve this. My vision for it resembles somewhat like the following:

1. Build Android as an whole separate entity on AArch64.
2. Then compose a monolithic ebuild for the exact same thing.
3. Start breaking parts from Android: 
    -   Ship the toolchains used by AOSP separately using Portage and 
        possibly integrate it with crossdev.
    -   Ship the necessary prebuilt [build-tools](https://github.com/LineageOS/android_prebuilts_build-tools) AOSP bundles as
        packages with Portage on arm64.
4. Capitalizing on the fact that AOSP code is highly modular, separate
   those modules into different packages under a common overlay.

And since I consider myself apt in bringing this for SharkBait, I would
love to work on it even after GSoC finishes.

## Acknowledgements
I immensely appreciate the patience of my mentor, Benda Xu. He has
always given me the helm when it comes to SharkBait, while still
actively monitoring my work and helping me out. Without his generous
efforts of providing me with an industry-standard arm64 server, I dont
think I could consider this GSoC a success.

My co-mentors - Pengcheng Xu, Lucas Ramage and Stephen Christie helped
me whenever I got stuck in my work. Pengcheng offered me assistance in
getting UART work for my Phone, Lucas actively kept a lookout on my work
and Stephen would offer me assistance in getting better hardware without
two thoughts.

All of them offered crucial personal help whenever I was stuck, be it my
work, understanding the project or even my proposal writing, something 
which I can never overlook. 

The least I can do to return their favours is to bring SharkBait to all
its glory, which I eagerly wait for.
