# Agent Compact Automation — Build Plan

> 2026-06-29 update: Superseded as the active implementation plan.
> This document is retained as tmux/n8n research and background. The current
> product direction is a cross-platform desktop app plus VS Code companion
> extension. Use `docs/current-build-pathway.md` and
> `docs/specs/2026-06-29-vscode-first-build-plan.md` for implementation.

**Goal:** An automation system that watches Claude Code (and optionally Codex) running in a terminal, detects when the agent has paused at a natural chunk boundary, automatically sends `/compact` to compress the context window, then sends a continuation message so the agent resumes the next chunk without human intervention.

**Date drafted:** 2026-06-29  
**Research basis:** Deep technical research on Claude Code TUI automation, tmux scripting, n8n architecture patterns, and community-reported limitations.

---

## Table of Contents

1. [What You're Building and Why It's Non-Trivial](#1-what-youre-building-and-why-its-non-trivial)
2. [Critical Prerequisites You Would Have Missed](#2-critical-prerequisites-you-would-have-missed)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 1 — tmux Foundation](#4-phase-1--tmux-foundation)
5. [Phase 2 — Sentinel Configuration (CLAUDE.md)](#5-phase-2--sentinel-configuration-claudemd)
6. [Phase 3 — The Watcher Script](#6-phase-3--the-watcher-script)
7. [Phase 4 — n8n Workflows](#7-phase-4--n8n-workflows)
8. [Phase 5 — Continuation Context (The Hard Part)](#8-phase-5--continuation-context-the-hard-part)
9. [Phase 6 — Codex Adaptation](#9-phase-6--codex-adaptation) (/compact works the same — just different session name)
10. [Enable Execute Command in n8n Docker](#10-enable-execute-command-in-n8n-docker)
11. [Edge Cases and Failure Modes](#11-edge-cases-and-failure-modes)
12. [Build Order and Milestones](#12-build-order-and-milestones)
13. [File Map](#13-file-map)

---

## 1. What You're Building and Why It's Non-Trivial

The user-visible flow is simple:
```
Claude works → reaches a good stopping point → pauses → /compact → continues next chunk
```

The technical reality has five hard sub-problems:

| Problem | Why it's hard |
|---|---|
| **Detecting the pause** | Claude Code's TUI has no machine-readable idle API. You have to infer it from terminal output patterns or teach Claude to signal it. |
| **Injecting keystrokes** | Claude Code is an interactive TUI. To "type" `/compact` you need tmux running as the terminal host. A plain terminal window is unreachable programmatically. |
| **n8n can't reach tmux** | n8n runs in Docker. The tmux session is on your host. Docker cannot directly run `tmux send-keys` against host sessions. The watcher script must handle all terminal interaction; n8n acts as the orchestrator/decision layer, not the typist. |
| **What to say after `/compact`** | The continuation message just needs to re-anchor the task. Because your plans are pre-built in context-window-sized chunks, "carry on with the next chunk" is sufficient — Claude already knows the plan structure from earlier context and the sentinel instruction. |
| **What is a "chunk"?** | The system has no way to know what a "reasonable chunk" is unless you either define it in the initial prompt or teach Claude to decide itself. This must be deliberately designed. |

---

## 2. Critical Prerequisites You Would Have Missed

### 2.1 tmux is mandatory

Claude Code **must** be running inside a tmux session. If it's running in a plain terminal (GNOME Terminal, etc.), there is no programmatic way to read its output or inject keystrokes. This is a hard requirement of the whole system.

**Solution:** Claude Code always launched via tmux:
```bash
tmux new-session -s claude-code -d && tmux send-keys -t claude-code "claude" C-m
```
Or with a wrapper script (built in Phase 1).

### 2.2 `/compact` takes no arguments

`/compact` is a bare command with no parameters. You cannot pass it a custom summary or tell it what to keep. Compaction behavior is entirely up to Claude's internal judgment. You can influence it only via prior CLAUDE.md instructions about what is important.

### 2.3 The Execute Command node is disabled in your n8n Docker container

n8n 2.x disables the Execute Command node by default for security. Your current Docker setup does NOT have it enabled. This must be fixed (see Phase 4) before n8n can run shell commands.

### 2.4 n8n running in Docker CANNOT run tmux on the host

The n8n container has its own filesystem and process table. `tmux` sessions live on the HOST. n8n's Execute Command node would try to run `tmux send-keys` inside the container, where there are no tmux sessions.

**The fix:** The watcher script (running on the HOST) handles ALL tmux interaction. n8n's role is:
- Storing task state (what's the current goal? what chunk are we on?)
- Orchestrating the sequence (compact → wait → continue)  
- Providing a webhook endpoint that the watcher can call
- Sending notifications if something goes wrong

### 2.5 Race condition risk

If the watcher fires `/compact` while Claude is mid-sentence (e.g., still streaming), the `/compact` text will appear in the input buffer during active output, which is undefined behavior. The system must confirm Claude has fully stopped before injecting anything.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR HOST MACHINE                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               tmux session: "cc-work"                    │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ pane 0: Claude Code TUI                         │    │    │
│  │  │                                                 │    │    │
│  │  │  (working...)                                   │    │    │
│  │  │  > I've finished this chunk. ===CHUNK_DONE===   │    │    │
│  │  │  ❯ _                          (idle prompt)     │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │ tmux capture-pane (read)           │
│                             ▼                                    │
│  ┌───────────────────────────────────────┐                       │
│  │  watcher.sh  (daemon, runs on host)   │                       │
│  │                                       │                       │
│  │  1. Polls tmux pane for sentinel      │                       │
│  │  2. Confirms idle (prompt visible)    │                       │
│  │  3. POSTs event to n8n webhook        │                       │
│  │  4. Listens for n8n response          │                       │
│  │  5. tmux send-keys /compact           │                       │
│  │  6. Waits for compact to complete     │                       │
│  │  7. tmux send-keys [continuation]     │                       │
│  └────────────────┬──────────────────────┘                       │
│                   │ HTTP                                          │
│                   │                                               │
│  ┌────────────────▼──────────────────────────────────┐           │
│  │  n8n (Docker)                                     │           │
│  │                                                   │           │
│  │  Workflow: "Agent Watcher"                        │           │
│  │  ┌──────────────────┐                             │           │
│  │  │ Webhook Trigger  │◄── watcher.sh POSTs here    │           │
│  │  └────────┬─────────┘                             │           │
│  │           │                                       │           │
│  │  ┌────────▼─────────┐                             │           │
│  │  │ Lookup task state│  (what's the current goal?) │           │
│  │  │ from n8n DB      │                             │           │
│  │  └────────┬─────────┘                             │           │
│  │           │                                       │           │
│  │  ┌────────▼─────────┐                             │           │
│  │  │ Build            │                             │           │
│  │  │ continuation msg │                             │           │
│  │  └────────┬─────────┘                             │           │
│  │           │                                       │           │
│  │  ┌────────▼─────────┐                             │           │
│  │  │ Return response  │──► watcher.sh receives this │           │
│  │  │ {action, message}│    and does the tmux work   │           │
│  │  └──────────────────┘                             │           │
│  │                                                   │           │
│  │  Workflow: "Task Manager" (separate)              │           │
│  │  - Stores current task goal                       │           │
│  │  - Tracks chunk number                            │           │
│  │  - Marks task complete                            │           │
│  └───────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

**Key principle:** n8n is the brain. The watcher script is the hands. They communicate via HTTP. The tmux session is never touched by n8n directly.

---

## 4. Phase 1 — tmux Foundation

### Goal
Ensure Claude Code always runs in a named tmux session that can be observed and controlled programmatically.

### 4.1 Create a launcher script

File: `~/.local/bin/cc-work` (or similar)

```bash
#!/usr/bin/env bash
# Launch Claude Code in a managed tmux session

SESSION="cc-work"
PANE="cc-work:0.0"
WORK_DIR="${1:-$(pwd)}"

# Kill existing session if requested
if [ "$1" = "--fresh" ]; then
  tmux kill-session -t "$SESSION" 2>/dev/null
  shift
  WORK_DIR="${1:-$(pwd)}"
fi

# Create session if it doesn't exist
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux new-session -d -s "$SESSION" -c "$WORK_DIR"
fi

# Launch Claude Code in the session
tmux send-keys -t "$PANE" "cd '$WORK_DIR' && claude" C-m

# Attach to the session (shows it to the user)
tmux attach-session -t "$SESSION"
```

### 4.2 Verify tmux is installed

```bash
which tmux || sudo apt install tmux
```

### 4.3 Learn your prompt sentinel

Start Claude Code in tmux, then from a second terminal:
```bash
tmux capture-pane -pt cc-work:0.0 | tail -20
```

Identify the exact string that appears when Claude is idle and waiting for input. It will contain the model name and directory. Example pattern: `❯ ` or `>` or a line with `claude-sonnet`. Record the exact string — you'll hardcode it in the watcher.

---

## 5. Phase 2 — Sentinel Configuration (CLAUDE.md)

### Goal
Teach Claude to output a machine-readable signal at the end of each response when it has finished a natural chunk and is ready for a compact-and-continue cycle. This is **far more reliable** than trying to infer completion from TUI prompt patterns alone.

### 5.1 Add to your global CLAUDE.md

Location: `~/.claude/CLAUDE.md` (applies to all projects)

```markdown
## Chunked Work Protocol

When working on long tasks, you must break your work into chunks. After completing 
each chunk — defined as a logical unit of work that stands on its own (e.g., 
implementing a complete feature, finishing a file, completing a phase of refactoring) — 
output the following sentinel on its own line at the very end of your response:

===CHUNK_DONE===

Rules:
- Output ===CHUNK_DONE=== ONLY when you have genuinely finished a complete unit of work
  and are at a natural stopping point.
- Do NOT output it after partial work, mid-task updates, or when asking a question.
- After outputting it, stop and wait. Do not continue into the next chunk.
- When you resume after a /compact, I will give you a continuation message that 
  tells you what was just compacted and what to do next.

When you receive a continuation message, acknowledge with:
===RESUMING_CHUNK_{N}===
and then proceed with the next chunk.
```

### 5.2 Per-project CLAUDE.md (optional override)

For a specific project, add a `CLAUDE.md` in the project root that defines what constitutes a "chunk" for that project:
```markdown
## Chunk Definition for This Project
A chunk = one complete React component, or one complete API endpoint, or one test suite.
Do not combine multiple chunks in a single response.
```

### 5.3 Why this matters

Without the sentinel, the watcher must detect idle state purely from TUI prompt patterns, which are version-dependent and can produce false positives (e.g., Claude pausing mid-task while waiting for a tool call to complete). The sentinel is Claude's explicit declaration: "I'm done with this chunk, ready for compact."

---

## 6. Phase 3 — The Watcher Script

### Goal
A long-running shell daemon that watches a named tmux pane for the sentinel, validates idle state, POSTs to n8n, and performs the tmux interactions based on n8n's response.

### File: `~/.local/bin/agent-watcher`

```bash
#!/usr/bin/env bash
# Agent Compact Watcher
# Watches a tmux pane for Claude Code chunk completion signals,
# then coordinates /compact + continuation via n8n.

# ─── Configuration ────────────────────────────────────────────
SESSION="cc-work"
PANE="cc-work:0.0"
N8N_WEBHOOK="http://localhost:5678/webhook/agent-watcher"
SENTINEL="===CHUNK_DONE==="
IDLE_PROMPT="❯"                # Update this to match your actual Claude prompt
COMPACT_CMD="/compact"
COMPACT_WAIT=12                # seconds to wait after /compact before sending continuation
POLL_INTERVAL=2                # seconds between pane checks
STATE_FILE="/tmp/agent-watcher.state"
LOG_FILE="$HOME/.local/share/agent-watcher/watcher.log"
# ──────────────────────────────────────────────────────────────

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$ts] $*" | tee -a "$LOG_FILE"
}

get_pane_tail() {
  tmux capture-pane -pt "$PANE" 2>/dev/null | tail -n 40
}

sentinel_visible() {
  get_pane_tail | grep -qF "$SENTINEL"
}

prompt_visible() {
  get_pane_tail | tail -n 5 | grep -qF "$IDLE_PROMPT"
}

claude_is_idle() {
  # Confirm sentinel AND idle prompt both visible, AND CPU is low
  if ! sentinel_visible; then return 1; fi
  if ! prompt_visible; then return 1; fi
  # Secondary check: claude process CPU near zero
  local CLAUDE_PID
  CLAUDE_PID=$(pgrep -f "node.*claude" | head -1)
  if [ -n "$CLAUDE_PID" ]; then
    local cpu
    cpu=$(ps -o %cpu= -p "$CLAUDE_PID" | tr -d ' ')
    # If CPU > 5%, still working
    if awk "BEGIN {exit !($cpu > 5)}"; then
      return 1
    fi
  fi
  return 0
}

call_n8n() {
  local chunk_num
  chunk_num=$(cat "$STATE_FILE" 2>/dev/null || echo "1")
  
  local response
  response=$(curl -s -X POST "$N8N_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{
      \"event\": \"chunk_complete\",
      \"session\": \"$SESSION\",
      \"chunk\": $chunk_num,
      \"timestamp\": \"$(date -Iseconds)\"
    }")
  
  echo "$response"
}

send_compact() {
  log "Sending /compact to $PANE"
  tmux send-keys -t "$PANE" "$COMPACT_CMD" C-m
}

wait_for_compact() {
  log "Waiting ${COMPACT_WAIT}s for compact to complete..."
  local i=0
  while [ $i -lt $COMPACT_WAIT ]; do
    sleep 1
    i=$((i + 1))
    # Check if prompt has returned (compact is done)
    if prompt_visible && ! sentinel_visible; then
      log "Compact appears complete after ${i}s"
      return 0
    fi
  done
  log "Compact wait timed out — proceeding anyway"
}

send_continuation() {
  local message="$1"
  log "Sending continuation: $message"
  # n8n returns the message to inject — send it to the pane
  tmux send-keys -t "$PANE" "$message" C-m
  
  # Increment chunk counter
  local chunk_num
  chunk_num=$(cat "$STATE_FILE" 2>/dev/null || echo "1")
  echo $((chunk_num + 1)) > "$STATE_FILE"
}

# ─── Main loop ────────────────────────────────────────────────

log "Agent Watcher started. Monitoring tmux session: $SESSION"
log "Sentinel: $SENTINEL"
log "n8n webhook: $N8N_WEBHOOK"

LAST_SEEN_SENTINEL=""

while true; do
  # Safety: confirm tmux session exists
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    log "WARNING: tmux session '$SESSION' not found. Waiting..."
    sleep 10
    continue
  fi

  pane_tail=$(get_pane_tail)
  
  # Check for sentinel
  if echo "$pane_tail" | grep -qF "$SENTINEL"; then
    
    # Debounce: only act once per sentinel appearance
    sentinel_hash=$(echo "$pane_tail" | md5sum)
    if [ "$sentinel_hash" = "$LAST_SEEN_SENTINEL" ]; then
      sleep "$POLL_INTERVAL"
      continue
    fi
    
    # Wait for Claude to fully settle (idle prompt must appear)
    log "Sentinel detected. Waiting for idle confirmation..."
    settle_attempts=0
    while ! claude_is_idle && [ $settle_attempts -lt 10 ]; do
      sleep 1
      settle_attempts=$((settle_attempts + 1))
    done
    
    if ! claude_is_idle; then
      log "Could not confirm idle state after ${settle_attempts}s. Skipping cycle."
      LAST_SEEN_SENTINEL="$sentinel_hash"
      sleep "$POLL_INTERVAL"
      continue
    fi
    
    log "Claude is idle at chunk boundary. Starting compact cycle."
    
    # Notify n8n and get continuation message
    n8n_response=$(call_n8n)
    continuation_msg=$(echo "$n8n_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','Please continue with the next chunk.'))" 2>/dev/null)
    
    if [ -z "$continuation_msg" ]; then
      continuation_msg="Context has been compacted. Please continue with the next chunk of the task."
    fi
    
    log "Continuation message from n8n: $continuation_msg"
    
    # Execute the compact cycle
    send_compact
    wait_for_compact
    send_continuation "$continuation_msg"
    
    LAST_SEEN_SENTINEL="$sentinel_hash"
    log "Compact cycle complete. Resuming watch."
  fi

  sleep "$POLL_INTERVAL"
done
```

### Install the watcher as a systemd user service

Create `~/.config/systemd/user/agent-watcher.service`:
```ini
[Unit]
Description=Agent Compact Watcher — monitors Claude Code tmux pane
After=default.target

[Service]
ExecStart=/home/adamgoodwin/.local/bin/agent-watcher
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

Enable:
```bash
systemctl --user daemon-reload
systemctl --user enable agent-watcher
systemctl --user start agent-watcher
```

---

## 7. Phase 4 — n8n Workflows

### 7.1 Enable Execute Command in your n8n Docker container

Your current n8n setup needs this environment variable added. Edit the Docker run command or update the container:

```bash
# Stop the existing container
docker stop n8n

# Restart with Execute Command enabled
docker run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=false \
  -e N8N_ENABLE_EXECUTE_COMMAND=true \
  docker.n8n.io/n8nio/n8n
```

Or if using docker-compose, add to the `environment:` section:
```yaml
- N8N_ENABLE_EXECUTE_COMMAND=true
```

### 7.2 Workflow 1: "Task Manager" (set up first)

**Purpose:** Store and manage the current task goal, chunk count, and continuation messages.

**Nodes:**
```
Webhook (POST /webhook/set-task)
  ├── Body: { goal: string, project: string }
  └── Set Node: Store goal in n8n variables
      └── Respond to Webhook: { success: true, task_id: "..." }
```

You call this webhook at the START of each coding session to tell n8n what you're working on:
```bash
curl -X POST http://localhost:5678/webhook/set-task \
  -H "Content-Type: application/json" \
  -d '{"goal": "Build the user authentication system with JWT, refresh tokens, and middleware", "project": "my-app"}'
```

### 7.3 Workflow 2: "Agent Watcher" (core workflow)

**Purpose:** Receives chunk-complete events from the watcher script, builds the right continuation message, returns it.

**Nodes:**
```
Webhook (POST /webhook/agent-watcher)
  └── Set Node: Extract chunk_num, session, timestamp
      └── Execute Command: 
          command: "cat /home/node/.n8n/current-task.json 2>/dev/null || echo '{}'"
          (reads task goal stored by Task Manager workflow)
      └── Code Node (JavaScript):
          // Build the continuation message based on chunk number and task goal
          const task = JSON.parse($input.first().json.stdout || '{}')
          const chunkNum = $('Webhook').first().json.body.chunk
          const goal = task.goal || 'the current task'
          
          let message
          if (chunkNum === 1) {
            message = `Context has been compacted. Original goal: "${goal}". This was chunk 1. Continue with chunk 2 — pick up exactly where you left off.`
          } else {
            message = `Context compacted after chunk ${chunkNum}. Goal: "${goal}". Continue with chunk ${chunkNum + 1}.`
          }
          
          return [{ json: { message, chunk: chunkNum, goal } }]
      └── Respond to Webhook: 
          { message: "{{ $json.message }}" }
```

### 7.4 Workflow 3: "Watcher Status Dashboard" (optional)

**Purpose:** A simple webhook that returns the current watcher state — useful for monitoring from a browser or another script.

```
Webhook (GET /webhook/watcher-status)
  └── Execute Command: "cat /home/adamgoodwin/.local/share/agent-watcher/watcher.log | tail -50"
      └── Respond to Webhook: { log: "..." }
```

---

## 8. Phase 5 — Continuation Context

Your plans are already built in context-window-sized executable chunks. This means the continuation message is simple: **"carry on with the next chunk"** is enough. Claude already knows the full plan structure from earlier in the session; after `/compact` it has a compressed summary of completed work and the plan is still in scope.

### 8.1 The watcher sends

```
carry on with the next chunk
```

n8n's "Agent Watcher" workflow just returns this string. No complex task-file machinery needed. The structure comes from your plan, not from the automation.

### 8.2 When to add more detail

If a session spans many chunks and you're worried the compressed summary will lose track of the goal, the Task Manager webhook lets you optionally pass a reminder string:

```bash
curl -X POST http://localhost:5678/webhook/set-task \
  -H "Content-Type: application/json" \
  -d '{"continuation": "carry on with the next chunk — goal is JWT auth system"}'
```

n8n uses this string instead of the default. Completely optional — the plain "carry on" is the default and works for standard chunked sessions.

### 8.3 AGENTS.md for Codex (analogous to CLAUDE.md)

Codex reads `~/.codex/AGENTS.md`. Add the same sentinel protocol:
```markdown
## Chunk Protocol
At the end of each chunk, output ===CHUNK_DONE=== and stop.
When resumed, acknowledge with ===RESUMING_CHUNK_N===.
```

---

## 9. Phase 6 — Codex Adaptation

Codex has `/compact` — it works the same way as Claude Code. The watcher script handles Codex with no fundamental changes, only a different session name and pane target.

```bash
# Launch either Claude Code or Codex
agent-watcher --agent claude --session cc-work
agent-watcher --agent codex  --session codex-work
```

The `--agent` parameter controls:
- Which tmux session/pane to watch
- What idle prompt string to look for (Claude uses `❯`, Codex may differ — check with `tmux capture-pane` in Phase 1)

Both use the same sentinel (`===CHUNK_DONE===`), the same `/compact` command, and the same "carry on with the next chunk" continuation. Sentinel instruction goes in `~/.codex/AGENTS.md` instead of `~/.claude/CLAUDE.md`.

The watcher script in Phase 3 already has `SESSION` and `PANE` as variables at the top — parameterizing it is straightforward.

---

## 10. Enable Execute Command in n8n Docker

The Execute Command node in your n8n container is currently disabled. Two ways to enable it:

### Option A: Update the existing container

```bash
docker stop n8n && docker rm n8n
docker run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_ENABLE_EXECUTE_COMMAND=true \
  docker.n8n.io/n8nio/n8n:2.27.5
```

### Option B: docker-compose (preferred, easier to manage)

Create `~/n8n-compose/docker-compose.yml`:
```yaml
version: '3.8'
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:2.27.5
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
      # Mount task file so n8n can read it
      - /home/adamgoodwin:/home/adamgoodwin:ro
    environment:
      - N8N_ENABLE_EXECUTE_COMMAND=true
      - GENERIC_TIMEZONE=America/Edmonton
volumes:
  n8n_data:
    external: true
```

**Important:** The volume mount `/home/adamgoodwin:/home/adamgoodwin:ro` lets n8n's Execute Command node read the task file you write on the host. Without this, n8n can only see files inside the container.

---

## 11. Edge Cases and Failure Modes

| Scenario | What happens without a fix | Fix |
|---|---|---|
| Claude sends `/compact` mid-sentence (sentinel appears during streaming) | Watcher fires too early, corrupt input | `claude_is_idle()` checks idle prompt + CPU before acting |
| watcher fires twice for same sentinel | Double-compact, lost context | `LAST_SEEN_SENTINEL` debounce via md5sum of pane tail |
| n8n is down when watcher calls it | Watcher has no continuation message | Fallback message in watcher script if curl fails |
| Claude ignores the sentinel instruction | Watcher never fires | Per-session prompt reminder: "Remember the ===CHUNK_DONE=== protocol" |
| Compact takes longer than `COMPACT_WAIT` | Continuation is sent while Claude is still compacting | Extended wait + prompt-visible check |
| User is typing when watcher fires | watcher injects `/compact` into user's partially typed text | Watcher checks if pane input area is empty before sending. Hard to detect — may need a "pause watcher" keybind. |
| Task file is missing when n8n tries to read it | n8n returns empty continuation | Fallback: "Continue with the overall task" |
| tmux session dies (Claude crashed) | Watcher logs error, systemd restarts watcher, it waits | `tmux has-session` check at top of loop |
| Multiple Claude sessions running | Watcher monitors wrong pane | Session name and pane ID are hardcoded per watcher instance — run separate watcher instances for separate sessions |

### 11.1 Pause keybind (important for user control)

Add a tmux keybind that toggles the watcher on/off:
```bash
# In ~/.tmux.conf
bind-key W run-shell "systemctl --user toggle agent-watcher && tmux display-message 'Watcher toggled'"
```

Then `Prefix + W` pauses/resumes the watcher so you can type without interference.

---

## 12. Build Order and Milestones

### Milestone 1 — Manual validation (no automation yet)
- [ ] Set up tmux session `cc-work` with Claude Code
- [ ] Add sentinel instruction to `~/.claude/CLAUDE.md`
- [ ] Start a coding session, verify Claude outputs `===CHUNK_DONE===`
- [ ] Manually run `tmux send-keys -t cc-work:0.0 "/compact" C-m` and verify compact works
- [ ] Manually send continuation message and verify Claude resumes correctly

### Milestone 2 — Watcher script (no n8n yet)
- [ ] Write and install `~/.local/bin/agent-watcher`
- [ ] Run it manually: `agent-watcher --dry-run` (logs what it would do without sending keys)
- [ ] Verify it detects sentinel reliably
- [ ] Verify `claude_is_idle()` returns true/false correctly
- [ ] Enable live mode: verify it sends `/compact` and continuation

### Milestone 3 — n8n integration
- [ ] Enable Execute Command in n8n Docker
- [ ] Build "Task Manager" workflow and test `set-task` webhook
- [ ] Build "Agent Watcher" webhook workflow
- [ ] Connect watcher script to n8n (add N8N_WEBHOOK URL)
- [ ] Test full cycle: Claude → sentinel → watcher → n8n → compact → continue

### Milestone 4 — Systemd service
- [ ] Install watcher as systemd user service
- [ ] Test auto-restart on failure
- [ ] Add tmux pause keybind
- [ ] Verify watcher auto-starts on login

### Milestone 5 — Codex adaptation
- [ ] Add `--agent` parameter to watcher script (different session name, different idle prompt)
- [ ] Add sentinel instruction to `~/.codex/AGENTS.md`
- [ ] Test full cycle with Codex session

---

## 13. File Map

```
~/.claude/CLAUDE.md                    ← sentinel + chunk protocol instruction
~/.codex/AGENTS.md                     ← same for Codex

~/.local/bin/agent-watcher             ← main watcher daemon
~/.local/share/agent-watcher/watcher.log  ← runtime log
/tmp/agent-watcher.state               ← current chunk number (ephemeral)
~/.agent-task.json                     ← current task goal + chunk definitions

~/.config/systemd/user/agent-watcher.service  ← systemd service file
~/.tmux.conf                           ← tmux keybind for pause/resume

n8n Workflows (in n8n UI):
  - "Task Manager"    → POST /webhook/set-task
  - "Agent Watcher"   → POST /webhook/agent-watcher
  - "Watcher Status"  → GET  /webhook/watcher-status

~/n8n-compose/docker-compose.yml       ← updated docker-compose with N8N_ENABLE_EXECUTE_COMMAND
```

---

## Research Sources

- Perplexity Deep Research: "Automating Claude Code CLI with tmux and Shell Scripting" (2026-06-29)
- Perplexity Deep Research: "n8n-Based Linux Process Monitoring and Automation" (2026-06-29)
- Claude Code official docs: memory, commands, interactive-mode, settings
- n8n official docs: Execute Command, Webhook, Wait, Local File Trigger, workflow timeouts
- n8n community: long-running workflow limitations, Execute Command node disabled by default, Local File Trigger Docker path issues
- tmux: Tao-of-tmux scripting guide (send-keys, capture-pane)
- Related projects: TUI-use, TmuxAI (tmux-based terminal automation patterns)
