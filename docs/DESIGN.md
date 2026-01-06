# claudomate Design Specification

> "automate" + "mate" (partnership) = **claudomate**

A mission control interface for managing Claude Code agent fleets.

---

## Design Philosophy

**Modern-retro hybrid**: Clean, minimal layout with subtle pixel/monospace accents.
Think: A sleek control room that nods to early computing without being kitschy.

### Visual Principles
1. **White space is sacred** - Let elements breathe
2. **Orange as accent, not assault** - Subtle warmth, not traffic cone
3. **Monospace for data, sans-serif for UI** - Clear hierarchy
4. **Borders define, not decorate** - Functional grid lines
5. **Pixel touches, not pixel art** - Retro whispers, not shouts

---

## Color Palette

```css
/* Base */
--bg-primary: #FAFAFA;        /* Off-white, easier on eyes than pure white */
--bg-secondary: #F5F5F5;      /* Subtle card backgrounds */
--bg-tertiary: #EEEEEE;       /* Borders, dividers */

/* Text */
--text-primary: #1A1A1A;      /* Near-black for headings */
--text-secondary: #666666;    /* Body text */
--text-muted: #999999;        /* Labels, hints */

/* Accent - Orange spectrum */
--accent-primary: #FF6B35;    /* Primary action, active states */
--accent-light: #FF8F66;      /* Hover states */
--accent-subtle: #FFF0EB;     /* Backgrounds for highlighted items */
--accent-dark: #E55A2B;       /* Pressed states */

/* Status */
--status-active: #22C55E;     /* Running, success */
--status-paused: #F59E0B;     /* Paused, warning */
--status-stopped: #6B7280;    /* Stopped, idle */
--status-error: #EF4444;      /* Error states */

/* Semantic */
--border: #E5E5E5;
--border-strong: #CCCCCC;
```

---

## Typography

```css
/* Headings - Monospace with character */
--font-heading: 'JetBrains Mono', 'SF Mono', monospace;

/* Body - Clean, modern */
--font-body: 'Inter', -apple-system, sans-serif;

/* Code/Data - Technical feel */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Sizes */
--text-xs: 0.75rem;   /* 12px - labels */
--text-sm: 0.875rem;  /* 14px - body small */
--text-base: 1rem;    /* 16px - body */
--text-lg: 1.125rem;  /* 18px - emphasis */
--text-xl: 1.25rem;   /* 20px - section headers */
--text-2xl: 1.5rem;   /* 24px - page headers */
```

---

## Layout

### Overall Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  claude-omate                          [fleet: calendar] [⚙️] [👤]  │  ← Header
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │   CODER     │  │  REVIEWER   │  │ RESEARCHER  │  │    [+]    │  │
│  │   ○ idle    │  │   ○ idle    │  │  ● active   │  │  add role │  │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤  └───────────┘  │
│  │  prompt...  │  │  prompt...  │  │  prompt...  │                 │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤                 │
│  │ [▶][⏸][⏹]  │  │ [▶][⏸][⏹]  │  │ [▶][⏸][⏹]  │                 │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤                 │
│  │ ☐ Task 1    │  │ ☐ Task A    │  │ ☑ Research  │                 │
│  │ ☐ Task 2    │  │             │  │ ☐ Document  │                 │
│  │ ☑ Task 3    │  │             │  │             │                 │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤                 │
│  │ 12.4k tok   │  │ idle        │  │ 3.2k tok    │                 │
│  │ 3 commits   │  │ 0 commits   │  │ research.md │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  // activity_log                                        [minimize] │  ← Collapsible
│  10:42 [coder] committed: "Add auth flow"                          │
│  10:41 [researcher] updated research.md                            │
│  10:38 [coder] started task: "Add auth flow"                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Stack (Column)

```
┌─────────────────────────────────┐
│  🔧 CODER                       │  ← Role name + icon
│  ● active · 12m                 │  ← Status + duration
├─────────────────────────────────┤
│  // system_prompt               │  ← Collapsible prompt
│  You are a senior developer...  │
│  [edit]                         │
├─────────────────────────────────┤
│  [▶ start] [⏸ pause] [⏹ stop]  │  ← Controls
│  [💬 chat] [📋 log]             │
├─────────────────────────────────┤
│  // tasks                       │
│  ┌───────────────────────────┐  │
│  │ ☐ Add authentication      │  │  ← Task card
│  │    → blocks: Review PR    │  │  ← Dependency (english)
│  │    repo: calendar         │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ☑ Fix navbar styling      │  │  ← Completed
│  │    ✓ merged PR #12        │  │
│  └───────────────────────────┘  │
│  [+ add task]                   │
├─────────────────────────────────┤
│  // output                      │
│  done: PR, commit, direct       │  ← Definition of Done setting
│  tokens: 12.4k (session)        │
│  commits: 3                     │
│  branch: feature/auth           │
└─────────────────────────────────┘
```

### Task Card Detail

```
┌─────────────────────────────────────────┐
│ ☐ Add user authentication               │
├─────────────────────────────────────────┤
│ Implement OAuth flow with Google.       │
│ - Add login button                      │
│ - Handle callback                       │
│ - Store session                         │
├─────────────────────────────────────────┤
│ source: github#42                       │  ← Imported from issue
│ blocks: "Review auth PR" (reviewer)     │  ← English dependency
│ repo: trevorjudge/calendar              │
├─────────────────────────────────────────┤
│ [edit] [delete] [→ move to...]          │
└─────────────────────────────────────────┘
```

---

## Agent Configuration

