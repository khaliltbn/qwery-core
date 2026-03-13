#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(dirname "$0")"
if ! test -f "$ROOT/apps/desktop/src-tauri/binaries/bun-x86_64-unknown-linux-gnu"; then
  echo "Building desktop app (binaries + extensions)..."
  (cd "$ROOT" && pnpm --filter desktop build)
fi
# Force source re-copy so flatpak-builder sees the host's binaries (cache would otherwise omit them)
rm -rf .flatpak-builder/build/qweryApp-*
flatpak-builder --user --install build-dir org.qwery.desktop.json "$@"
