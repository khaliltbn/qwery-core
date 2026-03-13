#!/usr/bin/env bash
# Downloads linuxdeploy + GTK plugin for AppImage builds. Run from apps/desktop.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR="${SCRIPT_DIR}/../.linuxdeploy"
ARCH="x86_64"
LINUXDEPLOY_APPIMAGE="${CACHE_DIR}/linuxdeploy-${ARCH}.AppImage"
GTK_PLUGIN="${CACHE_DIR}/linuxdeploy-plugin-gtk.sh"
WRAPPER="${CACHE_DIR}/linuxdeploy"
mkdir -p "$CACHE_DIR"

if [[ ! -x "$LINUXDEPLOY_APPIMAGE" ]]; then
  echo "[linuxdeploy] Downloading linuxdeploy-${ARCH}.AppImage..."
  curl -sSLo "$LINUXDEPLOY_APPIMAGE" \
    "https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-${ARCH}.AppImage"
  chmod +x "$LINUXDEPLOY_APPIMAGE"
fi

if [[ ! -x "$GTK_PLUGIN" ]]; then
  echo "[linuxdeploy] Downloading GTK plugin..."
  curl -sSLo "$GTK_PLUGIN" \
    "https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gtk/master/linuxdeploy-plugin-gtk.sh"
  chmod +x "$GTK_PLUGIN"
fi

# Wrapper so "linuxdeploy" in PATH runs the AppImage (bundler often invokes by name)
printf '%s\n' '#!/usr/bin/env bash' "export APPIMAGE_EXTRACT_AND_RUN=1" "exec \"$LINUXDEPLOY_APPIMAGE\" \"\$@\"" > "$WRAPPER"
chmod +x "$WRAPPER"

export LINUXDEPLOY="$LINUXDEPLOY_APPIMAGE"
export LINUXDEPLOY_PLUGIN_GTK="$GTK_PLUGIN"
export APPIMAGE_EXTRACT_AND_RUN=1
export NO_STRIP=1
export PATH="${CACHE_DIR}:${PATH}"
echo "[linuxdeploy] LINUXDEPLOY=$LINUXDEPLOY PATH has .linuxdeploy"
