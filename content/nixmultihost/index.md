+++
title = "Single flake, multiple hosts"
date = "2025-03-14"
[taxonomies]
tags = ["yakshaving", "selfhosting", "nix"]
+++

I am done with setting up darwin machines now, and look forward to
expand our nix files to declare state for linux hosts as well. The linux
landscape is vast though, I could be logging into a work server, an
embedded device, a server I rent, my personal workstation, etc. There is
different amounts of state I want similar in these machines. And so it
warrants for a better file structure.

```tree
.
├── flake.lock
├── flake.nix
├── hosts
│   ├── common
│   │   └── default.nix
│   ├── darwin
│   │     ├── common.nix
│   │     └── C02GH2V9MD6M
│   │         ├── default.nix
│   │         ├── git
│   │         │   ├── ola
│   │         │   └── olamessage
│   │         └── home.nix
│   └── linux
│       ├── common.nix
│       └── rigel
│           ├── default.nix
│           └── home.nix
├── lib
│   ├── default.nix
│   ├── deploy.nix
│   ├── mkHomeConfig.nix
│   ├── mkHost.nix
│   ├── mkHostConfig.nix
│   └── utils.nix
└──modules
    └── features
        ├── default.nix
        ├── implementation.nix
        ├── git
        │   ├── config.nix
        │   └── message
        ├── nvim
        │   ├── base.lua
        │   └── treesitter.lua
        ├── tmux
        │   └── tmux.conf
        └── zsh
            ├── p10k.zsh
            └── zshrc
```

## Abstractions

The idea is to basically have common sets of attributes at different
levels - per os and per host.

Also, I don't frequently change my dotfiles, I have the opportunity to
abstract features like if I want neovim to be configured with LSP or
not, basically have a features attribute for home manager.

### modules/features/default.nix

I'll declare all the abstractions for home manager options in this file.

```nix
{ lib, ... }:

with lib;

{
  options.features = {
    editors = {
      nvim = {
        enable = mkEnableOption "neovim editor";
        ui = mkEnableOption "add ui elements";
        lsp = mkEnableOption "neovim LSP and treesitter support";
        # ...
      };
    };

    shell = {
      zsh = {
        enable = mkEnableOption "zsh shell";
        powerlevel10k = mkEnableOption "powerlevel10k theme";
      };
    };

    tmux = mkEnableOption "tmux terminal multiplexer";

    git = {
        enable = mkEnableOption "git with delta";
        delta = mkEnableOption "git-delta";
    };
  };
}
```

### modules/features/implementation.nix

I'll implement the declared options in this file.

