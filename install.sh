#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${SUBHUB_REPO_URL:-https://github.com/IIIIQIIII/subscription-hub.git}"
BRANCH="${SUBHUB_BRANCH:-main}"
INSTALL_DIR="${SUBHUB_INSTALL_DIR:-$HOME/.subhub/subscription-hub}"
BIN_DIR="${SUBHUB_BIN_DIR:-$HOME/.local/bin}"
COMMAND_NAME="${SUBHUB_COMMAND_NAME:-subhub}"

info() {
  printf '\033[1;34m%s\033[0m\n' "$1"
}

fail() {
  printf '\033[1;31mError:\033[0m %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_command git
require_command node
require_command npm

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating Subscription Hub in $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --quiet origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout --quiet "$BRANCH"
  git -C "$INSTALL_DIR" pull --ff-only --quiet origin "$BRANCH"
else
  if [ "$(find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')" != "0" ]; then
    fail "$INSTALL_DIR exists and is not empty. Set SUBHUB_INSTALL_DIR to another path."
  fi
  info "Installing Subscription Hub into $INSTALL_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

info "Installing dependencies"
npm --prefix "$INSTALL_DIR" install --omit=dev --silent
chmod +x "$INSTALL_DIR/bin/subhub.js"
ln -sf "$INSTALL_DIR/bin/subhub.js" "$BIN_DIR/$COMMAND_NAME"

info "Installed $COMMAND_NAME"
printf 'Command: %s\n' "$BIN_DIR/$COMMAND_NAME"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    printf '\n%s\n' "$BIN_DIR is not currently in PATH."
    printf 'Add this to your shell profile, then restart the terminal:\n'
    printf '  export PATH="%s:$PATH"\n' "$BIN_DIR"
    ;;
esac

printf '\nTry it:\n'
printf '  %s --help\n' "$COMMAND_NAME"