### Definition of Done (per agent)

```
done_mode:
  - "pr"        # Creates PR, waits for merge
  - "commit"    # Commits directly to branch
  - "draft_pr"  # Creates draft PR
  - "artifact"  # Just produces files (research, docs)
  - "none"      # Manual completion
```

### Role Presets

```yaml
coder:
  icon: 🔧
  done_mode: pr
  prompt: |
    You are a senior developer. Write clean, tested code.
    Follow existing patterns in the codebase.
    Create atomic commits with clear messages.

reviewer:
  icon: 🔍
  done_mode: none  # Completes when review submitted
  prompt: |
    You review pull requests for quality and correctness.
    Check for: bugs, security issues, style consistency.
    Be constructive. Approve or request changes.

researcher:
  icon: 📚
  done_mode: artifact  # Produces markdown files
  prompt: |
    You research topics and document findings.
    Output: structured markdown with sources.
    Focus on actionable insights.

architect:
  icon: 🏗️
  done_mode: artifact
  prompt: |
    You design systems and create technical specs.
    Consider: scalability, maintainability, trade-offs.
    Output: design docs, diagrams (mermaid), ADRs.
```

---

## Interactions

### Chat Panel (slide-in from right)

When you click 💬 on an agent:

```
┌────────────────────────────────────────┐
│  💬 Chat with CODER          [close]   │
├────────────────────────────────────────┤
│                                        │
│  You: How's the auth flow going?       │
│                                        │
│  Coder: I've implemented the OAuth     │
│  callback handler. Currently working   │
│  on session storage. Should be done    │
│  in ~10 minutes.                       │
│                                        │
│  You: Use Redis for sessions instead   │
│  of localStorage.                      │
│                                        │
│  Coder: Got it, switching to Redis.    │
│  I'll need to add the redis package.   │
│                                        │
├────────────────────────────────────────┤
│  [Type message...]           [Send]    │
└────────────────────────────────────────┘
```

### Log Panel (slide-in or bottom drawer)

```
┌────────────────────────────────────────────────────────────┐
│  📋 CODER Log                    [clear] [export] [close]  │
├────────────────────────────────────────────────────────────┤
│  10:45:23  Reading src/auth/callback.ts                    │
│  10:45:24  Edit: Added OAuth callback handler              │
│  10:45:30  Running: npm test                               │
│  10:45:45  ✓ Tests passed (12/12)                          │
│  10:45:47  Commit: "feat: Add OAuth callback handler"      │
│  10:45:50  Reading src/auth/session.ts                     │
│  10:45:52  Planning session storage implementation...      │
│  █                                                         │  ← Live cursor
└────────────────────────────────────────────────────────────┘
```

---

## Retro Touches (Subtle)

1. **Code-style labels**: `// tasks`, `// output`, `export { agent }`
2. **Monospace headings**: Role names in JetBrains Mono
3. **Pixel-perfect borders**: 1px solid lines, no shadows
4. **Status dots**: Simple ● ○ instead of fancy badges
5. **Bracket notation**: `[start]` `[pause]` instead of rounded buttons
6. **Loading states**: Simple `...` or `█` cursor, not spinners

---

## Responsive Behavior

### Desktop (>1024px)
- All agent stacks visible side-by-side
- Activity log at bottom

### Tablet (768-1024px)
- 2 stacks per row
- Horizontal scroll for more
- Activity log collapsible

### Mobile (<768px)
- Single stack view
- Swipe between agents
- Bottom navigation: [Coder] [Reviewer] [Research] [+]
- Activity log as modal

---

## Fleet Mode (Future)

When managing 5+ agents, switch to condensed view:

```
┌──────────────────────────────────────────────────────────────┐
│  Fleet: calendar-app                           [grid] [list] │
├──────────────────────────────────────────────────────────────┤
│  Agent        Status    Tasks    Tokens    Last Activity     │
│  ─────────────────────────────────────────────────────────── │
│  coder-1      ● active  3/5      12.4k     Editing auth.ts   │
│  coder-2      ○ idle    0/2      8.2k      Waiting           │
│  reviewer     ● active  1/1      2.1k      Reviewing PR #12  │
│  researcher   ☑ done    2/2      5.0k      Completed         │
│  architect    ⏸ paused  1/3      15.0k     Paused by user    │
├──────────────────────────────────────────────────────────────┤
│  [+ spawn agent]   Total: 42.7k tokens · $0.12 estimated     │
└──────────────────────────────────────────────────────────────┘
```

---

## Open Questions

1. **Task handoff**: When coder finishes, how does task appear in reviewer queue?
   - Auto-create based on done_mode?
   - Manual drag?
   - Coordinator agent decides?

2. **GitHub sync**:
   - Pull tasks from issues on demand?
   - Two-way sync (UI changes → GitHub)?
   - GitHub as source of truth vs. UI as source?

3. **Agent memory**:
   - Per-session only?
   - Persistent scratchpad files?
   - Shared context between agents?

4. **Branching strategy**:
   - One branch per agent?
   - One branch per task?
   - Trunk-based with feature flags?

---

## Tech Stack Recommendation

```
Frontend:
  - React or Svelte (your preference)
  - Tailwind CSS (matches design system well)
  - No heavy UI library - custom components

Backend:
  - Extend existing spawn-api (Node.js)
  - WebSocket for real-time logs
  - SQLite for local state (or extend claude-watch's D1)

Communication:
  - spawn-api ↔ Docker containers
  - WebSocket for live updates
  - GitHub API for issue sync
```
