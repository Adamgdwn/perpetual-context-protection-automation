#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
launcher_path="$repo_dir/scripts/launch-desktop.sh"
icon_path="$repo_dir/assets/pcpa-icon.svg"
app_name="Perpetual Context Protection"
desktop_file_name="perpetual-context-protection.desktop"
applications_dir="$HOME/.local/share/applications"
applications_file="$applications_dir/$desktop_file_name"
desktop_dir="${XDG_DESKTOP_DIR:-$HOME/Desktop}"
desktop_file="$desktop_dir/$app_name.desktop"

mkdir -p "$applications_dir"

cat > "$applications_file" <<EOF_DESKTOP
[Desktop Entry]
Type=Application
Name=$app_name
Comment=Watch and protect managed AI coding sessions
Exec=$launcher_path
Icon=$icon_path
Terminal=false
Categories=Development;Utility;
StartupNotify=true
EOF_DESKTOP

chmod +x "$launcher_path" "$applications_file"
update-desktop-database "$applications_dir" >/dev/null 2>&1 || true

if [ -d "$desktop_dir" ]; then
  cp "$applications_file" "$desktop_file"
  chmod +x "$desktop_file"
  gio set "$desktop_file" metadata::trusted true >/dev/null 2>&1 || true
fi

printf '%s\n' "$applications_file"
if [ -f "$desktop_file" ]; then
  printf '%s\n' "$desktop_file"
fi
