+++
title = "Booting Gentoo from SAR-Preinit; or Debugging the init, the Hard Way"
description = "As you would know from my previous [blog](@/blog/uart_on_lavender/index.md), I couldn't make the UART work for my phone. Since without a serial console, the boot-up process is no less than a black-box, I decided to use some hacky debugs for finding out what went wrong with the original `preinit`."
date = "2020-06-06"
[taxonomies]
tags = ["android", "gsoc2020", "sharkbait"]
+++

As you would know from my previous [blog](@/blog/uart_on_lavender/index.md), I couldn't make the UART work for my phone. Since without a serial console, the boot-up process is no less than a black-box, I decided to use some hacky debugs for finding out what went wrong with the original `preinit`. If you're not in for the process of going through it and just want to cut to the chase, jump onto this [section](@/blog/booting_gentoo_using_preinit/index.md#final-comments-and-what-to-follow-next). 

---

## Circumventing System-As-Root

So, flashing a `preinit` failed for me. Again this was because of the changes in the boot-process of newer Android devices. If you have no clue about this, I would recommend reading this [blog](@/blog/android_boot_high_jinks/index.md). 

What we needed to change was the behaviour of our kernel to take the `ramdisk` provided to it in the `boot.img` as its `rootfs`. @topjohnwu suggested in his [infamous xda comment](https://forum.xda-developers.com/apps/magisk/pixel-2-pixel-2-xl-support-t3697427/post74361728#post74361728) that it could be achieved by substituting the `skip_ramdisk` string with any other. I tried doing this but it make the device boot straight up to Lineage (which we do not want). 

Then I looked into what goes on under-the-hood when Magisk is flashed. It seems that Magisk hexpatches the kernel with some specfic strings which ultimately leads the kernel to take the ramdisk inside `boot.img` as its `rootfs`. 
I double checked by cpio'ing the `magiskinit64` binary into an `ramdisk.cpio` incpio and then patching the kernel image using `magiskboot`, in a similar fashion to that of Magisk. Then packed the stuff into a `boot.img` (ofc including a bootimg.cfg).

Now remember, since we have patched the kernel, the kernel would take the `magiskinit64` as its init and exec it. Then `magiskinit64` would ultimately mount `/system` as root and exec the `/system/bin/init` thus entering the Android land. 

And so we did. Lineage booted up. To cross-check, I also tried to boot using a boot.img without `magiskinit64` as its init. It did not reach the Android land.

And so I adopted this approach for circumventing SAR. But using `preinit` as the init inside `boot.img` still did not boot Gentoo up. So we come to the debugging phase.

## The Debugging Phase (skippable)

The lack of a serial console, made me come up with some ugly debugs. First I tried to access the `last_kmsg` and `console-ramoops-0` for getting the kernel logs from the previous reboot. But I didn't get any. I double checked my kernel defconfig whether I had the correct options enabled and yes they were. 

At this point, I wan't even unhappy. Time for a new debug method. What occured to me next was that we could `sleep` the init script between certain steps and time the process of my phone bootlooping. For a reference value, I recorded the time it took my phone to boot-loop without any `sleep`. I prepared myself for a night of constant phone reboots. The table below describes the entire process until finally booting Gentoo with insightful comments at the end.

|Attempt|Time (in sec)|Remarks|Commit|
|:-----:|:-----------:|:-----:|:----:|
|1	|10	|reference|[link](https://gitlab.com/WantGuns/sar-preinit/-/commit/2037d2b9523f9c954b18d6efe85c803cac432563)|
|2	|20	|test `sleep`|[link](https://gitlab.com/WantGuns/sar-preinit/-/commit/195c4d40a30bd412c8574d670432098ed1fd4ed9)|
|3  |30	|failed to mount at `/userdata`|[link](https://gitlab.com/WantGuns/sar-preinit/-/commit/15c1f7ae1c60983141f5f96e82d47c924e075d53)|
|4	|41	|kernel panics|[link](https://gitlab.com/WantGuns/sar-preinit/-/commit/b373d65a132363d58d608d354e82f1469cc3d289)|
|5	|41	|abandoning this approach|[link](https://gitlab.com/WantGuns/sar-preinit/-/commit/a5b6ac35c2822fb516bc471f4387a784308f94d3)|
|6	|21	|couldn't mount `/dev`|[link](https://gitlab.com/WantGuns/sar-preinit/-/commit/3db8942d0c31cc3b3184962a4eea403cc6e49bc5)|
|7	|35	|`/dev` is mounted|[link](https://gitlab.com/WantGuns/sar-preinit/-/commit/4af274df4fcda6ad05c63e6d8caca3cd3c422b47)|
|8	|60+|Gentoo boots|[link](https://gitlab.com/WantGuns/sar-preinit/-/commit/f786531094daf77b7a0877177f9888d5d9e9b750)|

3. At this point, I found out that the kernel could mount the userdata partition. I also realised that I was not getting last_ksmg because the kernel was not panicking and instead just `exit`ing. So I tried to get the `last_kmsg` next.
4. I tried to forcefully panic the kernel. And got the `last_kmsg` and `console-ramoops-0` in the next boot. But they didnt have the parts where kernel logged the Preinit messages. So I thought that giving them a higher priority would make them get picked by the `last_kmsg` and it didn't help either.
5. Finally I abandoned this approach.
6. Then I looked into mounting the pseudo-filesystems. I realised that the kernel could not mount /dev.
7. I realised that using `tmpfs` instead of `devtmpfs` mounts the `/userdata`. What I did not know at that time that my kernel did not have the options for `devtmpfs` enabled in its `defconfig`, this all could be avoided.
8. `/dev` mounts now, but we have to populate it as well.

I did not have just 8 attempts, the [commit history](https://gitlab.com/WantGuns/sar-preinit/-/commits/timer) would show that I forgot that my kernel was SELinux Enforcing, I had to change that among many other things. Robert Landley's [blogs](https://landley.net/writing/) on initramfs helped me get to know the very basics of an initramfs.

## Final comments and What to follow next

My [sar-preinit](https://gitlab.com/WantGuns/sar-preinit) repository holds the current workflow of getting a SAR-enabled device boot Gentoo in the Android based device. The Makefile is pretty self-explanatory but still, if you want to follow the process:
1. Install Gentoo in you phone following this [blog](@/blog/install_gentoo/index.md).
2. Extract the `boot.img` from you Android phone. At the time of writing this blog, we dont have changing `selinux` modes automated. Please make sure that you do that first by adding `androidboot.selinux=permissive` string at the end of the kernel commandline in `bootimg.cfg`.
3. Rename `boot.img` to `ogboot.img` and place it inside the artifacts folder.
4. Fire up a terminal and run 
```bash
make bootimg_chute
```
5. Flash the `boot_mod.img` created inside the `out` directory on your phone, preferably using `fastboot boot`, if you're not that confident. `fastboot boot` somehow doesn't work for my device, but that's going off-track.
6. Since we haven't figured out the Android in LXC part yet, the best you could do to check your Gentoo boot, is to reboot into the recovery, fire up adb and check the `/data/gnu/var/log/` directory for `dmesg` or any other logs.

I plan to merge this entire workflow into SharkBait, so that you don't have to go through the hassle of doing it all.

---
I should have already mentioned this somewhere, but if I didn't, I should tell the readers that all is based on the [SharkBaitOS](https://www.shark-bait.org/) established mostly by @KireinaHoro. The [`preinit`](https://github.com/KireinaHoro/preinit) I used as a template was the original one from SharkBaitOS. In order to have a better understanding about this project I would recommend the readers to have a look at [KireinaHoro's Blogs](https://jsteward.moe/) as well.

In my next blog, I will discuss about getting Android 9+ to work inside a LXC-Container, in the Gentoo land. I have yet to achieve doing that myself. Hopefully we will reach there soon.

Until then, Happy Hacking !
