#!/usr/bin/env bash
#
# Islas Agent — Daemon Installer
#
# Usage:
#   ./install-daemon.sh          Install and start the daemon
#   ./install-daemon.sh uninstall Remove the daemon
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOME_DIR="$HOME"
ACTION="${1:-install}"

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin) echo "macos" ;;
        Linux)  echo "linux" ;;
        *)      echo "unsupported" ;;
    esac
}

# Detect bun path
detect_bun() {
    if command -v bun &>/dev/null; then
        command -v bun
    elif [ -f "$HOME/.bun/bin/bun" ]; then
        echo "$HOME/.bun/bin/bun"
    else
        echo ""
    fi
}

# --- macOS LaunchAgent ---

install_macos() {
    local plist_name="com.islas.agent.plist"
    local plist_src="$SCRIPT_DIR/$plist_name"
    local plist_dest="$HOME_DIR/Library/LaunchAgents/$plist_name"
    local log_dir="$HOME_DIR/Library/Logs"
    local bun_path
    bun_path="$(detect_bun)"

    if [ -z "$bun_path" ]; then
        echo "❌ Error: 'bun' not found. Install it first: https://bun.sh"
        exit 1
    fi

    echo "📦 Installing Islas Agent as macOS LaunchAgent..."
    echo "   Agent directory: $AGENT_DIR"
    echo "   Bun path: $bun_path"

    # Ensure log directory exists
    mkdir -p "$log_dir"

    # Create plist from template
    sed \
        -e "s|__AGENT_DIR__|$AGENT_DIR|g" \
        -e "s|__HOME__|$HOME_DIR|g" \
        -e "s|/usr/local/bin/bun|$bun_path|g" \
        "$plist_src" > "$plist_dest"

    # Load the agent
    launchctl unload "$plist_dest" 2>/dev/null || true
    launchctl load "$plist_dest"

    echo "✅ Islas Agent installed and started!"
    echo "   Logs: $log_dir/islas-agent.log"
    echo ""
    echo "   To check status: launchctl list | grep islas"
    echo "   To stop: launchctl unload $plist_dest"
    echo "   To uninstall: $0 uninstall"
}

uninstall_macos() {
    local plist_name="com.islas.agent.plist"
    local plist_dest="$HOME_DIR/Library/LaunchAgents/$plist_name"

    echo "🗑️  Removing Islas Agent LaunchAgent..."

    launchctl unload "$plist_dest" 2>/dev/null || true
    rm -f "$plist_dest"

    echo "✅ Islas Agent uninstalled."
}

# --- Linux systemd ---

install_linux() {
    local service_name="islas-agent.service"
    local service_src="$SCRIPT_DIR/$service_name"
    local service_dest="$HOME_DIR/.config/systemd/user/$service_name"
    local log_dir="$HOME_DIR/.local/share/islas"
    local bun_path
    bun_path="$(detect_bun)"

    if [ -z "$bun_path" ]; then
        echo "❌ Error: 'bun' not found. Install it first: https://bun.sh"
        exit 1
    fi

    echo "📦 Installing Islas Agent as systemd user service..."
    echo "   Agent directory: $AGENT_DIR"
    echo "   Bun path: $bun_path"

    # Ensure directories
    mkdir -p "$(dirname "$service_dest")"
    mkdir -p "$log_dir"

    # Create service file from template
    sed \
        -e "s|__AGENT_DIR__|$AGENT_DIR|g" \
        -e "s|__HOME__|$HOME_DIR|g" \
        -e "s|/usr/local/bin/bun|$bun_path|g" \
        "$service_src" > "$service_dest"

    # Reload and start
    systemctl --user daemon-reload
    systemctl --user enable "$service_name"
    systemctl --user start "$service_name"

    echo "✅ Islas Agent installed and started!"
    echo "   Logs: journalctl --user -u $service_name -f"
    echo ""
    echo "   To check status: systemctl --user status $service_name"
    echo "   To stop: systemctl --user stop $service_name"
    echo "   To uninstall: $0 uninstall"
}

uninstall_linux() {
    local service_name="islas-agent.service"
    local service_dest="$HOME_DIR/.config/systemd/user/$service_name"

    echo "🗑️  Removing Islas Agent systemd service..."

    systemctl --user stop "$service_name" 2>/dev/null || true
    systemctl --user disable "$service_name" 2>/dev/null || true
    rm -f "$service_dest"
    systemctl --user daemon-reload

    echo "✅ Islas Agent uninstalled."
}

# --- Main ---

OS="$(detect_os)"

if [ "$OS" = "unsupported" ]; then
    echo "❌ Unsupported operating system: $(uname -s)"
    echo "   Supported: macOS, Linux"
    exit 1
fi

case "$ACTION" in
    install)
        if [ "$OS" = "macos" ]; then
            install_macos
        else
            install_linux
        fi
        ;;
    uninstall)
        if [ "$OS" = "macos" ]; then
            uninstall_macos
        else
            uninstall_linux
        fi
        ;;
    *)
        echo "Usage: $0 [install|uninstall]"
        exit 1
        ;;
esac
