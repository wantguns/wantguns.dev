+++
title = "Android Boot High Jinks: And What it Means for SharkBait"
description = "Attempts at finding measures and ways we could use to deal with System-As-Root devices for SharkBaitOS"
tags = ["android", "gsoc2020", "sharkbait"]
date = "2020-06-01"
+++

Presently, SharkBait aims at devices launching with Android version lower than 9. I will discuss few ways we could the port this setup to newer devices, whose boot mechanisms are different. We shall also address the boot process of SharkBait and what System-As-Root actually is.

---

## The Boot process of present-day SharkBait

1. Swapping the Android's `init` with [`preinit`](https://gitlab.com/sharkbaitOS/bootstrap/preinit)
   - We swapped the `init` executable present in a functioning boot.img with KireinaHoro's `preinit`.
   - Preinit was responsible for early-mounting partitions and finally switch_root to Gentoo's init, thus firing OpenRC.
   - The "swapping" was essentially replacing a normal Android `boot.img`'s `ramdisk`'s init with `preinit`, and then flashing the new `boot.img`.
   - After OpenRC is fired, it starts the lxc.android service.

2. The Android lxc container.
   - Prior to swapping inits, we established an lxc container in the Gentoo userland.
   - The Android rootfs (at that time it was __ramdisk__ *inside the boot.img*), is extracted in the lxc container's rootfs folder.
   - Android boots inside the container easily.
   - The lxc container's `config` might provide some insights as well:

```txt
lxc.uts.name = android
lxc.rootfs.path = /var/lib/lxc/android/rootfs
lxc.init.cmd = /init
lxc.net.0.type = none
lxc.autodev = 0

lxc.hook.pre-start = /var/lib/lxc/android/pre-start.sh
lxc.hook.post-stop = /var/lib/lxc/android/post-stop.sh
lxc.cgroup.cpu.rt_runtime_us = 950000
```

This is just a gist of what happened. There was a lot more involved.
Gentoo's `fstab` was tweaked such that it mounted the device blocks and binded them to the container for Android's use.
Also KireinHoro managed to make a [working real-time group scheduling model](https://wiki.gentoo.org/wiki/Android/SharkBait/Starting_Android_in_LXC) by the use of cgroups.

## Changes in Android 9+ devices

Well, Google has made it very confusing to follow their language in the [AOSP docs](https://source.android.com/devices/bootloader/system-as-root), I found that [Magisk's Documentation](https://topjohnwu.github.io/Magisk/boot.html) is very insightful.
Basically, Android Kernels dont use ramdisks as their `rootfs` now. The [older ramdisks](https://source.android.com/devices/bootloader/system-as-root#partition-layouts-nonabdevices) found inside a `boot.img` are now merged inside system.img.

### This poses some challenges

- What do we use now as lxc-container's rootfs
- If the kernel does not take a ramdisk inside the `boot.img` as its rootfs, how do we perform the "`init` <-> `preinit` swaps".

**Turns out Magisk already has some workarounds.**

### Magisk's approach to System-As-Root

In order to circumvent the new system.img-as-rootfs approach, Magisk hexpatches the device's Kernel to use the `ramdisk` inside `boot.img` as rootfs. The hexpatch essentially is just replacing the `skip_initramfs` with `want_initramfs` (could be any 4 lettered word instead as well) from the Kernel commandline. But replacing it from the extracted `bootimg.cfg` of a `initrd.img` did not work for me. So I stick to using hexpatching using `magiskboot`.

Then Magisk patches the original `boot.img` by adding a new `ramdisk.cpio` incpio inside it.
The new `ramdisk` has `magiskinit` disguised as `init`.
[Source](https://topjohnwu.github.io/Magisk/deploy.html#systemless)

```bash
# original System-As-Root ramdisk #####
	.

# ramdisk after flashing Magisk #######
	.
	|- .backup/
	`- init
```

`magiskinit` is responsible for :

- Early mounting required partitions. On system-as-root devices, we will switch root to system.
- Injecting magisk services into `init.rc`.
- Loading sepolicy either from `/sepolicy`, precompiled `sepolicy` in vendor, or compiling split sepolicy.
- Patching sepolicy rules and dump to `/sepolicy` or `/sbin/.se` and patching init or `libselinux.so` to load the patched policies
- Executing the original init to start the ordinary boot process

This is conceptually somewhat similar to KireinaHoro's approach at Preinit.

## My approach to revise SharkBait

I have two approaches. Both approaches have some commonality. We apply the same hexpatch which Magisk applies, to the custom kernel which is already lxc-enabled. This forces the kernel to use the `ramdisk` inside the `boot.img` as its `rootfs`.
Then we package a new `boot.img` which had KireinaHoro's `preinit` as its `init`. I assume, this enables the kernel to fire up Gentoo's init and eventually start the lxc-container on the way while Gentoo is booting up.

We make the edits to the `fstab` at the `/vendor` partition (which as you might guess, is another change made by google), in order to provide Android with the correct mounts in Gentoo's userland.
Another change made by google was the decision to parse the cgroup mounts using `/etc/cgroups.json` instead of the original parsing `init.rc` approach. [Source](https://source.android.com/devices/tech/perf/cgroups).
Fortunately this might not affect us as we dont need to mount any new cgroup. We make edits in the `init.rc` for bind-mounting the container's pseudofs(s).

### 1. w/ Magisk

The differences arises in what we use as the `rootfs` for our lxc-container.
The approach I already followed, required using only magiskinit as the `rootfs`.
I expected `magiskinit` to follow its approach and eventually mount all the required device blocks inside the Android userland. Then finally switch to `/system` as the rootdir.
This was the method which failed, causing my device to bootloop.

### 2. w/o Magisk (untriaged)

This approach requires to use entire `system.img`, extracted, as `rootfs`.
The `init` used here is the Android's original `init`.
Since every file required of the merged ramdisk is present in the `rootfs`, I expect that `init` fires up smoothly.

Except that since `system.img` should already be mounted by the kernel in a system-as-root device, We might have to mount it manually. [Source](https://android.googlesource.com/platform/system/core/+/master/init/README.md#early-init-boot-sequence).

---

_P.S. This article was already written in drafts a few weeks ago, the next paragraphs serve no purpose other than that of history. I will be writing more articles explaining what happened afterwards in order to provide a smoother and realistic reading experience._

Without the use of a serial console, this whole "trace-fest" is difficult to understand. Finding out what went wrong, is on an entirely different level.

We have no dmesg logs as they get overwritten by the recovery boot, which in turn is what I require to check the dmesg logs.
Since the kernel does not panic and the `init` just `exit`s, we have no `last_kmsg` or `console-ramoops` logs either.
Fortunately spending a lot of time researching I found [this](https://wiki.postmarketos.org/wiki/Xiaomi_Redmi_Note_7_(xiaomi-lavender)).
My device has a serial-console baked in. Although accessing it would require taking out the phone's glass back, it is worth the fruit.