```nix
{ config, pkgs, lib, ... }:

let
  cfg = config.features;
  
  toLua = str: "\nlua << EOF\n${str}\nEOF";
  toLuaFile = file: "\nlua << EOF\n${builtins.readFile file}\nEOF";

  fromGitHub = { ref, repo, sha256 ? lib.fakeSha256 }:
    pkgs.vimUtils.buildVimPlugin {
      pname = "${lib.strings.sanitizeDerivationName repo}";
      version = ref;
      src = pkgs.fetchFromGitHub {
        owner = lib.strings.elemAt (lib.strings.splitString "/" repo) 0;
        repo = lib.strings.elemAt (lib.strings.splitString "/" repo) 1;
        rev = ref;
        sha256 = sha256;
      };
    };

  fakeVimPlugin = pkgs.runCommand "fakeVimPlugin" { } "mkdir $out";
in
{
  config = lib.mkMerge [
    {
      home = {
        stateVersion = "24.11";
        packages = with pkgs; [
          ripgrep
        ];
      };

      programs.home-manager.enable = true;
    }

    # Neovim configuration
    (lib.mkIf cfg.editors.nvim.enable {
      programs.neovim = {
        enable = true;
        defaultEditor = true;
        viAlias = true;
        vimAlias = true;
        vimdiffAlias = true;

        plugins = with pkgs.vimPlugins; [
          # Base configuration
          {
            plugin = fakeVimPlugin;
            config = toLuaFile ./nvim/base.lua;
          }
          plenary-nvim
        ] 
        
        # UI Elements - each plugin individually conditioned
        ++ lib.optionals cfg.editors.nvim.ui [
          {
            plugin = fromGitHub {
              ref = "HEAD";
              repo = "bluz71/vim-moonfly-colors";
              sha256 = "c5fxaT8Bc5MzOjJsuU95K9yzTpGqj/7QP4GuLfsY4VE=";
            };
            config = "colorscheme moonfly";
          }
        ]
        
        # LSP and Treesitter
        ++ lib.optionals cfg.editors.nvim.lsp [
          {
            plugin = nvim-treesitter.withAllGrammars;
            config = toLuaFile ./nvim/treesitter.lua;
          }
          {
            plugin = nvim-lspconfig;
            config = toLuaFile ./nvim/lsp.lua;
          }
          {
            plugin = nvim-cmp;
            config = toLuaFile ./nvim/cmp.lua;
          }
          cmp-nvim-lsp
        ]
      };
    })

    # Shell configuration
    (lib.mkIf cfg.shell.zsh.enable {
      programs.zsh = {
        enable = true;
        syntaxHighlighting.enable = true;
        autosuggestion.enable = true;
        enableCompletion = true;
        defaultKeymap = "viins";

        completionInit = ''autoload -U compinit && compinit -u'';

        history = {
          append = true;
          extended = true;
          size = 10000;
          save = 1000000;
        };

        initExtraFirst = builtins.readFile ./zsh/zshrc;

        plugins = lib.optional cfg.shell.zsh.powerlevel10k {
          name = "zsh-powerlevel10k";
          src = "${pkgs.zsh-powerlevel10k}/share/zsh-powerlevel10k/";
          file = "powerlevel10k.zsh-theme";
        };
      };
    })

    # Powerlevel10k configuration
    (lib.mkIf (cfg.shell.zsh.enable && cfg.shell.zsh.powerlevel10k) {
      home.file.".p10k.zsh".source = ./zsh/p10k.zsh;
    })

    (lib.mkIf cfg.tmux {
      programs.tmux = {
        enable = true;
        extraConfig = builtins.readFile ./tmux/tmux.conf;
      };
    })

    (lib.mkIf cfg.git.enable {
      programs.git = {
        enable = true;
        extraConfig = import ./git/config.nix;
        delta.enable = cfg.git.delta;
      };

      home.file.".config/git/message".source = ./git/message;
    })
  ];
}
```

This enables me to have a `hosts/darwin/<hostname>/home.nix` like:
```nix
{ config, pkgs, ... }: {
  features = {
    editors.nvim = {
      enable = true;
      ui = true;
      lsp = true;
    };

    shell.zsh = {
      enable = true;
      powerlevel10k = true;
    };

    git = {
      enable = true;
      delta = true;
    };

    tmux = true;
  };

  programs.git.includes = [ { path = "~/dev/.gitconfig"; } ];
}
```

and the their system config, `hosts/darwin/<hostname>/default.nix` like:

```nix
# Host-specific system configuration
{ config, pkgs, ... }: {
  nix = {
    settings = {
      "ssl-cert-file" = "/opt/nix-and-zscaler.crt";
    };
  };

  users.users."<username>" = {
    shell = pkgs.zsh;
    home = "/Users/<username>";
    packages = with pkgs; [
       xh
       jq
       tree
    ];
  };

  homebrew = {
    enable = true;
    brews = [
     "k9s"
     "kubectl"
    ];
  };
}
```

Pretty simple right ? I can onboard new hosts and create similar "knobs"
to control state quickly.

## Implementation

In this series, we started with a standalone home-manager installation,
then pushed the home-manager configs into our nix-darwin config. 

