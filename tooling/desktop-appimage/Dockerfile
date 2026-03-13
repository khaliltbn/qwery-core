FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
  curl \
  ca-certificates \
  build-essential \
  pkg-config \
  git \
  openssl \
  libssl-dev \
  libwebkit2gtk-4.0-dev \
  libgtk-3-dev \
  libappindicator3-dev \
  librsvg2-dev \
  wget \
  xz-utils \
  unzip \
  && rm -rf /var/lib/apt/lists/*

# Modern Node.js + pnpm via corepack
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    corepack enable && \
    corepack prepare pnpm@9.15.4 --activate

# Bun
ENV BUN_INSTALL=/root/.bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

# Rust (stable)
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Tauri CLI
RUN cargo install tauri-cli

# linuxdeploy + GTK plugin (used by tauri-bundler)
RUN mkdir -p /opt/linuxdeploy && cd /opt/linuxdeploy && \
  wget https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage && \
  chmod +x linuxdeploy-x86_64.AppImage && \
  wget https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/master/linuxdeploy-plugin-gtk.sh && \
  chmod +x linuxdeploy-plugin-gtk.sh

WORKDIR /workspace