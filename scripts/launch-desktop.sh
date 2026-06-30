#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # Desktop launchers often start with a minimal PATH, so load Adam's Node setup.
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  nvm use --silent >/dev/null
fi

exec npm run desktop:launch