A layman's definition for a nix flake would be that it accepts some
inputs and returns some outputs. Normally, these inputs are the source
to the definition of the packages you want in your outputs, and your
outputs are json like attribute sets which are parsed by a program like
nixos-rebuild or home-manager and do something with it, like building a
new nix profile.

For my concerns, a nix flake that accepts home-manager, nix-darwin and
nixpkgs of course, and returns a set of `homeConfigurations`,
`darwinConfigurations` and `nixosConfigurations` would make
everything easier. Because then I could then call home-manager,
darwin-rebuild or nix-rebuild on the same flake, which will become a
consolidated source of truth for all my hosts.

### Hosts attribute set

To declare the entrypoints and metadata for different hosts, lets
design a spec for hosts. Ideally I want to also be able to perform
*remote builds* and remote deployments, thats possible for NAT'd hosts
if they are a part of my wireguard mesh. Basically we should declare a
set of reachable IPs (public, private) for every host. And of course the
username, hostname and the system.

Something like this should work:

```nix
hosts = {
  "C02GH2V9MD6M" = {
    hostname = "C02GH2V9MD6M";
    system = "x86_64-darwin";
    username = "gunwant.jain1";
    justHome = false;
    remoteBuild = false;
  };

  "mintaka" = {
    hostname = "mintaka";
    system = "x86_64-linux";
    username = "wantguns";
    remoteBuild = true;
    ips = {
      private = "192.168.1.5";
    };
  };
};
```

I added `justHome` for letting the flake work on just
homeConfigurations, and `remoteBuild` for *building* the nix profile on
the remote host.

Lets make a library function which defines this attribute for us:

### lib/mkHostConfig.nix
```nix
# inside ./lib/mkHostConfig.nix
{ lib, ... }:

let
  utils = import ./utils.nix { inherit lib; };
  inherit (utils) isDarwin isLinux;
in
{
  mkHostConfig = config:
    let
      platform =
        if isDarwin config.system then "darwin"
        else if isLinux config.system then "linux"
        else throw "Unsupported system: ${config.system}";

      defaults = {
        remoteBuild = false;
        justHome = false;
        platform = platform;
      };
    in
    lib.recursiveUpdate defaults config;
}
```

I added a `platform` field for the downstream libraries I will pass our
`hosts` attribute into.

### lib/utils.nix

Here is the `utils.nix` file:
```nix
# inside lib/utils.nix
{ lib, ... }:

let
  isPlatform = system: platform: builtins.match ".*-${platform}" system != null;
  isDarwin = system: isPlatform system "darwin";
  isLinux = system: isPlatform system "linux";
in
{
  inherit isPlatform isDarwin isLinux;
}
```

### lib/mkHost.nix

Next, we'll make a library function that consumes this host attribute
set and returns a `darwinConfiguration` or a `nixosConfiguration`
depending on the `system` and the `platform` fields:

