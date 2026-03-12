+++
title = "Nix Darwin"
date = "2025-03-08"
[taxonomies]
tags = ["yakshaving", "selfhosting", "nix"]
+++

Lets expand on our flake from before and also make system level changes
like `KeyInputDelay`:

This is the new `flake.nix`:

<details>
  <summary>flake.nix</summary>

```nix
{
  description = "Home Manager configuration of gunwant.jain1";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    darwin = {
        url = "github:lnl7/nix-darwin/master";
        inputs.nixpkgs.follows = "nixpkgs";
    };

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs@{ self, nixpkgs, darwin, home-manager, ... }:
    let
      system = "x86_64-darwin";
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      darwinConfigurations."<hostname>" = darwin.lib.darwinSystem {
        inherit system;
        specialArgs = { inherit inputs; };
        modules = [ 
            ./configuration.nix
            home-manager.darwinModules.home-manager
            {
                home-manager.useGlobalPkgs = true;
                home-manager.useUserPackages = true;
                home-manager.users."<username>" = import ./home.nix;
            }
        ];
      };
    };
}
```

</details>

You'll notice that we have abstracted the home manager outputs and are
now using them as modules inside the nix-darwin configuration modules.

And here is the `configuration.nix` module:

<details>
  <summary>configuration.nix</summary>

```nix
{ config, pkgs, ... }:

{
  imports = [

  ];
  nix = {
    package = pkgs.nix;
    settings = {
      "extra-experimental-features" = [ "nix-command" "flakes" ];
    };
  };

  nixpkgs.config.allowUnfree = true;

  users.users."<username>" = {
    shell = pkgs.zsh;
    home = "/Users/<username>";
    packages = with pkgs; [
       xh
       jq
    ];
  };

  homebrew = {
    enable = true;
    brews = [
     "k9s"
     "kubectl"
    ];
  };

  system.stateVersion = 6;

  system.defaults = {
    finder = {
      AppleShowAllExtensions = true;
      ShowPathbar = true;
      FXEnableExtensionChangeWarning = false;
    };

    NSGlobalDomain = {
      InitialKeyRepeat = 10;
      KeyRepeat = 1;
    };
  };
}
```

</details>

## File tree

After making the required changes, this is how my file tree looks like:
```plain
├── flake.nix           ---> Edited
├── flake.lock          ---> Edited
├── configuration.nix   ---> New
├── git
│   ├── config
│   ├── message
├── home.nix
├── nvim
│   ├── base.lua
│   └── treesitter.lua
├── tmux
│   └── tmux.conf
└── zsh
    ├── p10k.zsh
    └── zshrc
```

## Commands

Use `darwin-rebuild`:
```bash
darwin-rebuild switch --flake .
```
## Future

With a couple of files, we can now control mostly everything about my
mac host. But we can expand this further.

`deploy-rs` allows us to deploy nix profiles to a host machine (using ssh)
and activate them. This is helpful because now we can abstract both
nix-darwin and nixos hosts as just profiles.
