+++
title = "Installing Gentoo on Android"
description = "I am tired of re-installing gentoo on my phone by connecting parts from different resources and so here is the guide to do it all in a go."
date = "2020-04-15"
[taxonomies]
tags = ["android", "gsoc2020", "sharkbait"]
+++

I am tired of re-installing gentoo (from an chroot approach) on my phone by connecting parts from different resources and so here is the guide to do it all in a go.

------

_This guide assumes the prerequisite of a rooted phone. Just fire up an adb shell / termux and follow this :_

First we proceed with downloading the correct [stage3 tarballs](http://distfiles.gentoo.org/experimental/arm64/). Copy it in your phone's storage.

Then we make a folder for the Gentoo root. Since we are following SharkBait, we will use `data/gnu` as root. Copy the stage3 into it.
   
```bash
mkdir -p /data/gnu
cp /sdcard/stage3-arm64-* /data/gnu/
cd /data/gnu
```

Then we extract the stage3 

```bash
tar xpvf stage3-* `--xattrs-include='*.*'` --numeric-owner
# no those backticks are not just a content generation error
```

After this we will copy the DNS information in `/etc/resolve.conf` so that networking works after entering the new environment.

```bash
cp --dereference /etc/resolv.conf /data/gnu/etc/
```

Mount the required filesystems:
```bash
cd /
mount -t proc proc /data/gnu/proc
busybox mount --rbind /dev /data/gnu/dev
busybox mount --rbind /sys /data/gnu/sys
```

Finally we enter the new environment:
```bash
chroot /data/gnu /bin/bash
source /etc/profile
export PS1="(chroot) ${PS1}"
```

Add Portage to gid 3003(inet):
```bash
groupadd -g 3003 inet && gpasswd -a portage inet
```

#### Configuring Portage and Emerging Packages:

These for preventing mount errors while emerging:
```bash
mkdir -p /dev/shm
mount -t tmpfs -o nodev,nosuid,noexec,mode=1777,size=6144m tmpfs /dev/shm
mount /dev/pts -o remount,gid=5,mode=620
```

Unless you want to stare at your phone for more than 4 hours, or just have a lot of time, I would recommend you to perform these steps while before going to bed, because this takes time. The best approach would be to do all this in a wake-lock(ed) termux session.

```bash
emerge-webrsync
emerge --ask --verbose --update --deep --newuse @world
```
#### Configuring Timezone and Locales

Set your timezone with the correct one from `/usr/share/zoneinfo` :

```bash
echo "Asia/Calcutta" > /etc/timezone
emerge --config sys-libs/timezone-data
```

Configure locales by uncommenting the correct one from `/etc/locale.gen`.

```bash
locale-gen
eselect locale list
# proceed to chose the desired locale
env-update && source /etc/profile && export PS1="(chroot) ${PS1}"
```


---
I believe I have covered the information required until device specific steps. Now the part left is to add your device specific unofficial overlay, or continue with the official one, if your device is enlisted in it. An upcoming guide will guide you to make your kernel for SharkBait and finally, deploy SharkBait. Deploying SharkBait currently is a breeze for devices shipping with Android version lower than 9. Since mine did not, I would have to hack around the current script. If the results turn out to be positive, expect another blog coming up. Till then, Happy Hacking !