```nix
# inside lib/mkHost.nix
{ lib, inputs, ... }:

let
  utils = import ./utils.nix { inherit lib; };
  inherit (utils) isDarwin isLinux;
in
{
  mkHost =
    hostConfig@{ hostname
    , platform
    , system
    , username ? "wantguns"
    , ...
    }:
    let
      hostDarwin = isDarwin system;
      homeDirectory = if hostDarwin 
                      then "/Users/${username}"
                      else "/home/${username}";

      hmModule = if hostDarwin
                 then inputs.home-manager.darwinModules.home-manager
                 else inputs.home-manager.nixosModules.home-manager;

      hostPath = ../hosts/${platform}/${hostname};
      commonPath = ../hosts/${platform}/common.nix;
      sharedPath = ../hosts/common/default.nix;

      diskoConfigPath = "${hostPath}/disk-config.nix";
      facterJsonPath = "${hostPath}/facter.json";
      hasDiskoConfig = !hostDarwin && builtins.pathExists diskoConfigPath;
      hasFacterJson = !hostDarwin && builtins.pathExists facterJsonPath;

      baseModules = [
        sharedPath
        commonPath
        "${hostPath}/default.nix"
        hmModule
      ];

      linuxModules = if hostDarwin then [] else
        (lib.optional hasDiskoConfig inputs.disko.nixosModules.disko) ++
        (lib.optional hasDiskoConfig diskoConfigPath) ++
        (lib.optional hasFacterJson inputs.nixos-facter-modules.nixosModules.facter) ++
        (lib.optional hasFacterJson {
          facter.reportPath = facterJsonPath;
        });

      systemBuilder = if hostDarwin
                      then inputs.darwin.lib.darwinSystem
                      else inputs.nixpkgs.lib.nixosSystem;
    in
    systemBuilder {
      inherit system;
      specialArgs = { inherit inputs; };
      modules = baseModules ++ linuxModules ++ [{
        nixpkgs = {
          config.allowUnfree = true;
          hostPlatform = system;
        };

        home-manager = {
          useGlobalPkgs = true;
          useUserPackages = true;
          extraSpecialArgs = { inherit inputs; };
          sharedModules = [
            inputs.sops-nix.homeManagerModules.sops
          ];
          users.${username} = { ... }: {
            imports = [
              ../modules/features/default.nix
              ../modules/features/implementation.nix
              "${hostPath}/home.nix"
            ];
          };
        };
      }];
    };
}
```

You must be wondering what is `disko` or `facter` or `sops`, and for
that, I'll be publishing a separate article. For now this config should
still work on darwin hosts, since all the linux related things are not
included if the `system` is darwin.

We are basically calling `nixosSystem` or `darwinSystem` and then using
the homeManager module specific to that system. Since many of our Home
Manager options are abstracted as à la carte features, we need to
include the features module we created.

### lib/mkHomeConfig.nix

Next lets create another library function to create
`homeConfigurations`:

```nix
# inside lib/mkHomeConfig.nix
{ lib, inputs, ... }:

let
  utils = import ./utils.nix { inherit lib; };
  inherit (utils) isDarwin isLinux;
in
{
  mkHomeConfig = hostname: hostConfig:
    let
      system = hostConfig.system;
      username = hostConfig.username;
      platform = if isDarwin system then "darwin" else "linux";
      hostPath = ../hosts/${platform}/${hostname};
      homeDirectory =
        if isDarwin system
        then "/Users/${username}"
        else "/home/${username}";
    in
    inputs.home-manager.lib.homeManagerConfiguration {
      pkgs = inputs.nixpkgs.legacyPackages.${system};
      extraSpecialArgs = { inherit inputs; };
      modules = [
        ../modules/features/default.nix
        ../modules/features/implementation.nix
        "${hostPath}/home.nix"
        {
          home = {
            inherit username homeDirectory;
          };
        }
      ];
    };
}
```

This should be pretty explanatory. You can go through my blogs on
`home-manager` and `nix-darwin` to have a better picture how our
abstraction is growing.

### lib/default.nix

We'll import all of our library functions through the default nix file in this directory.

```nix
# inside lib/default.nix
{ lib, inputs }:

{
  mkHost = (import ./mkHost.nix { inherit lib inputs; }).mkHost;
  mkHomeConfig = (import ./mkHomeConfig.nix { inherit lib inputs; }).mkHomeConfig;
  mkHostConfig = (import ./mkHostConfig.nix { inherit lib; }).mkHostConfig;
  isPlatform = (import ./utils.nix { inherit lib; }).isPlatform;
  isDarwin = (import ./utils.nix { inherit lib; }).isDarwin;
  isLinux = (import ./utils.nix { inherit lib; }).isLinux;
}
```

### flake.nix

Finally, we have all the required nix code to iterate our flake:

