+++
title = "Setting up my homelab and cloud with Nix"
date = "2025-03-04"
[taxonomies]
tags = ["yakshaving", "selfhosting", "nix"]
+++


I have been maintaining a set of cloud servers, for the purpose of
selfhosting a ton of software, VPNs, and random experimentation.
Recently, I bought a Dell Optiplex 3040 for Rs. 5000 ($60), and I am
planning to revamp all my scattered scripts and make orchestration easy
for a one person team.

### Tradeoffs

I have a pragramtic approach to selfhosting. Until now, I have only used
traefik 2.0, docker-compose, caddy. I do have lots of services running
and I wanted an orchestration solution which is flexible. Web apps are
mostly running on cloud native technology nowadays, and so Kubernetes
stood out easily.

As a selfhoster, I can foresee changes in infrastructure less often, and
so I don't exactly want to treat my servers as cattle. I want to be able
to audit everything and easily onboard new hosts though. Ansible is a
good option, but it feels like a leaky abstraction for IaC. I am going
to go yolo on nix and see how far it can take me.

### Concepts

I have had multiple scattered thoughts on what designs fits best for my
needs, and I have realised:
- a terminal session is my forte, I want to be able to replicate my
  dotfiles on new hosts.
- I am fine with running NixOS as my userland. I can also run nix-darwin
  on Macbooks.
- I am going to hand over all the hardware and os-level configuration to
  Nix, and will use a deployment tool like deploy-rs.
- I want all of my nodes to form a mesh, preferrably using wireguard,
  and preferrably not using proprietary tools like Tailscale, need to
  make a tradeoff for that.
- I want to orchestrate selfhosted services over different nodes, with
  affinities and selectors and resource constraints. I'll use
  Kubernetes, or K3s, more accurately to acheive this.
- I also like Gitops, mostly for the auditing and single source of truth
  features. Planning to use FluxCD and Github for gitops.

With a setup like this, I will be able to setup new servers and handle
any sort of load pretty quickly. The good thing with nix is that we can
also have tiers based on how much control I want to give to new
hardware, I might just want my normal terminal session on a contract
work's server.

### Dev logs

I am going to start blogging about my journey, here is timeline i'll
keep updating:

- [x] [Home Manager](/homemanager)
- [x] [Nix Darwin](/nixdarwin)
- [x] [Single Flake Multiple Hosts](/nixmultihost)
    - files available on [github](https://github.com/wantguns/dotfiles)
- [x] [Setting up Mintaka and Bellatrix](/nixos-anywhere)
- [ ] Setting up a Wireguard network
