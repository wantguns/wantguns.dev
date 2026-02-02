+++
title = "nixos-anywhere"
date = "2025-04-10"
[taxonomies]
tags = ["yakshaving", "selfhosting", "nix"]
+++

`nixos-anywhere` is a cool tool which can be used to installed nixos on:
- an existing linux installation using kexec
- a baremetal machine
- and both of those options remotely using ssh

It is a part of the [nix-community](https://github.com/nix-community) suite,
and works well with
[nixos-facter](https://github.com/nix-community/nixos-facter) for specifying
the hardware configuration and [disko](https://github.com/nix-community/disko)
for declarative disk layout management.

It is meant to run once and if successful you are left with your
desired NixOS configured according to your `nixosConfigurations`.

## Setting up my physical homeserver

Let's set up the Dell Optiplex 3040 I am going to use as my homeserver. I'll
call this host `mintaka`.

The Optiplex was set to boot on BIOS by default, I changed that to UEFI
from the motherboard settings.

### Adding the host to the flake

<details>
  <summary>Simply define the host in the flake.nix</summary>

  ```nix
  # inside flake.nix
  hosts = {
      # ...

      "mintaka" = lib.my.mkHostConfig {
        hostname = "mintaka";
        system = "x86_64-linux";
        username = "wantguns";
        remoteBuild = true;
        ips = {
          private = "192.168.1.130";
        };
      };
  }
  ```
  
</details>

### Booting

First, I created a bootable disk using an iso which supports
`nixos-facter`, I am using
[nixos-community/nixos-images](https://github.com/nix-community/nixos-images)

And boot it on `mintaka`, add my ssh key:
```bash
mkdir -p .ssh; echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHcueIcj4fgzD6cUUGqituoupjexNNF1Hjrr+dyJ+gvA gunwant.jain@C02GH2V9MD6M.local" >> .ssh/authorized_keys
```
### nixos-facter

I am going to generate the hardware configuration for `mintaka` using
nixos-facter:
```bash
nixos-facter > hosts/linux/mintaka/facter.json
```
I'll add this copy of `facter.json` to my nix flake.

### disko

Next, I'll declare my disk layout. I am choosing to try ZFS for the
first time. Other machines that I own run on BTRFS, and I haven't faced
any data loss as of now, but I also wanted to give OpenZFS a shot:

```nix
# inside hosts/linux/mintaka/disk-config.nix
{
  disko.devices = {
    disk = {
      main = {
        type = "disk";
        device = "/dev/sda";
        content = {
          type = "gpt";
          partitions = {
            ESP = {
              size = "512M";
              type = "EF00";
              content = {
                type = "filesystem";
                format = "vfat";
                mountpoint = "/boot";
                mountOptions = [ "defaults" ];
              };
            };
            zfs = {
              size = "100%";
              content = {
                type = "zfs";
                pool = "zroot";
              };
            };
          };
        };
      };
    };
    zpool = {
      zroot = {
        type = "zpool";
        rootFsOptions = {
          mountpoint = "none";
          compression = "zstd";
          acltype = "posixacl";
          xattr = "sa";
          atime = "off";
          relatime = "on";
          "com.sun:auto-snapshot" = "false";
        };
        options = {
          ashift = "12";
          autotrim = "on";
        };

        datasets = {
          "root" = {
            type = "zfs_fs";
            mountpoint = "/";
          };
          "root/nix" = {
            type = "zfs_fs";
            mountpoint = "/nix";
          };
          "root/var" = {
            type = "zfs_fs";
            mountpoint = "/var";
          };
          "root/var/log" = {
            type = "zfs_fs";
            mountpoint = "/var/log";
          };
          "root/home" = {
            type = "zfs_fs";
            mountpoint = "/home";
          };
          "root/swap" = {
            type = "zfs_volume";
            size = "4G";
            content = {
              type = "swap";
            };
            options = {
              volblocksize = "4096";
              compression = "zle";
              logbias = "throughput";
              sync = "always";
              primarycache = "metadata";
              secondarycache = "none";
              "com.sun:auto-snapshot" = "false";
            };
          };
        };
      };
    };
  };
}
```

I had already configured our nix flake to include the modules for disko
and our facter config with the nixosSystem builder in a previous blog [^1].

### Installing

We can finally use the nix flake to install NixOS on `mintaka`.
`nixos-anywhere` looks for nixosConfiguration in the flake. I copied the
nix flake to the host and ran:
```bash
nix run github:nix-community/nixos-anywhere -- --flake .#mintaka --target-host root@127.0.0.1 --build-on remote
```

And after some time, the machine rebooted and I was presented with a
fresh OS install, with all my dotfiles and settings configured. For the
up-to-date summary of changes I have made on my host, I can now refer to
its [git history](https://github.com/wantguns/dotfiles/commits/nix/hosts/linux/mintaka)

## Setting up my Oracle VM

Back when Oracle generously started handing out free instances, I
quickly got one in the Mumbai region. Oracle's choices for host
operating systems were limited and I went ahead with Ubuntu Linux at
that time.

It is a meaty 4 arm64 core and 24GiB ram server, which I definetely want
to include in my fleet of servers. It also acted as test bed for remote
installtions and its the first and only arm64 machine in my fleet.

I am naming this server `bellatrix`. Let's get started.

### Facter

This VM was so old that facter failed to get some udev environment
variables which were added 2 years ago in systemd. I worked around this
by checking systemd's codebase history and posted my method on a
recently open github issue (now closed):   
    [nix-community/nixos-facter #184](https://github.com/nix-community/nixos-facter/issues/184#issuecomment-2746239524)

### Adding the host on my flake

I can finally bear the fruits of my labor, adding a new host is as easy
as adding a new commit:  
    [wantguns/dotfiles: hosts: onboard bellatrix](https://github.com/wantguns/dotfiles/commit/7580411c0ecb7f2f8a3dbcc1f1589b4e5c5867cb)

Here is the host attribute set entry:
```nix
"bellatrix" = lib.my.mkHostConfig {
  hostname = "bellatrix";
  system = "aarch64-linux";
  username = "wantguns";
  remoteBuild = true;
  ips = {
    public = "<public-ip>";
  };
};
```
And this is disk config:
```nix
# Preserving the original fs layout
{
  disko.devices = {
    disk = {
      main = {
        device = "/dev/sda";
        type = "disk";
        content = {
          type = "gpt";
          partitions = {
            ESP = {
              size = "100M";
              type = "EF00";  # EFI System Partition
              content = {
                type = "filesystem";
                format = "vfat";
                mountpoint = "/boot";
              };
            };
            root = {
              size = "100%";  # Use all remaining space
              content = {
                type = "filesystem";
                format = "ext4";
                mountpoint = "/";
                extraArgs = ["-L" "cloudimg-rootfs"];  # Preserve the LABEL from fstab
              };
            };
          };
        };
      };
    };
  };
}
```

I decided to not tinker with the original disk layout a lot.

### Installing using kexec

With the host added and configured, I had to run a single command to
install NixOS through `kexec` (thus overwriting the Ubuntu image):

```bash
nix run github:nix-community/nixos-anywhere -- --flake .#bellatrix --target-host root@<public-ip> --build-on remote
```

## Concluding

Nix is helping me a lot to simplify operating a fleet of servers
declaratively. I can now make more changes to any of these servers by
running our `deploy` nix flake app:
```bash
nix run .#deploy -- mintaka true
nix run .#deploy -- bellatix true
```

I can run this command from a remote machine which has SSH access to the
target machine, and it just works.

Up next, I am going to try to create a common Wireguard
network between `mintaka` and `bellatrix` and try to create abstractions
which would make it easier for me to onboard a new Wireguard peer on my
fleet.

---
[^1]: https://wantguns.dev/nixmultihost/#lib-mkhost-nix
