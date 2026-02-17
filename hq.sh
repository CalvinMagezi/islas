#!/bin/bash
#
# Islas Agent CLI
#
# Usage: hq <command> [options]
#
# Commands:
#   setup          One-command global install (symlink + deps check + optional daemon)
#   doctor         Pre-flight diagnostics (check all deps, env vars, connectivity)
#   dev [dir]      Start full dev stack (convex + web + agent) in foreground
#   start [dir]    Start daemon + open log monitor + web UI
#   stop           Stop agent daemon
#   restart [dir]  Restart agent daemon
#   run "task"     Dispatch a task to the agent from the CLI
#   open           Open the web UI in browser
#   status         Show daemon status with resource usage
#   health         Deep health check (PID + Convex heartbeat + env validation)
#   logs [-f]      View agent logs (-f to follow)
#   install        Install as system service (launchd/systemd)
#   uninstall      Remove system service
#
set -euo pipefail

# ── Resolve script location (follows symlinks) ──────────────────────

SOURCE="$0"
while [ -L "$SOURCE" ]; do
    DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
    SOURCE="$(readlink "$SOURCE")"
    [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
HQ_ROOT="$(cd "$(dirname "$SOURCE")" && pwd)"

# ── Constants ────────────────────────────────────────────────────────

HQ_STATE_DIR="$HOME/.islas"
PID_FILE="$HQ_STATE_DIR/agent.pid"
LOG_DIR="$HQ_STATE_DIR/logs"
LOG_FILE="$LOG_DIR/agent.log"
ERR_FILE="$LOG_DIR/agent.err"
AGENT_DIR="$HQ_ROOT/apps/agent"
PORT=4815
CONVEX_PORT=3210

# Ensure state directories exist
mkdir -p "$HQ_STATE_DIR" "$LOG_DIR"

# ── Helpers ──────────────────────────────────────────────────────────

get_pid() {
    if [ ! -f "$PID_FILE" ]; then
        echo ""
        return
    fi
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null)
    if [ -z "$pid" ]; then
        echo ""
        return
    fi
    # Check if process is actually running
    if kill -0 "$pid" 2>/dev/null; then
        echo "$pid"
    else
        rm -f "$PID_FILE"
        echo ""
    fi
}

resolve_target_dir() {
    local dir="${1:-$(pwd)}"
    if [ ! -d "$dir" ]; then
        echo "Error: Directory '$dir' does not exist." >&2
        exit 1
    fi
    cd "$dir" && pwd
}

detect_bun() {
    if command -v bun &>/dev/null; then
        command -v bun
    elif [ -f "$HOME/.bun/bin/bun" ]; then
        echo "$HOME/.bun/bin/bun"
    else
        echo ""
    fi
}

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    DIM='\033[2m'
    NC='\033[0m'
else
    GREEN='' RED='' YELLOW='' CYAN='' BOLD='' DIM='' NC=''
fi

check_pass() { echo -e "  ${GREEN}[ok]${NC}  $1"; }
check_fail() { echo -e "  ${RED}[!!]${NC}  $1"; }
check_warn() { echo -e "  ${YELLOW}[--]${NC}  $1"; }
check_info() { echo -e "  ${CYAN}[ii]${NC}  $1"; }

# Open a new terminal window/tab with a command
open_terminal_with() {
    local cmd="$1"
    local title="${2:-Islas Agent}"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Detect terminal emulator
        if [ "$TERM_PROGRAM" = "iTerm.app" ] || pgrep -q iTerm2 2>/dev/null; then
            osascript <<APPLESCRIPT 2>/dev/null
tell application "iTerm"
    activate
    tell current window
        create tab with default profile
        tell current session
            write text "$cmd"
        end tell
    end tell
end tell
APPLESCRIPT
        else
            # Default to Terminal.app
            osascript <<APPLESCRIPT 2>/dev/null
tell application "Terminal"
    activate
    do script "$cmd"
end tell
APPLESCRIPT
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Try common Linux terminal emulators
        if command -v x-terminal-emulator &>/dev/null; then
            x-terminal-emulator -e bash -c "$cmd" &
        elif command -v gnome-terminal &>/dev/null; then
            gnome-terminal -- bash -c "$cmd" &
        elif command -v konsole &>/dev/null; then
            konsole -e bash -c "$cmd" &
        elif command -v xterm &>/dev/null; then
            xterm -e bash -c "$cmd" &
        fi
    fi
}

# Open URL in default browser
open_url() {
    local url="$1"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$url" 2>/dev/null
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$url" 2>/dev/null || true
    fi
}

# Format bytes to human-readable
human_size() {
    local bytes=$1
    if [ "$bytes" -ge 1073741824 ]; then
        echo "$(( bytes / 1073741824 ))G"
    elif [ "$bytes" -ge 1048576 ]; then
        echo "$(( bytes / 1048576 ))M"
    elif [ "$bytes" -ge 1024 ]; then
        echo "$(( bytes / 1024 ))K"
    else
        echo "${bytes}B"
    fi
}

# ── Commands ─────────────────────────────────────────────────────────

