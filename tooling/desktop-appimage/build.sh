#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/workspace"

cd "$ROOT_DIR"

git config --global --add safe.directory /workspace

echo "==> pnpm install"
pnpm install

echo "==> Tauri desktop build (AppImage) on Ubuntu 22.04"
pnpm --filter desktop tauri build

echo "==> Copying AppImage out"
mkdir -p "$ROOT_DIR/dist"
cp apps/desktop/src-tauri/target/release/bundle/appimage/*.AppImage "$ROOT_DIR/dist/" || {
  echo "No AppImage found under target/release/bundle/appimage"
  exit 1
}

echo "==> Done. Check dist/ for AppImage built against Ubuntu 22.04 + its WebKitGTK."