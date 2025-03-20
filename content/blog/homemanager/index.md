+++
title = "Home Manager"
date = "2025-03-06"
[taxonomies]
tags = ["yakshaving", "selfhosting", "nix"]
+++

I am going to start hacking nix code on my macbook first. Home Manager
is a unobstrusive entry-point to the nix world. You need to first
install nix with flakes. Use the [determinate installer](https://github.com/DeterminateSystems/nix-installer).

Once thats done, create a new directory in your development folder, lets
say `nixhome`, and create a `flake.nix`:
```nix
{
  description = "Home Manager configuration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs@{ self, nixpkgs, home-manager, ... }:
    let
      system = "x86_64-darwin";
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      homeConfigurations."play" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [
          ./home.nix
        ];
      };
    };
}
```

and a `home.nix` file:
```nix
{ config, pkgs, lib, ... }:

let
  toLua = str: "\nlua << EOF\n${str}\nEOF";
  toLuaFile = file: "\nlua << EOF\n${builtins.readFile file}\nEOF";

  fromGitHub =
    {
      ref,
      repo,
      sha256 ? lib.fakeSha256,
    }:
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
  nixpkgs = {
    config = {
      allowUnfree = true;
      allowUnfreePredicate = (_: true);
    };
  };

  home.username = "<username>";
  home.homeDirectory = "/Users/<username>";

  home.stateVersion = "24.11";
  home.packages = [
    pkgs.ripgrep
    pkgs.neofetch
  ];

  home.file = {
    ".p10k.zsh".source = ./zsh/p10k.zsh;
    ".config/git/message".source = ./git/message;
  };

  fonts.fontconfig.enable = true;
  programs.home-manager.enable = true;

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

    plugins = [
      {
        name = "zsh-powerlevel10k";
        src = "${pkgs.zsh-powerlevel10k}/share/zsh-powerlevel10k/";
        file = "powerlevel10k.zsh-theme";
      }
    ]; 
  };

  programs.tmux = {
    enable = true;
    extraConfig = builtins.readFile ./tmux/tmux.conf;
  };

  programs.git = {
    enable = true;
    extraConfig = builtins.readFile ./git/config;
    delta.enable = true;
  };

  programs.neovim = {
    enable = true;
    defaultEditor = true;
    viAlias = true;
    vimAlias = true;
    vimdiffAlias = true;

    plugins = with pkgs.vimPlugins; [

      {
        plugin = fakeVimPlugin;
        config = toLuaFile ./nvim/base.lua;
      }

      plenary-nvim
      which-key-nvim
      copilot-vim

      {
        plugin = nvim-treesitter.withAllGrammars;
        config = toLuaFile ./nvim/treesitter.lua;
      }

      {
        plugin = (
          fromGitHub {
            ref = "HEAD";
            repo = "bluz71/vim-moonfly-colors";
            sha256 = "c5fxaT8Bc5MzOjJsuU95K9yzTpGqj/7QP4GuLfsY4VE=";
          }
        );
        config = "colorscheme moonfly";
      }

      # Redacted list of plugins ...
    ];

    extraPackages = with pkgs; [
      gopls
      pyright
    ];
  };
}
```

### Neovim

In the `home.nix` file, you can see that we defined three functions which
are used to activate three types of vim plugins:
- Ones which do not need any further configuration, like plenary
- Ones which do need a lua config to function well, like treesitter
- Ones which do not exist on the nixpkg store currently
- Also I wanted to append these configs in the order of the plugins, and
  `programs.neovim.extraconfig` added the config at the end of the .vim
  config file. So i created a fakeVimPlugin and injected a base config in
  order.

### Other things

Home manager has a rich set of options to explore. I am currently using also
aerc and alacritty through it.

## File tree

This is the final state of my flake folder:
```
├── flake.nix
├── flake.lock
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

To apply this config, you can either just build it with the flake as an
app or just use the binary in a nix-shell:
```bash
home-manager switch --flake .#play
```
Home manager maintains a list of generations and adds one whenever you
switch to a new nix output. You can easily rollback on switches.

## Future

Home manager is nice and unobtrusive piece of software which is fine for
setting up on foreign hosts. Let's move ahead and integrate home-manager
with `nix-darwin` to also make system level changes.