```nix
{
  description = "Nix System Configurations";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    darwin.url = "github:lnl7/nix-darwin/master";
    home-manager.url = "github:nix-community/home-manager";
    disko.url = "github:nix-community/disko/latest";
    nixos-facter-modules.url = "github:numtide/nixos-facter-modules";
    sops-nix.url = "github:Mic92/sops-nix";

    darwin.inputs.nixpkgs.follows = "nixpkgs";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
    disko.inputs.nixpkgs.follows = "nixpkgs";
    sops-nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = inputs@{ self, nixpkgs, darwin, home-manager, ... }:
    let
      lib = nixpkgs.lib.extend (final: prev: {
        my = import ./lib { inherit inputs; lib = prev; };
      });

      systems = [ "x86_64-linux" "x86_64-darwin" "aarch64-linux" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;

      hosts = {
        "C02GH2V9MD6M" = lib.my.mkHostConfig {
          hostname = "C02GH2V9MD6M";
          system = "x86_64-darwin";
          username = "gunwant.jain1";
          justHome = false;
          remoteBuild = false;
        };

        "mintaka" = lib.my.mkHostConfig {
          hostname = "mintaka";
          system = "x86_64-linux";
          username = "wantguns";
          remoteBuild = true;
          ips = {
            private = "192.168.1.5";
          };
        };
      };

      forAllHosts = f: builtins.mapAttrs f hosts;

    in
    {
      inherit hosts;

      darwinConfigurations = builtins.mapAttrs
        (name: hostConfig: lib.my.mkHost hostConfig)
        (lib.filterAttrs (name: hostConfig: lib.my.isDarwin hostConfig.system) hosts);

      nixosConfigurations = builtins.mapAttrs
        (name: hostConfig: lib.my.mkHost hostConfig)
        (lib.filterAttrs (name: hostConfig: lib.my.isLinux hostConfig.system) hosts);

      homeConfigurations = forAllHosts lib.my.mkHomeConfig;
    };
}
```

Simple enough, we can now use this flake for multiple tools:

```bash
# for home-manager
nix run github:nix-community/home-manager/master -- switch --flake .#"hostname"

# for darwin-rebuild
nix run github:lnl7/nix-darwin/master#darwin-rebuild -- switch --flake .#"hostname"

# for nixos-rebuild
nix run nixpkgs#nixos-rebuild -- switch --flake .#"hostname"
```

## Remote deployment & Flake apps