cmd_setup() {
    echo ""
    echo -e "${BOLD} Islas Agent — Setup${NC}"
    echo ""

    local issues=0

    # 1. Check dependencies
    echo "Checking dependencies..."

    local bun_path
    bun_path=$(detect_bun)
    if [ -n "$bun_path" ]; then
        local bun_ver
        bun_ver=$("$bun_path" --version 2>/dev/null || echo "unknown")
        check_pass "bun $bun_ver ($bun_path)"
    else
        check_fail "bun not found — install from https://bun.sh"
        issues=$((issues + 1))
    fi

    if command -v npx &>/dev/null; then
        check_pass "npx ($(command -v npx))"
    else
        check_warn "npx not found — needed for 'hq dev' (convex dev server)"
    fi

    # 2. Check agent env file
    echo ""
    echo "Checking configuration..."

    local env_file="$AGENT_DIR/.env.local"
    if [ -f "$env_file" ]; then
        check_pass ".env.local exists"

        # Validate required vars
        local missing_vars=0
        for var in NEXT_PUBLIC_CONVEX_URL OPENROUTER_API_KEY; do
            if grep -q "^${var}=" "$env_file" 2>/dev/null; then
                local val
                val=$(grep "^${var}=" "$env_file" | head -1 | cut -d= -f2-)
                if [ -n "$val" ]; then
                    # Mask sensitive values
                    if [[ "$var" == *KEY* ]] || [[ "$var" == *SECRET* ]]; then
                        check_pass "$var = ${val:0:8}..."
                    else
                        check_pass "$var = $val"
                    fi
                else
                    check_fail "$var is empty"
                    missing_vars=$((missing_vars + 1))
                fi
            else
                check_fail "$var not set"
                missing_vars=$((missing_vars + 1))
            fi
        done

        if [ $missing_vars -gt 0 ]; then
            issues=$((issues + 1))
        fi
    else
        check_fail ".env.local not found at $env_file"
        echo "       Create it with at minimum:"
        echo "         NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud"
        echo "         OPENROUTER_API_KEY=sk-or-v1-..."
        issues=$((issues + 1))
    fi

    if [ $issues -gt 0 ]; then
        echo ""
        echo -e "${RED}Found $issues issue(s). Fix them before continuing.${NC}"
        exit 1
    fi

    # 3. Install global symlink
    echo ""
    echo "Installing 'hq' command globally..."

    local script_path="$HQ_ROOT/hq.sh"
    local installed=false

    # Make script executable
    chmod +x "$script_path"

    # Try /usr/local/bin first (commonly writable on macOS without sudo)
    if [ -w "/usr/local/bin" ]; then
        ln -sf "$script_path" /usr/local/bin/hq
        check_pass "Symlinked to /usr/local/bin/hq"
        installed=true
    elif [ -w "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
        ln -sf "$script_path" "$HOME/.local/bin/hq"
        check_pass "Symlinked to ~/.local/bin/hq"

        # Check if ~/.local/bin is in PATH
        if ! echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/.local/bin"; then
            check_warn "~/.local/bin is not in your PATH"
            echo "       Add this to your shell profile (~/.zshrc or ~/.bashrc):"
            echo "         export PATH=\"\$HOME/.local/bin:\$PATH\""
        fi
        installed=true
    else
        check_fail "Could not install to /usr/local/bin or ~/.local/bin"
        echo "       You can manually create a symlink:"
        echo "         sudo ln -sf $script_path /usr/local/bin/hq"
        echo "       Or add the project root to your PATH."
    fi

    # 4. Install node_modules if needed
    echo ""
    echo "Checking dependencies..."
    if [ ! -d "$AGENT_DIR/node_modules" ] && [ ! -d "$HQ_ROOT/node_modules" ]; then
        echo "  Installing dependencies..."
        cd "$HQ_ROOT" && "$bun_path" install
        check_pass "Dependencies installed"
    else
        check_pass "Dependencies already installed"
    fi

    # 5. Ask about daemon installation
    echo ""
    echo -e "${BOLD}Setup complete!${NC}"
    echo ""

    if [ "$installed" = true ]; then
        echo "You can now use 'hq' from anywhere:"
        echo ""
        echo "  hq doctor    Check all dependencies and configuration"
        echo "  hq start     Start the agent daemon"
        echo "  hq status    Check if daemon is running"
        echo "  hq logs -f   Follow agent logs"
        echo "  hq stop      Stop the daemon"
        echo ""
        echo "To auto-start at login:"
        echo "  hq install   Install as system service (launchd/systemd)"
        echo ""
    fi
}

cmd_doctor() {
    echo ""
    echo -e "${BOLD} Islas Agent — Doctor${NC}"
    echo ""

    local pass=0 warn=0 fail=0

    # ── Runtime Dependencies ──
    echo "Runtime Dependencies"
    echo "────────────────────"

    local bun_path
    bun_path=$(detect_bun)
    if [ -n "$bun_path" ]; then
        local bun_ver
        bun_ver=$("$bun_path" --version 2>/dev/null || echo "?")
        check_pass "bun $bun_ver"
        pass=$((pass + 1))
    else
        check_fail "bun not found — https://bun.sh"
        fail=$((fail + 1))
    fi

    if command -v npx &>/dev/null; then
        check_pass "npx available"
        pass=$((pass + 1))
    else
        check_warn "npx not found (needed for 'hq dev' only)"
        warn=$((warn + 1))
    fi

    if command -v curl &>/dev/null; then
        check_pass "curl available"
        pass=$((pass + 1))
    else
        check_warn "curl not found (needed for health checks)"
        warn=$((warn + 1))
    fi

    # ── Environment Configuration ──
    echo ""
    echo "Environment Configuration"
    echo "─────────────────────────"

    local env_file="$AGENT_DIR/.env.local"
    if [ -f "$env_file" ]; then
        check_pass ".env.local found"
        pass=$((pass + 1))

        # Check each required variable
        for var in NEXT_PUBLIC_CONVEX_URL OPENROUTER_API_KEY; do
            if grep -q "^${var}=" "$env_file" 2>/dev/null; then
                local val
                val=$(grep "^${var}=" "$env_file" | head -1 | cut -d= -f2- | tr -d '"')
                if [ -n "$val" ]; then
                    if [[ "$var" == *KEY* ]]; then
                        check_pass "$var configured (${val:0:8}...)"
                    else
                        check_pass "$var = $val"
                    fi
                    pass=$((pass + 1))
                else
                    check_fail "$var is empty"
                    fail=$((fail + 1))
                fi
            else
                check_fail "$var not set in .env.local"
                fail=$((fail + 1))
            fi
        done

        # Optional but useful vars
        for var in DEFAULT_MODEL CLOUDHQ_API_KEY; do
            if grep -q "^${var}=" "$env_file" 2>/dev/null; then
                check_pass "$var configured"
                pass=$((pass + 1))
            else
                check_warn "$var not set (optional)"
                warn=$((warn + 1))
            fi
        done
    else
        check_fail ".env.local not found at $env_file"
        fail=$((fail + 1))
    fi

    # ── Convex Connectivity ──
    echo ""
    echo "Convex Connectivity"
    echo "───────────────────"

    if [ -f "$env_file" ]; then
        local convex_url
        convex_url=$(grep "^NEXT_PUBLIC_CONVEX_URL=" "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
        if [ -n "$convex_url" ]; then
            # Try to reach the Convex endpoint
            local http_code
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$convex_url" 2>/dev/null) || http_code="000"
            if [[ "$http_code" != "000"* ]] && [ -n "$http_code" ]; then
                check_pass "Convex endpoint reachable ($convex_url)"
                pass=$((pass + 1))
            else
                check_fail "Cannot reach Convex at $convex_url"
                if [[ "$convex_url" == *"127.0.0.1"* ]] || [[ "$convex_url" == *"localhost"* ]]; then
                    echo "       This is a local URL — run 'npx convex dev' first, or"
                    echo "       update .env.local to use your deployed Convex URL."
                fi
                fail=$((fail + 1))
            fi
        else
            check_fail "NEXT_PUBLIC_CONVEX_URL is empty"
            fail=$((fail + 1))
        fi
    fi

    # ── File System ──
    echo ""
    echo "File System"
    echo "───────────"

    if [ -d "$AGENT_DIR" ]; then
        check_pass "Agent directory: $AGENT_DIR"
        pass=$((pass + 1))
    else
        check_fail "Agent directory not found: $AGENT_DIR"
        fail=$((fail + 1))
    fi

    if [ -f "$AGENT_DIR/index.ts" ]; then
        check_pass "Agent entry point exists"
        pass=$((pass + 1))
    else
        check_fail "Agent index.ts not found"
        fail=$((fail + 1))
    fi

    # Check node_modules — in Bun workspaces, deps are hoisted to root
    if [ -d "$AGENT_DIR/node_modules" ] || [ -d "$HQ_ROOT/node_modules" ]; then
        check_pass "Dependencies installed"
        pass=$((pass + 1))
    else
        check_fail "Dependencies missing — run 'bun install' from project root"
        fail=$((fail + 1))
    fi

    if [ -d "$HQ_STATE_DIR" ]; then
        check_pass "State directory: $HQ_STATE_DIR"
        pass=$((pass + 1))
    else
        check_info "State directory will be created on first run"
    fi

    # ── Global Installation ──
    echo ""
    echo "Global Installation"
    echo "───────────────────"

    if command -v hq &>/dev/null; then
        local hq_path
        hq_path=$(command -v hq)
        check_pass "'hq' command available at $hq_path"
        pass=$((pass + 1))
    else
        check_warn "'hq' not installed globally — run 'hq setup' or './hq.sh setup'"
        warn=$((warn + 1))
    fi

    # Check daemon service
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if [ -f "$HOME/Library/LaunchAgents/com.islas.agent.plist" ]; then
            check_pass "LaunchAgent installed (auto-start at login)"
            pass=$((pass + 1))
        else
            check_info "LaunchAgent not installed — run 'hq install' for auto-start"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f "$HOME/.config/systemd/user/islas-agent.service" ]; then
            check_pass "systemd service installed"
            pass=$((pass + 1))
        else
            check_info "systemd service not installed — run 'hq install' for auto-start"
        fi
    fi

    # ── Summary ──
    echo ""
    echo "────────────────────"
    echo -e "  ${GREEN}$pass passed${NC}  ${YELLOW}$warn warnings${NC}  ${RED}$fail errors${NC}"
    echo ""

    if [ $fail -gt 0 ]; then
        echo -e "  ${RED}Fix the errors above before running the agent.${NC}"
        return 1
    elif [ $warn -gt 0 ]; then
        echo -e "  ${YELLOW}Warnings are non-blocking but may affect functionality.${NC}"
    else
        echo -e "  ${GREEN}Everything looks good! Run 'hq start' to launch the daemon.${NC}"
    fi
    echo ""
}

cmd_health() {
    echo ""
    echo -e "${BOLD} Islas Agent — Health Check${NC}"
    echo ""

    # 1. Process check
    echo "Process"
    echo "───────"

    local pid
    pid=$(get_pid)

    if [ -n "$pid" ]; then
        check_pass "Agent running (PID: $pid)"

        # Memory usage
        if [[ "$OSTYPE" == "darwin"* ]]; then
            local mem_kb
            mem_kb=$(ps -p "$pid" -o rss= 2>/dev/null | tr -d ' ' || echo "0")
            if [ "$mem_kb" -gt 0 ] 2>/dev/null; then
                local mem_bytes=$((mem_kb * 1024))
                check_info "Memory: $(human_size $mem_bytes)"
            fi
            local cpu
            cpu=$(ps -p "$pid" -o %cpu= 2>/dev/null | tr -d ' ' || echo "?")
            check_info "CPU: ${cpu}%"
        else
            local mem_kb
            mem_kb=$(ps -p "$pid" -o rss= 2>/dev/null | tr -d ' ' || echo "0")
            if [ "$mem_kb" -gt 0 ] 2>/dev/null; then
                local mem_bytes=$((mem_kb * 1024))
                check_info "Memory: $(human_size $mem_bytes)"
            fi
        fi

        # Uptime
        local start_time=""
        if [[ "$OSTYPE" == "darwin"* ]]; then
            local start_epoch
            start_epoch=$(ps -p "$pid" -o lstart= 2>/dev/null || echo "")
            if [ -n "$start_epoch" ]; then
                check_info "Started: $start_epoch"
            fi
        else
            local etime
            etime=$(ps -p "$pid" -o etime= 2>/dev/null | tr -d ' ' || echo "?")
            check_info "Uptime: $etime"
        fi
    else
        check_fail "Agent is not running"
        echo "       Start it with: hq start"
    fi

    # 2. Convex connectivity
    echo ""
    echo "Convex Backend"
    echo "──────────────"

    local env_file="$AGENT_DIR/.env.local"
    if [ -f "$env_file" ]; then
        local convex_url
        convex_url=$(grep "^NEXT_PUBLIC_CONVEX_URL=" "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
        if [ -n "$convex_url" ]; then
            local http_code
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$convex_url" 2>/dev/null) || http_code="000"
            if [[ "$http_code" != "000"* ]] && [ -n "$http_code" ]; then
                check_pass "Convex reachable ($convex_url)"

                # If we have a CLOUDHQ_API_KEY, try the health endpoint
                local api_key
                api_key=$(grep "^CLOUDHQ_API_KEY=" "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
                local site_url
                site_url=$(grep "^NEXT_PUBLIC_CONVEX_SITE_URL=" "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')

                if [ -n "$site_url" ] && [ -n "$api_key" ]; then
                    local health_resp
                    health_resp=$(curl -s --connect-timeout 5 \
                        -H "x-api-key: $api_key" \
                        "$site_url/api/health" 2>/dev/null || echo "")
                    if [ -n "$health_resp" ]; then
                        check_pass "Health endpoint responded"
                    fi
                fi
            else
                check_fail "Cannot reach Convex at $convex_url"
                if [[ "$convex_url" == *"127.0.0.1"* ]] || [[ "$convex_url" == *"localhost"* ]]; then
                    echo "       Local URL detected — is 'npx convex dev' running?"
                else
                    echo "       Check your internet connection"
                fi
            fi
        fi
    fi

    # 3. Log health
    echo ""
    echo "Logs"
    echo "────"

    if [ -f "$LOG_FILE" ]; then
        local log_size
        log_size=$(wc -c < "$LOG_FILE" 2>/dev/null | tr -d ' ')
        check_info "Log file: $(human_size "$log_size") ($LOG_FILE)"

        # Count rotated log files
        local rotated_count=0
        for f in "$LOG_FILE".*; do
            [ -f "$f" ] && rotated_count=$((rotated_count + 1))
        done
        if [ $rotated_count -gt 0 ]; then
            check_info "$rotated_count rotated log file(s)"
        fi

        # Check for recent errors
        local recent_errors
        recent_errors=$(tail -n 100 "$LOG_FILE" 2>/dev/null | grep -ci "error\|fail\|crash" || echo "0")
        if [ "$recent_errors" -gt 0 ]; then
            check_warn "$recent_errors error(s) in last 100 log lines"
        else
            check_pass "No recent errors in logs"
        fi

        # Show last heartbeat from logs
        local last_heartbeat
        last_heartbeat=$(grep -i "heartbeat\|polling\|alive" "$LOG_FILE" 2>/dev/null | tail -1 || echo "")
        if [ -n "$last_heartbeat" ]; then
            # Extract just the timestamp
            local ts
            ts=$(echo "$last_heartbeat" | grep -o '\[.*\]' | head -1 || echo "")
            if [ -n "$ts" ]; then
                check_info "Last heartbeat: $ts"
            fi
        fi
    else
        check_info "No log file yet (agent hasn't run)"
    fi

    if [ -f "$ERR_FILE" ] && [ -s "$ERR_FILE" ]; then
        local err_size
        err_size=$(wc -c < "$ERR_FILE" 2>/dev/null | tr -d ' ')
        check_warn "Error log: $(human_size "$err_size") ($ERR_FILE)"
        echo ""
        echo "  Last 3 error lines:"
        tail -n 3 "$ERR_FILE" 2>/dev/null | sed 's/^/    /'
    fi

    echo ""
}

cmd_dev() {
    local target_dir
    target_dir=$(resolve_target_dir "${1:-}")

    echo "
 Islas Agent — Development Mode
 Working Directory: $target_dir
 Web UI: http://localhost:$PORT
 Convex: http://localhost:$CONVEX_PORT
"

    export TARGET_DIR="$target_dir"

    # Track background PIDs
    local convex_pid="" web_pid=""

    cleanup() {
        echo -e "\n Shutting down HQ Stack..."
        [ -n "$web_pid" ] && kill "$web_pid" 2>/dev/null
        [ -n "$convex_pid" ] && kill "$convex_pid" 2>/dev/null
        exit 0
    }
    trap cleanup SIGINT SIGTERM

    # 1. Start Convex dev server
    if ! lsof -ti:$CONVEX_PORT > /dev/null 2>&1; then
        echo "Starting Convex backend..."
        cd "$HQ_ROOT/packages/convex"
        npx convex dev > /dev/null 2>&1 &
        convex_pid=$!

        echo -n "   Waiting for backend"
        for _ in $(seq 1 30); do
            if lsof -ti:$CONVEX_PORT > /dev/null 2>&1; then
                echo " Ready"
                break
            fi
            echo -n "."
            sleep 1
        done
        if ! lsof -ti:$CONVEX_PORT > /dev/null 2>&1; then
            echo " (may still be starting)"
        fi
    else
        echo "Convex backend already running"
    fi

    # 2. Start Web UI
    if ! lsof -ti:$PORT > /dev/null 2>&1; then
        echo "Starting Web UI..."
        cd "$HQ_ROOT/apps/web"
        PORT=$PORT bun run dev > /dev/null 2>&1 &
        web_pid=$!
        sleep 2
    else
        echo "Web UI already running"
    fi

    # 3. Open browser
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "http://localhost:$PORT"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "http://localhost:$PORT" 2>/dev/null || true
    fi

    # 4. Start agent in foreground
    echo "Starting Islas Agent..."
    cd "$AGENT_DIR"
    bun index.ts

    cleanup
}

cmd_start() {
    # Parse flags
    local quiet=false
    local positional=()
    for arg in "$@"; do
        case "$arg" in
            -q|--quiet) quiet=true ;;
            *) positional+=("$arg") ;;
        esac
    done

    local target_dir
    target_dir=$(resolve_target_dir "${positional[0]:-}")

    local existing_pid
    existing_pid=$(get_pid)
    if [ -n "$existing_pid" ]; then
        echo -e "${YELLOW}Islas Agent is already running (PID: $existing_pid)${NC}"
        echo "Use 'hq restart' to restart, or 'hq stop' first."
        exit 1
    fi

    local bun_path
    bun_path=$(detect_bun)
    if [ -z "$bun_path" ]; then
        echo -e "${RED}Error: 'bun' not found. Install it: https://bun.sh${NC}"
        exit 1
    fi

    # ── Pre-flight: check Convex connectivity ──
    local env_file="$AGENT_DIR/.env.local"
    local convex_url=""
    if [ -f "$env_file" ]; then
        convex_url=$(grep "^NEXT_PUBLIC_CONVEX_URL=" "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
    fi

    if [ -z "$convex_url" ]; then
        echo -e "${RED}Error: NEXT_PUBLIC_CONVEX_URL not set in $env_file${NC}"
        echo "  The agent needs a Convex backend to connect to."
        echo "  Run 'hq doctor' to check your configuration."
        exit 1
    fi

    # Check if URL is localhost
    local is_local=false
    if [[ "$convex_url" == *"127.0.0.1"* ]] || [[ "$convex_url" == *"localhost"* ]]; then
        is_local=true
    fi

    # Verify Convex is reachable
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "$convex_url" 2>/dev/null) || http_code="000"
    if [[ "$http_code" == "000"* ]] || [ -z "$http_code" ]; then
        echo ""
        echo -e "${RED}Error: Cannot reach Convex at $convex_url${NC}"
        echo ""
        if [ "$is_local" = true ]; then
            echo "  Your .env.local points to a local Convex server, but it's not running."
            echo ""
            echo "  You have two options:"
            echo ""
            echo "    1. Use 'hq dev' instead (starts Convex + Web + Agent together)"
            echo "       ${DIM}Best for local development${NC}"
            echo ""
            echo "    2. Deploy to Convex Cloud and update .env.local:"
            echo "       ${DIM}cd packages/convex && npx convex deploy${NC}"
            echo "       ${DIM}Then update NEXT_PUBLIC_CONVEX_URL in apps/agent/.env.local${NC}"
            echo "       ${DIM}Best for daemon mode (hq start / hq install)${NC}"
        else
            echo "  Check your internet connection and Convex deployment."
        fi
        echo ""
        exit 1
    fi

    if [ "$is_local" = true ]; then
        echo -e "  ${YELLOW}Note: Using local Convex ($convex_url).${NC}"
        echo -e "  ${YELLOW}The daemon will stop working if 'convex dev' stops.${NC}"
        echo -e "  ${YELLOW}For persistent daemon mode, deploy to Convex Cloud.${NC}"
        echo ""
    fi

    echo ""
    echo -e "${BOLD} Islas Agent — Starting Daemon${NC}"
    echo ""
    echo "  Working directory: $target_dir"
    echo "  Convex: $convex_url"
    echo "  Logs: $LOG_FILE"
    echo ""

    # Start agent in background
    cd "$AGENT_DIR"
    TARGET_DIR="$target_dir" nohup "$bun_path" index.ts >> "$LOG_FILE" 2>> "$ERR_FILE" &
    local pid=$!
    echo "$pid" > "$PID_FILE"

    # Verify it started
    sleep 1
    if ! kill -0 "$pid" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo -e "${RED}Error: Agent failed to start. Check logs:${NC}"
        echo "  $ERR_FILE"
        exit 1
    fi

    echo -e "  ${GREEN}Agent started (PID: $pid)${NC}"

    if [ "$quiet" = true ]; then
        return 0
    fi

    # ── Show boot sequence inline ──
    echo ""
    echo -e "${DIM}Boot log (3 seconds):${NC}"
    echo -e "${DIM}─────────────────────${NC}"

    # Tail the log for 3 seconds so the user sees the agent connecting
    timeout 3 tail -f "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
        echo -e "  ${DIM}$line${NC}"
    done || true

    echo -e "${DIM}─────────────────────${NC}"
    echo ""

    # ── Open monitoring terminal ──
    # Resolve hq command path for the new terminal
    local hq_cmd=""
    if command -v hq &>/dev/null; then
        hq_cmd="hq logs -f"
    else
        hq_cmd="bash \"$HQ_ROOT/hq.sh\" logs -f"
    fi

    open_terminal_with "$hq_cmd" "Islas Agent Logs"
    echo -e "  ${CYAN}Opened log monitor in new terminal window${NC}"

    # ── Open web UI if reachable ──
    # Check if the web app is running (could be on deployed URL or localhost)
    local web_url=""
    local env_file="$AGENT_DIR/.env.local"

    # Check localhost first (common dev setup)
    if curl -s -o /dev/null --connect-timeout 1 "http://localhost:$PORT" 2>/dev/null; then
        web_url="http://localhost:$PORT"
    fi

    if [ -n "$web_url" ]; then
        open_url "$web_url"
        echo -e "  ${CYAN}Opened web UI: $web_url${NC}"
    fi

    echo ""
    echo -e "${BOLD}  How to interact with HQ:${NC}"
    echo ""
    echo "    hq open               Open the web UI (chat interface)"
    echo "    hq run \"your task\"    Dispatch a task from the command line"
    echo ""
    echo -e "${BOLD}  Monitoring:${NC}"
    echo ""
    echo "    hq status             Process info (PID, memory, CPU)"
    echo "    hq health             Deep health check"
    echo "    hq logs -f            Follow logs in real-time"
    echo "    hq stop               Stop the daemon"
    echo ""
}

cmd_stop() {
    local pid
    pid=$(get_pid)
    if [ -z "$pid" ]; then
        echo "Islas Agent is not running"
        return 0
    fi

    echo "Stopping Islas Agent (PID: $pid)..."

    # Graceful shutdown (SIGTERM)
    kill "$pid" 2>/dev/null

    # Wait up to 10 seconds for graceful exit
    local waited=0
    while [ $waited -lt 100 ]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            break
        fi
        sleep 0.1
        waited=$((waited + 1))
    done

    # Force kill if still alive
    if kill -0 "$pid" 2>/dev/null; then
        echo "Force stopping..."
        kill -9 "$pid" 2>/dev/null || true
    fi

    rm -f "$PID_FILE"
    echo "Islas Agent stopped"
}

cmd_restart() {
    cmd_stop
    sleep 1
    cmd_start "${1:-}"
}

cmd_status() {
    local pid
    pid=$(get_pid)

    if [ -n "$pid" ]; then
        # Gather process info
        local start_time="" mem_kb="" cpu="" etime=""

        if [[ "$OSTYPE" == "darwin"* ]]; then
            start_time=$(ps -p "$pid" -o lstart= 2>/dev/null | sed 's/^ *//' || echo "unknown")
            mem_kb=$(ps -p "$pid" -o rss= 2>/dev/null | tr -d ' ' || echo "0")
            cpu=$(ps -p "$pid" -o %cpu= 2>/dev/null | tr -d ' ' || echo "?")
        else
            start_time=$(ps -p "$pid" -o lstart= 2>/dev/null | sed 's/^ *//' || echo "unknown")
            mem_kb=$(ps -p "$pid" -o rss= 2>/dev/null | tr -d ' ' || echo "0")
            cpu=$(ps -p "$pid" -o %cpu= 2>/dev/null | tr -d ' ' || echo "?")
            etime=$(ps -p "$pid" -o etime= 2>/dev/null | tr -d ' ' || echo "")
        fi

        local mem_display="?"
        if [ "$mem_kb" -gt 0 ] 2>/dev/null; then
            local mem_bytes=$((mem_kb * 1024))
            mem_display=$(human_size $mem_bytes)
        fi

        # Log file size
        local log_display="(no log file)"
        if [ -f "$LOG_FILE" ]; then
            local log_bytes
            log_bytes=$(wc -c < "$LOG_FILE" 2>/dev/null | tr -d ' ')
            log_display="$(human_size "$log_bytes")"
        fi

        echo ""
        echo -e " ${BOLD}Islas Agent Status${NC}"
        echo ""
        echo -e " Status:  ${GREEN}RUNNING${NC}"
        echo " PID:     $pid"
        echo " Started: $start_time"
        if [ -n "$etime" ]; then
            echo " Uptime:  $etime"
        fi
        echo " Memory:  $mem_display"
        echo " CPU:     ${cpu}%"
        echo " Log:     $LOG_FILE ($log_display)"
        echo ""

        # Show last 5 log lines
        if [ -f "$LOG_FILE" ]; then
            echo "Recent logs:"
            tail -n 5 "$LOG_FILE" 2>/dev/null | sed 's/^/  /'
            echo ""
        fi
    else
        echo ""
        echo -e " ${BOLD}Islas Agent Status${NC}"
        echo ""
        echo -e " Status:  ${RED}STOPPED${NC}"
        echo ""

        # Show last error if available
        if [ -f "$ERR_FILE" ] && [ -s "$ERR_FILE" ]; then
            echo "Last errors:"
            tail -n 3 "$ERR_FILE" 2>/dev/null | sed 's/^/  /'
            echo ""
        fi

        echo " Start with: hq start"
        echo ""
    fi
}

cmd_logs() {
    if [ ! -f "$LOG_FILE" ]; then
        echo "No log file found. Start the agent first."
        exit 1
    fi

    local follow=false
    for arg in "$@"; do
        case "$arg" in
            -f|--follow) follow=true ;;
        esac
    done

    if [ "$follow" = true ]; then
        echo "Following logs (Ctrl+C to exit)..."
        echo ""
        tail -f "$LOG_FILE"
    else
        echo "Last 50 lines:"
        echo ""
        tail -n 50 "$LOG_FILE"
    fi
}

cmd_install() {
    local install_script="$HQ_ROOT/apps/agent/scripts/install-daemon.sh"
    if [ ! -f "$install_script" ]; then
        echo "Error: install-daemon.sh not found at $install_script"
        exit 1
    fi
    bash "$install_script" install
}

cmd_uninstall() {
    local install_script="$HQ_ROOT/apps/agent/scripts/install-daemon.sh"
    if [ ! -f "$install_script" ]; then
        echo "Error: install-daemon.sh not found at $install_script"
        exit 1
    fi
    bash "$install_script" uninstall
}

cmd_open() {
    # Try to find a web URL to open
    local web_url=""
    local env_file="$AGENT_DIR/.env.local"

    # Check localhost (dev mode)
    if curl -s -o /dev/null --connect-timeout 1 "http://localhost:$PORT" 2>/dev/null; then
        web_url="http://localhost:$PORT"
    fi

    # Could also check for a configured deployed URL in the future
    # e.g., HQ_WEB_URL in env

    if [ -n "$web_url" ]; then
        open_url "$web_url"
        echo "Opened HQ web UI: $web_url"
    else
        echo -e "${YELLOW}Web UI is not running on localhost:$PORT${NC}"
        echo ""
        echo "  To start the full stack (including web UI):"
        echo "    hq dev"
        echo ""
        echo "  Or if the web app is deployed, open it in your browser directly."
    fi
}

cmd_run() {
    local instruction="$*"
    if [ -z "$instruction" ]; then
        echo -e "${RED}Usage: hq run \"your task description\"${NC}"
        echo ""
        echo "Examples:"
        echo "  hq run \"List all TypeScript files in the project\""
        echo "  hq run \"Run the test suite and report results\""
        echo "  hq run \"Create a summary of recent git commits\""
        exit 1
    fi

    local env_file="$AGENT_DIR/.env.local"

    # Need the Convex SITE URL (HTTP actions endpoint) and API key
    local site_url=""
    local api_key=""

    if [ -f "$env_file" ]; then
        site_url=$(grep "^NEXT_PUBLIC_CONVEX_SITE_URL=" "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
        api_key=$(grep "^CLOUDHQ_API_KEY=" "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
    fi

    if [ -z "$site_url" ]; then
        echo -e "${RED}Error: NEXT_PUBLIC_CONVEX_SITE_URL not set in $env_file${NC}"
        echo "  This is needed for the HTTP API endpoint."
        exit 1
    fi

    if [ -z "$api_key" ]; then
        echo -e "${RED}Error: CLOUDHQ_API_KEY not set in $env_file${NC}"
        echo "  This is needed for API authentication."
        exit 1
    fi

    # Check if agent is running
    local pid
    pid=$(get_pid)
    if [ -z "$pid" ]; then
        echo -e "${YELLOW}Warning: Islas Agent daemon is not running.${NC}"
        echo "  The job will be queued but won't execute until the agent starts."
        echo "  Run 'hq start' to start the agent."
        echo ""
    fi

    echo -e "Dispatching task to Islas Agent..."
    echo -e "  ${DIM}$instruction${NC}"
    echo ""

    local response
    response=$(curl -s --connect-timeout 5 \
        -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $api_key" \
        -d "{\"instruction\": $(echo "$instruction" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}" \
        "$site_url/api/jobs/create" 2>/dev/null)

    if [ -z "$response" ]; then
        echo -e "${RED}Error: Could not reach Convex at $site_url${NC}"
        echo "  Is the Convex backend running?"
        exit 1
    fi

    # Check for error
    local error
    error=$(echo "$response" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("error",""))' 2>/dev/null || echo "")
    if [ -n "$error" ]; then
        echo -e "${RED}Error: $error${NC}"
        exit 1
    fi

    local job_id
    job_id=$(echo "$response" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("jobId",""))' 2>/dev/null || echo "")

    if [ -n "$job_id" ]; then
        echo -e "  ${GREEN}Job created: $job_id${NC}"
        echo ""
        echo "  Monitor progress:"
        echo "    hq logs -f             Follow agent logs"
        echo "    hq open                Open web UI to see results"
    else
        echo -e "${YELLOW}Job submitted but no ID returned.${NC}"
        echo "  Response: $response"
    fi
}

cmd_help() {
    echo ""
    echo -e " ${BOLD}Islas Agent CLI${NC}"
    echo ""
    echo "Usage: hq <command> [options]"
    echo ""
    echo "Getting Started:"
    echo "  setup               Install 'hq' globally + validate deps"
    echo "  doctor              Pre-flight check (deps, env, connectivity)"
    echo ""
    echo "Development:"
    echo "  dev [dir]           Full dev stack (convex + web + agent) in foreground"
    echo ""
    echo "Daemon Management:"
    echo "  start [dir] [-q]    Start daemon + open log monitor + web UI"
    echo "  stop                Stop agent daemon gracefully"
    echo "  restart [dir]       Stop + start daemon"
    echo ""
    echo "Interact:"
    echo "  run \"task\"          Dispatch a task to the agent from the CLI"
    echo "  open                Open the web UI in your browser"
    echo ""
    echo "Monitoring:"
    echo "  status              Daemon status (PID, memory, CPU, logs)"
    echo "  health              Deep health check (process + Convex + logs)"
    echo "  logs [-f]           View agent logs (-f to follow)"
    echo ""
    echo "System Service:"
    echo "  install             Auto-start at login (launchd/systemd)"
    echo "  uninstall           Remove auto-start service"
    echo ""
    echo "Options:"
    echo "  [dir]               Target working directory (default: current dir)"
    echo "  -q, --quiet         Suppress auto-open on start"
    echo "  -f, --follow        Follow log output in real-time"
    echo ""
    echo "Quick Start:"
    echo "  ./hq.sh setup                        # First time: install globally"
    echo "  hq doctor                            # Verify everything is configured"
    echo "  hq start                             # Start the agent daemon"
    echo "  hq run \"list files in this project\"  # Dispatch a task"
    echo "  hq open                              # Open web UI"
    echo "  hq logs -f                           # Watch logs"
    echo "  hq stop                              # Stop when done"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────

COMMAND="${1:-help}"
shift 2>/dev/null || true

case "$COMMAND" in
    setup)     cmd_setup ;;
    doctor)    cmd_doctor ;;
    dev)       cmd_dev "$@" ;;
    start)     cmd_start "$@" ;;
    stop)      cmd_stop ;;
    restart)   cmd_restart "$@" ;;
    status)    cmd_status ;;
    health)    cmd_health ;;
    run)       cmd_run "$@" ;;
    open)      cmd_open ;;
    logs)      cmd_logs "$@" ;;
    install)   cmd_install ;;
    uninstall) cmd_uninstall ;;
    help|-h|--help) cmd_help ;;
    *)
        echo "Unknown command: $COMMAND"
        cmd_help
        exit 1
        ;;
esac
