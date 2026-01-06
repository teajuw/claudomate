# Claudomate Design Specification v2

> **Purpose**: This document captures the complete design vision, architecture, and implementation plan for claudomate. It is the authoritative source of truth for development decisions and should persist across sessions.
>
> **Last Updated**: 2026-01-06

---

## Table of Contents

1. [Vision & Motivation](#vision--motivation)
2. [Core Concepts](#core-concepts)
3. [Architecture Overview](#architecture-overview)
4. [Component Specifications](#component-specifications)
5. [Data Flow](#data-flow)
6. [GitHub Integration](#github-integration)
7. [Agent Workflow](#agent-workflow)
8. [Task Management](#task-management)
9. [File & Directory Structure](#file--directory-structure)
10. [API Specification](#api-specification)
11. [Frontend Specification](#frontend-specification)
12. [Security & Isolation](#security--isolation)
13. [MVP Scope](#mvp-scope)
14. [Future Roadmap](#future-roadmap)
15. [Open Questions](#open-questions)
16. [References](#references)

---

## Vision & Motivation

### The Problem

Solo developers need to produce large-scale projects efficiently. Current AI-assisted development (single Claude instance) has limitations:
- Sequential execution — waiting on one task blocks others
- Context limits — single agent can lose track of large codebases
- No guardrails — agents with full permissions can spiral out of control
- No visibility — hard to manage multiple parallel workstreams

### The Solution

**Claudomate** is a mission control interface for managing fleets of Claude Code agents. It enables:
- **Parallel execution** — multiple agents working simultaneously
- **Role specialization** — focused agents with distinct system prompts
- **Guardrails via Git** — agents work in isolated branches, changes reviewed via PRs
- **Human-in-the-loop** — user acts as manager, agents escalate on conflicts/errors
- **Visibility** — real-time status, logs, and task tracking

### Design Philosophy

1. **Leverage existing tools** — Claude Code CLI, GitHub, git worktrees
2. **File-based communication** — agents share context via artifacts (Markdown, code), not direct messaging
3. **GitHub as backbone** — Issues for tasks, PRs for deliverables, webhooks for sync
4. **Minimal infrastructure** — no database, state lives in GitHub + localStorage
5. **Anthropic best practices** — follow [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)

### Target User

- Solo developer or small team
- Wants to "manage" AI agents like a tech lead manages engineers
- Comfortable with GitHub workflow (Issues, PRs, branches)
- Uses Claude Code CLI regularly ("vibe coding")

---

## Core Concepts

### Agent

A Claude Code instance with:
- **Role** — specialized system prompt (coder, reviewer, researcher, architect, or custom)
- **Worktree** — isolated git working directory
- **Task** — current GitHub Issue being worked on
- **Scratchpad** — per-agent TASKS.md for subtask breakdown

### Task

A unit of work represented as:
- **GitHub Issue** — source of truth, high-level description
- **Agent TASKS.md** — execution plan with checkboxes

### Fleet

A collection of agents working on the same project repository.

### Worktree

Git worktree providing filesystem isolation per agent. Each agent has its own branch and working directory, enabling parallel work without conflicts.

### Scratchpad

Per-agent Markdown file (`TASKS.md` or `SCRATCHPAD.md`) where agents:
- Break down issues into subtasks
- Track progress with checkboxes
- Document findings and decisions

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLAUDOMATE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         GITHUB (Cloud)                               │    │
│  │                                                                      │    │
│  │   claudomate repo          target repo (e.g., calendar-app)         │    │
│  │   └── tool source          ├── Issues (task source of truth)        │    │
│  │                            ├── Pull Requests (deliverables)         │    │
│  │                            ├── Branches (per-agent work)            │    │
│  │                            └── Webhooks → claudomate server         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                       │                                      │
│                                       │ webhooks (issue/PR events)           │
│                                       ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      CLAUDOMATE SERVER (localhost:3002)              │    │
│  │                                                                      │    │
│  │   ├── Express REST API (agent CRUD, task management)                │    │
│  │   ├── WebSocket server (real-time UI updates)                       │    │
│  │   ├── GitHub webhook receiver (issue/PR sync)                       │    │
│  │   ├── Agent spawner (claude CLI processes)                          │    │
│  │   ├── Worktree manager (git worktree create/delete)                 │    │
│  │   └── File watcher (agent scratchpad changes)                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│           │                                      ▲                           │
│           │ spawn processes                      │ stdout/stderr             │
│           ▼                                      │                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         AGENT CONTAINERS                             │    │
│  │                                                                      │    │
│  │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │    │
│  │   │   Agent 1     │  │   Agent 2     │  │   Agent 3     │           │    │
│  │   │   (coder)     │  │  (reviewer)   │  │  (researcher) │           │    │
│  │   │               │  │               │  │               │           │    │
│  │   │ worktree:     │  │ worktree:     │  │ worktree:     │           │    │
│  │   │ /proj/agent-1 │  │ /proj/agent-2 │  │ /proj/agent-3 │           │    │
│  │   │               │  │               │  │               │           │    │
│  │   │ branch:       │  │ branch:       │  │ branch:       │           │    │
│  │   │ agent-1/feat  │  │ agent-2/review│  │ agent-3/research│         │    │
│  │   └───────────────┘  └───────────────┘  └───────────────┘           │    │
│  │           │                  │                  │                    │    │
│  │           └──────────────────┴──────────────────┘                    │    │
│  │                              │                                       │    │
│  │                              ▼                                       │    │
│  │                    Target Repo (mounted)                             │    │
│  │                    └── gh CLI for GitHub operations                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      CLAUDOMATE UI (localhost:3001)                  │    │
│  │                                                                      │    │
│  │   ├── Agent grid (card stacks per agent)                            │    │
│  │   ├── Task cards (synced from GitHub Issues)                        │    │
│  │   ├── Real-time status (WebSocket)                                  │    │
│  │   ├── Log viewer (per-agent output)                                 │    │
│  │   ├── Chat panel (stdin to running agent)                           │    │
│  │   └── Activity log (timeline of events)                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Claudomate Server (`server/index.js`)

**Responsibilities:**
- Spawn and manage Claude Code CLI processes
- Create/delete git worktrees per agent
- Receive GitHub webhooks for issue/PR events
- Broadcast state changes to UI via WebSocket
- Watch agent scratchpad files for changes

**Key Dependencies:**
- `express` — HTTP server
- `ws` — WebSocket server
- `child_process` — spawn claude CLI
- `chokidar` — file watching (or native `fs.watch`)
- `octokit` or `gh` CLI — GitHub API

### 2. Claudomate UI (`app.js`, `index.html`, `style.css`)

**Responsibilities:**
- Display agent grid with status indicators
- Show tasks synced from GitHub Issues
- Provide controls: start, stop, chat, view logs
- Real-time updates via WebSocket
- Persist UI preferences in localStorage

**Design Principles:**
- Modern-retro hybrid aesthetic (existing style preserved)
- Monospace typography for technical feel
- Bracket notation for buttons `[start]`, `[stop]`
- Status colors: green (active), yellow (paused), red (error), gray (idle)

### 3. Agent Process

**Execution Model:** One-shot (`claude --print`)

Each agent runs as:
```bash
claude --print \
  --system-prompt "$(cat agent-system-prompt.md)" \
  "Work on issue #42: <issue body>.
   Use TASKS.md as your working checklist.
   Follow Explore → Plan → Code → Commit workflow.
   When done, create a PR with 'Fixes #42'."
```

**Agent has access to:**
- Its own worktree (isolated branch)
- `gh` CLI for GitHub operations
- Internet (for npm install, searches, etc.)
- Shared project files (read-only from other worktrees via git)

### 4. Worktree Manager

**Auto-creation flow:**
```bash
# When agent is assigned to a repo
git worktree add ../project-agent-coder-1 -b agent/coder-1/issue-42
```

**Directory structure:**
```
/home/user/projects/
├── calendar-app/              # Main checkout (your view)
│   └── .git/                  # Shared git directory
├── calendar-app-agent-coder-1/    # Agent 1 worktree
│   └── TASKS.md               # Agent 1 scratchpad
├── calendar-app-agent-coder-2/    # Agent 2 worktree
│   └── TASKS.md               # Agent 2 scratchpad
└── claudomate/                # The tool itself
```

### 5. File Watcher

**Purpose:** Detect when agents update their TASKS.md scratchpads

**Implementation:**
```javascript
import chokidar from 'chokidar';

chokidar.watch('/path/to/worktrees/*/TASKS.md').on('change', (path) => {
  const tasks = parseTasksMarkdown(fs.readFileSync(path, 'utf8'));
  broadcast({ type: 'tasks_updated', agentId, tasks });
});
```

**Markdown parsing:** Simple regex for checkboxes
```javascript
const TASK_REGEX = /^- \[([ x])\] (.+)$/gm;
// Matches: - [ ] uncompleted task
//          - [x] completed task
```

---

## Data Flow

### Task Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TASK LIFECYCLE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CREATE                                                                   │
│     You create GitHub Issue #42: "Implement user auth"                      │
│         │                                                                    │
│         ▼                                                                    │
│     GitHub webhook → claudomate server                                      │
│         │                                                                    │
│         ▼                                                                    │
│     UI shows new task in "Backlog" column                                   │
│                                                                              │
│  2. ASSIGN                                                                   │
│     You assign issue to coder-1 (via UI or GitHub label)                    │
│         │                                                                    │
│         ▼                                                                    │
│     claudomate creates worktree + branch for agent                          │
│         │                                                                    │
│         ▼                                                                    │
│     Task moves to "Assigned" column                                         │
│                                                                              │
│  3. EXECUTE                                                                  │
│     You click [start] on agent                                              │
│         │                                                                    │
│         ▼                                                                    │
│     claudomate spawns: claude --print "<issue + instructions>"              │
│         │                                                                    │
│         ▼                                                                    │
│     Agent creates TASKS.md with subtask breakdown:                          │
│       - [ ] Explore existing auth patterns                                  │
│       - [ ] Design auth flow                                                │
│       - [ ] Implement login endpoint                                        │
│       - [ ] Add tests                                                       │
│       - [ ] Create PR                                                       │
│         │                                                                    │
│         ▼                                                                    │
│     Agent works through checklist (Explore → Plan → Code → Commit)          │
│         │                                                                    │
│         ▼                                                                    │
│     File watcher detects TASKS.md changes → UI updates in real-time         │
│                                                                              │
│  4. DELIVER                                                                  │
│     Agent runs: gh pr create --title "..." --body "Fixes #42"               │
│         │                                                                    │
│         ▼                                                                    │
│     GitHub webhook → claudomate (PR opened)                                 │
│         │                                                                    │
│         ▼                                                                    │
│     Task moves to "In Review" column                                        │
│         │                                                                    │
│         ▼                                                                    │
│     (Optional) Reviewer agent auto-triggered                                │
│                                                                              │
│  5. COMPLETE                                                                 │
│     You merge PR on GitHub                                                  │
│         │                                                                    │
│         ▼                                                                    │
│     GitHub auto-closes issue #42 (via "Fixes #42")                          │
│         │                                                                    │
│         ▼                                                                    │
│     Webhook → claudomate → Task moves to "Done"                             │
│         │                                                                    │
│         ▼                                                                    │
│     claudomate cleans up worktree (optional)                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Communication Model

**Phase 1 (MVP): Hub-and-spoke**
```
        You (manager)
       /    |    \
      /     |     \
   Agent1 Agent2 Agent3
```
- Agents don't communicate directly
- All coordination through you
- Artifacts (code, PRs) visible to all

**Phase 2: Shared artifacts**
```
   Agent1 ──PR──► GitHub ◄──Review── Agent2
```
- Agents communicate through GitHub (PRs, comments)
- Reviewer agent sees coder's PR
- No direct agent-to-agent messaging

**Phase 3 (Future): Direct messaging**
```
   Agent1 ◄──────► Agent2
      \              /
       \            /
        ►  Agent3  ◄
```
- Agents can request help from each other
- Requires more complex orchestration

---

## GitHub Integration

### Authentication Options

| Method | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| Personal Access Token (PAT) | Simple setup | Broad permissions, tied to your account | Good for MVP |
| GitHub App | Scoped permissions, bot identity, better for teams | More setup, needs webhook endpoint | Better long-term |

### Required Permissions

For PAT (classic):
- `repo` — full repository access
- `workflow` — if using GitHub Actions

For GitHub App:
- Repository permissions:
  - Issues: Read & Write
  - Pull Requests: Read & Write
  - Contents: Read & Write
  - Metadata: Read
- Subscribe to events:
  - Issues
  - Pull Request
  - Push

### Webhook Setup

**Endpoint:** `POST /api/webhooks/github`

**Events to handle:**
```javascript
// Issue events
'issues.opened'     → Add task to UI
'issues.closed'     → Mark task complete
'issues.labeled'    → Handle agent assignment
'issues.assigned'   → Handle agent assignment

// PR events
'pull_request.opened'   → Link PR to task, move to "In Review"
'pull_request.closed'   → If merged, mark task complete
'pull_request.review_requested' → Trigger reviewer agent

// Push events
'push' → Update UI with new commits
```

### Agent GitHub Operations

Agents use `gh` CLI (pre-authenticated):

```bash
# Close issue
gh issue close 42 --comment "Completed in PR #56"

# Create PR
gh pr create \
  --title "Implement user auth" \
  --body "Fixes #42\n\n## Summary\n..." \
  --base main \
  --head agent/coder-1/issue-42

# Add comment
gh issue comment 42 --body "Starting work on this issue"

# Add label
gh issue edit 42 --add-label "status:in-progress"
```

---

## Agent Workflow

### System Prompt Template

```markdown
# Role: {{ROLE_NAME}}

You are a {{ROLE_NAME}} agent working as part of a multi-agent development team.

## Your Identity
- Agent ID: {{AGENT_ID}}
- Working directory: {{WORKTREE_PATH}}
- Branch: {{BRANCH_NAME}}

## Current Assignment
- Issue: #{{ISSUE_NUMBER}}
- Title: {{ISSUE_TITLE}}
- Description: {{ISSUE_BODY}}

## Workflow: Explore → Plan → Code → Commit

1. **EXPLORE** (do this first!)
   - Read relevant files to understand the codebase
   - Identify patterns, conventions, and dependencies
   - Do NOT write code yet

2. **PLAN**
   - Create/update TASKS.md with your subtask breakdown
   - Use checkbox format: `- [ ] task description`
   - Think through the approach before coding

3. **CODE**
   - Implement one subtask at a time
   - Check off completed items in TASKS.md
   - Follow existing code patterns

4. **COMMIT**
   - Make atomic commits with clear messages
   - When all subtasks done, create PR with `gh pr create`
   - Include "Fixes #{{ISSUE_NUMBER}}" in PR body

## Rules
- Stay focused on your assigned issue
- If blocked or confused, document in TASKS.md and stop
- Do not modify files outside your scope without noting it
- Check off TASKS.md items as you complete them

## Tools Available
- `gh` CLI for GitHub operations
- All standard development tools (npm, git, etc.)
- Internet access for documentation/research
```

### Role-Specific Prompts

**Coder:**
```markdown
You are a senior developer. Write clean, tested code.
- Follow existing patterns in the codebase
- Create atomic commits with clear messages
- Write tests for new functionality
- Create PR when done with "Fixes #<issue>"
```

**Reviewer:**
```markdown
You review pull requests for quality and correctness.
- Check for: bugs, security issues, style consistency, test coverage
- Be constructive and specific
- Approve or request changes with clear feedback
- Use `gh pr review` to submit review
```

**Researcher:**
```markdown
You research topics and document findings.
- Output: structured markdown with sources
- Focus on actionable insights
- Save findings to RESEARCH.md in the repo
- Summarize key decisions and trade-offs
```

**Architect:**
```markdown
You design systems and create technical specs.
- Consider: scalability, maintainability, trade-offs
- Output: design docs, diagrams (mermaid), ADRs
- Document in docs/ directory
- Create issues for implementation tasks
```

---

## Task Management

### Two-Layer Task System

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: GitHub Issues (Source of Truth)                       │
│                                                                  │
│  Issue #42: "Implement user authentication"                     │
│  - Labels: priority:high, agent:coder-1, status:in-progress    │
│  - Assignee: (not used, labels preferred for agents)            │
│  - Milestone: v1.0                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Agent picks up issue
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Agent TASKS.md (Execution Plan)                       │
│                                                                  │
│  # Issue #42: Implement user authentication                     │
│                                                                  │
│  ## Exploration Notes                                           │
│  - Found existing session handling in src/auth/session.js       │
│  - Using JWT pattern from similar projects                      │
│                                                                  │
│  ## Tasks                                                        │
│  - [x] Explore existing auth patterns                           │
│  - [x] Design auth flow (documented in docs/AUTH.md)            │
│  - [ ] Implement /api/login endpoint                            │
│  - [ ] Implement /api/logout endpoint                           │
│  - [ ] Add JWT token generation                                 │
│  - [ ] Add auth middleware                                      │
│  - [ ] Write tests                                              │
│  - [ ] Create PR                                                │
│                                                                  │
│  ## Blockers                                                    │
│  (none currently)                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Task States in UI

| State | GitHub Status | UI Column | Color |
|-------|---------------|-----------|-------|
| Backlog | Open, no agent label | Backlog | Gray |
| Assigned | Open, has `agent:X` label | Assigned | Yellow |
| In Progress | Open, agent running | In Progress | Blue |
| In Review | PR open | In Review | Purple |
| Done | Closed | Done | Green |

### Label Convention

```
agent:coder-1       # Assigned to coder-1
agent:reviewer-1    # Assigned to reviewer-1
status:blocked      # Agent is blocked, needs help
status:in-progress  # Agent actively working
priority:high       # High priority
priority:low        # Low priority
type:bug            # Bug fix
type:feature        # New feature
type:research       # Research task
```

---

## File & Directory Structure

### Claudomate Repository

```
claudomate/
├── package.json
├── index.html              # Main UI
├── app.js                  # Frontend logic
├── style.css               # Styling
├── server/
│   ├── package.json
│   ├── index.js            # Main server
│   ├── github.js           # GitHub API/webhook handling
│   ├── worktree.js         # Git worktree management
│   ├── agent.js            # Agent spawning/management
│   ├── watcher.js          # File watching
│   └── parser.js           # Markdown parsing
├── prompts/
│   ├── coder.md            # Coder system prompt
│   ├── reviewer.md         # Reviewer system prompt
│   ├── researcher.md       # Researcher system prompt
│   └── architect.md        # Architect system prompt
├── docs/
│   ├── DESIGN.md           # Original design (deprecated)
│   └── DESIGN_V2.md        # This document
└── .env.example            # Environment variables template
```

### Target Repository (Agent Working Directory)

```
calendar-app/                    # Main checkout
├── .git/                        # Shared git directory
├── src/
├── package.json
└── CLAUDE.md                    # Project instructions for agents

calendar-app-agent-coder-1/      # Agent 1 worktree
├── src/                         # Working copy
├── TASKS.md                     # Agent 1 scratchpad
└── CLAUDE.md                    # Inherited from main

calendar-app-agent-reviewer-1/   # Agent 2 worktree
├── src/
├── TASKS.md
└── CLAUDE.md
```

---

## API Specification

### REST Endpoints

```
# Health
GET  /api/health

# Agents
GET    /api/agents                    # List all agents
POST   /api/agents                    # Create agent
GET    /api/agents/:id                # Get agent details
DELETE /api/agents/:id                # Delete agent
POST   /api/agents/:id/start          # Start agent on task
POST   /api/agents/:id/stop           # Stop agent
POST   /api/agents/:id/message        # Send message to stdin

# Projects (new)
GET    /api/projects                  # List configured projects
POST   /api/projects                  # Add project (repo URL)
DELETE /api/projects/:id              # Remove project

# Tasks (synced from GitHub)
GET    /api/projects/:id/tasks        # List issues for project
POST   /api/projects/:id/tasks/:issue/assign  # Assign issue to agent

# Worktrees (new)
GET    /api/projects/:id/worktrees    # List worktrees
POST   /api/projects/:id/worktrees    # Create worktree for agent
DELETE /api/worktrees/:id             # Delete worktree

# GitHub Webhooks
POST   /api/webhooks/github           # Receive GitHub events
```

### WebSocket Messages

**Server → Client:**
```javascript
// Initial state
{ type: 'init', agents: [...], projects: [...] }

// Agent status change
{ type: 'agent_status', agentId: '...', status: 'running' }

// Agent log output
{ type: 'agent_log', agentId: '...', entry: { time, source, text } }

// Task update (from GitHub webhook)
{ type: 'task_update', projectId: '...', issue: {...} }

// Scratchpad update (from file watcher)
{ type: 'scratchpad_update', agentId: '...', tasks: [...] }
```

**Client → Server:**
```javascript
// Subscribe to project
{ type: 'subscribe', projectId: '...' }

// Send chat message
{ type: 'chat', agentId: '...', message: '...' }
```

---

## Frontend Specification

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  claudomate                                            [+ add agent]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  coder-1        │  │  coder-2        │  │  reviewer-1     │             │
│  │  ● active 12m   │  │  ○ idle         │  │  ○ idle         │             │
│  │                 │  │                 │  │                 │             │
│  │  // tasks       │  │  // tasks       │  │  // tasks       │             │
│  │  ☑ Issue #42    │  │  ☐ Issue #45    │  │  ☐ PR #43       │             │
│  │    [4/6 done]   │  │    [0/4 done]   │  │    [pending]    │             │
│  │                 │  │                 │  │                 │             │
│  │  [▶ start]      │  │  [▶ start]      │  │  [▶ start]      │             │
│  │  [⏸ pause]      │  │  [⏸ pause]      │  │  [⏸ pause]      │             │
│  │  [⏹ stop]       │  │  [⏹ stop]       │  │  [⏹ stop]       │             │
│  │  [💬 chat]      │  │  [💬 chat]      │  │  [💬 chat]      │             │
│  │  [📋 log]       │  │  [📋 log]       │  │  [📋 log]       │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  // activity_log                                              [minimize]    │
│  14:32 [coder-1] started task: Issue #42                                   │
│  14:33 [coder-1] created TASKS.md with 6 subtasks                          │
│  14:35 [coder-1] completed: Explore existing auth patterns                 │
│  14:38 [system] GitHub webhook: PR #43 opened                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Card Components

```
┌─────────────────────────────────────┐
│  🔧 coder-1                         │  ← Role icon + name
│  ● active · 12m                     │  ← Status dot + duration
├─────────────────────────────────────┤
│  // system_prompt                   │
│  You are a senior developer...      │  ← Truncated prompt preview
│  [edit]                             │
├─────────────────────────────────────┤
│  // current_task                    │
│  Issue #42: Implement user auth     │  ← Linked to GitHub
│  ├─ [x] Explore patterns            │  ← From agent's TASKS.md
│  ├─ [x] Design auth flow            │
│  ├─ [ ] Implement login             │  ← Current subtask
│  ├─ [ ] Implement logout            │
│  └─ [ ] Create PR                   │
│  [4/6 complete]                     │
├─────────────────────────────────────┤
│  [▶ start] [⏸ pause] [⏹ stop]      │
│  [💬 chat] [📋 log]                 │
├─────────────────────────────────────┤
│  done: pr                           │  ← Done mode
│  tokens: 45.2k (session)            │  ← Usage tracking
│  commits: 3                         │
│  branch: agent/coder-1/issue-42     │
└─────────────────────────────────────┘
```

---

## Security & Isolation

### Filesystem Isolation

Each agent runs in its own worktree:
```bash
# Agent can only access its worktree
docker run \
  -v /path/to/calendar-app-agent-coder-1:/workspace:rw \
  -v /path/to/calendar-app/.git:/workspace/.git:rw \
  --workdir /workspace \
  claude-agent
```

### Network Access

Agents HAVE internet access (needed for `gh` CLI, npm, etc.)

Network isolation is NOT the goal — filesystem isolation is.

### Git Branch Protection

Target repo should have:
- Branch protection on `main`
- Require PR reviews before merge
- Require status checks (CI)

This ensures agent code is reviewed before merging.

### Credentials

- `gh` CLI uses existing auth (`gh auth login`)
- Agents inherit host's GitHub credentials
- For Docker: mount `~/.config/gh` or use `GITHUB_TOKEN` env var

---

## MVP Scope

### In Scope (Build First)

1. **GitHub Integration**
   - [ ] GitHub App or PAT setup
   - [ ] Webhook receiver for issue/PR events
   - [ ] `gh` CLI wrapper for agent operations

2. **Worktree Management**
   - [ ] Auto-create worktree when agent assigned to issue
   - [ ] Branch naming: `agent/{agent-name}/issue-{number}`
   - [ ] Cleanup worktree on task completion (optional)

3. **Agent Execution**
   - [ ] Spawn `claude --print` with system prompt + issue context
   - [ ] Capture stdout/stderr, broadcast to UI
   - [ ] Watch agent's TASKS.md for progress updates

4. **Task Sync**
   - [ ] Fetch issues from GitHub on project add
   - [ ] Update UI when webhook received
   - [ ] Parse agent TASKS.md for subtask progress

5. **UI Updates**
   - [ ] Show GitHub issue as task source
   - [ ] Display subtask progress from TASKS.md
   - [ ] Link to GitHub issue/PR

### Out of Scope (Future)

- [ ] Docker containerization
- [ ] Multiple target repos simultaneously
- [ ] Workflow templates (waterfall, agile)
- [ ] Agent-to-agent direct messaging
- [ ] RAG/vector DB for long-term memory
- [ ] Chrome/browsing agent
- [ ] Cost tracking per agent
- [ ] GitHub Actions integration

---

## Future Roadmap

### Phase 2: Multi-Repo & Docker

- Support multiple target repositories
- Docker containers per agent for full isolation
- Volume mounts for worktrees

### Phase 3: Workflow Templates

- Configurable workflows (YAML/JSON)
- Waterfall: Architect → Coder → Reviewer → Tester
- Agile: Parallel coders, continuous review
- Custom: User-defined agent pipelines

### Phase 4: Advanced Coordination

- Agent-to-agent messaging
- Automatic task handoff based on done_mode
- Conflict detection and resolution

### Phase 5: Intelligence Layer

- RAG for codebase knowledge
- Vector DB for long-term memory
- Learning from past tasks

### Phase 6: Extended Capabilities

- Chrome integration for web browsing agents
- Computer use for GUI interactions
- Voice interface for commands

---

## Open Questions

1. **Task assignment UX**: Drag-and-drop in UI? Labels in GitHub? Both?

2. **Agent failure handling**: Auto-retry? Alert and wait? Reassign to different agent?

3. **Worktree lifecycle**: Delete after task done? Keep for reference? Configurable?

4. **Multi-agent on same issue**: Allow? Prevent? How to coordinate?

5. **Context handoff**: When new agent picks up old agent's work, what context to pass?

6. **Rate limiting**: How many agents can run simultaneously? Resource limits?

---

## References

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) — Primary design reference
- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Git Worktrees](https://git-scm.com/docs/git-worktree)
- [GitHub CLI (`gh`)](https://cli.github.com/manual/)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v2.0 | 2026-01-06 | Complete rewrite based on design session. GitHub Issues as task source, worktree isolation, two-layer task system. |
| v1.0 | (original) | Initial design spec in DESIGN.md |