I also want the ability to execute these commands remotely and push
changes remotely to all my hosts. There are a few tools which are
popular - `deploy-rs`, `colmena`, `clan.lol`. I tried each of them and found
out that:  
- **Colmena** does not support hosts of different systems in the same flake ([issue](https://matrix.to/#/#colmena:nixos.org/$zmv3rJLkqDapZUTVuH3QFtZnw7f8wgz8FbKI9srWFN8))  
- **Deploy-rs** does not support **building on remote**, it only supports copying the build artifacts to remote ([issue](https://github.com/serokell/deploy-rs/issues/300))  
- **Clan.lol** is too restrictive for my taste  

I recently found out that nixos-rebuild has the remote build ability innately:
```bash
nix run nixpkgs#nixos-rebuild -- switch \
  --flake .#"$HOSTNAME" \
  --build-host "$USERNAME@$IP" \
  --target-host "$USERNAME@$IP" \
  --use-remote-sudo \
  --fast \
  --use-substitutes \
  --option builders-use-substitutes true
```

this command will build the nixosConfiguration remotely and activate it
as well. This is great, we naturally reduce our dependencies for a
deployment tool. Now we can just create a new [flake app](https://nix.dev/manual/nix/2.18/command-ref/new-cli/nix3-run#apps) and call `nix run` on our flake:

```nix
# inside flake.nix

# ... rest of the config
      homeConfigurations = forAllHosts lib.my.mkHomeConfig;

      apps = forAllSystems (system: {
        deploy = {
          type = "app";
          program = "${import ./lib/deploy.nix { 
            pkgs = nixpkgs.legacyPackages.${system}; 
            inherit nixpkgs;
          }}/bin/deploy";
        };
      });
  }
```

and our deploy app is basically a shell script:

```nix
# inside lib/deploy.nix
{ pkgs, nixpkgs }:

pkgs.writeShellScriptBin "deploy" ''
  #!/usr/bin/env bash
  set -e

  RAW_HOSTNAME=''${1:-$(hostname)}
  HOSTNAME=$(echo "$RAW_HOSTNAME" | cut -d '.' -f 1)
  REMOTE_BUILD=''${2:-false}

  SYSTEM=$(nix eval --raw .#hosts."$HOSTNAME".system)
  USERNAME=$(nix eval --raw .#hosts."$HOSTNAME".username)
  JUST_HOME=$(nix eval --json .#hosts."$HOSTNAME".justHome 2>/dev/null | grep -q "true" && echo "true" || echo "false")
  REMOTE_BUILD_ENABLED=$(nix eval --json .#hosts."$HOSTNAME".remoteBuild | grep -q "true" && echo "true" || echo "false")

  deploy_home() {
    local host=$1
    local remote=$2
    echo "Deploying home configuration for $host..."
  
    if [ "$remote" == "true" ]; then
      ssh "$USERNAME@$IP" "nix run 'github:nix-community/home-manager/master' -- switch --flake '.#$host'"
    else
      nix run github:nix-community/home-manager/master -- switch --flake .#"$host"
    fi
  }

  if [[ "$REMOTE_BUILD" == "true" && "$REMOTE_BUILD_ENABLED" == "true" ]]; then
    PUBLIC_IP=$(nix eval --raw .#hosts."$HOSTNAME".ips.public 2>/dev/null || echo "")
    PRIVATE_IP=$(nix eval --raw .#hosts."$HOSTNAME".ips.private 2>/dev/null || echo "")
  
    IP="$PUBLIC_IP"
    if ! ping -c 1 -W 1 "$IP" &>/dev/null && [ -n "$PRIVATE_IP" ]; then
      IP="$PRIVATE_IP"
    fi
  
    if [ -z "$IP" ]; then
      echo "Error: No IP address available for remote build"
      exit 1
    fi
  
    if [[ "$JUST_HOME" == "true" ]]; then
      deploy_home "$HOSTNAME" true
    else
      echo "Deploying to $HOSTNAME ($IP) with remote build..."
    
      if [[ "$SYSTEM" == *"-linux" ]]; then
        nix run nixpkgs#nixos-rebuild -- switch \
          --flake .#"$HOSTNAME" \
          --build-host "$USERNAME@$IP" \
          --target-host "$USERNAME@$IP" \
          --use-remote-sudo \
          --fast \
          --use-substitutes \
          --option builders-use-substitutes true
      else
        nix run github:lnl7/nix-darwin/master#darwin-rebuild -- switch \
          --flake .#"$HOSTNAME" \
          --build-host "$USERNAME@$IP" \
          --target-host "$USERNAME@$IP" \
          --fast
      fi
    fi
  else
    if [[ "$JUST_HOME" == "true" ]]; then
      deploy_home "$HOSTNAME" false
    else
      echo "Deploying to $HOSTNAME locally..."
    
      if [[ "$SYSTEM" == *"-linux" ]]; then
        sudo nix run nixpkgs#nixos-rebuild -- switch --flake .#"$HOSTNAME"
      else
        nix run github:lnl7/nix-darwin/master#darwin-rebuild -- switch --flake .#"$HOSTNAME"
      fi
    fi
  fi
''
```

Now we can run commands like:

```bash
# Deploy to current host
nix run .#deploy

# Deploy to specific host
nix run .#deploy -- mintaka 

# Deploy to specific host with remote build
nix run .#deploy -- mintaka true
```

## Future

I have uploaded these files on my [github](https://github/wantguns/dotfiles). I
will keep tracking them and hopefully make abstractions for easier syncing if
necessary.

Since we now have a good abstraction for our hosts, I am going to start
using this flake alongside nixos-anywhere and nixos-infect to start
installing nix on my servers. The plan is to onboard them and build a
wireguard mesh, and a K3S cluster. Starting with my Dell Optiplex 3040, `mintaka`.
