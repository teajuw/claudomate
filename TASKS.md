# Claudomate MVP Implementation Tasks

> **Reference**: See `docs/DESIGN_V2.md` for full specifications
> **Goal**: Build MVP capable of running agents on GitHub Issues with worktree isolation

---

## Phase 0: Project Setup

### 0.1 GitHub Repository Setup
- [ ] Initialize git repo for claudomate
- [ ] Create GitHub repository (github.com/[username]/claudomate)
- [ ] Push existing code to GitHub
- [ ] Set up GitHub App OR Personal Access Token
- [ ] Configure webhook endpoint (ngrok for local dev, or deploy server)
- [ ] Test webhook delivery with ping event

### 0.2 Environment Configuration
- [ ] Create `.env.example` with required variables
- [ ] Add `.env` to `.gitignore`
- [ ] Document required env vars:
  - `GITHUB_TOKEN` or GitHub App credentials
  - `GITHUB_WEBHOOK_SECRET`
  - `TARGET_REPO` (default target repository)
  - `WORKTREE_BASE_PATH`

---

## Phase 1: GitHub Integration

### 1.1 GitHub API Client (`server/github.js`)
- [ ] Create GitHub API wrapper using `@octokit/rest` or `gh` CLI
- [ ] Implement authentication (PAT or GitHub App)
- [ ] Add methods:
  - [ ] `listIssues(repo)` — fetch open issues
  - [ ] `getIssue(repo, number)` — fetch single issue
  - [ ] `addLabel(repo, issue, label)` — add label to issue
  - [ ] `removeLabel(repo, issue, label)` — remove label
  - [ ] `createComment(repo, issue, body)` — add comment
  - [ ] `listPullRequests(repo)` — fetch open PRs
  - [ ] `getPullRequest(repo, number)` — fetch single PR

### 1.2 Webhook Handler (`server/webhooks.js`)
- [ ] Add `POST /api/webhooks/github` endpoint
- [ ] Verify webhook signature (security)
- [ ] Handle events:
  - [ ] `issues.opened` — add task to state, broadcast to UI
  - [ ] `issues.closed` — mark task complete, broadcast
  - [ ] `issues.labeled` — check for agent assignment labels
  - [ ] `issues.unlabeled` — handle unassignment
  - [ ] `pull_request.opened` — link PR to task, update state
  - [ ] `pull_request.closed` — if merged, mark complete
- [ ] Broadcast webhook events via WebSocket

### 1.3 Initial Sync
- [ ] On server start, fetch all open issues for configured repo
- [ ] Populate initial task state
- [ ] Send to UI on WebSocket connect

---

## Phase 2: Worktree Management

### 2.1 Worktree Manager (`server/worktree.js`)
- [ ] Implement `createWorktree(repoPath, agentId, issueNumber)`
  - [ ] Generate branch name: `agent/{agentId}/issue-{number}`
  - [ ] Run: `git worktree add <path> -b <branch>`
  - [ ] Return worktree path
- [ ] Implement `deleteWorktree(worktreePath)`
  - [ ] Run: `git worktree remove <path>`
  - [ ] Clean up branch if desired
- [ ] Implement `listWorktrees(repoPath)`
  - [ ] Run: `git worktree list --porcelain`
  - [ ] Parse output
- [ ] Implement `getWorktreeForAgent(agentId)`
  - [ ] Look up existing worktree by agent

### 2.2 Worktree Lifecycle Integration
- [ ] When agent assigned to issue → auto-create worktree
- [ ] When agent starts → verify worktree exists
- [ ] When task completes → optionally clean up worktree
- [ ] Store worktree path in agent state

### 2.3 API Endpoints
- [ ] `GET /api/worktrees` — list all worktrees
- [ ] `POST /api/worktrees` — create worktree for agent
- [ ] `DELETE /api/worktrees/:id` — delete worktree

---

## Phase 3: Agent Execution Updates

### 3.1 Enhanced Agent Spawning (`server/agent.js`)
- [ ] Refactor `startAgent` to:
  - [ ] Accept issue context (number, title, body)
  - [ ] Build system prompt from template + role
  - [ ] Include issue details in task prompt
  - [ ] Set working directory to agent's worktree
- [ ] Create prompt builder:
  - [ ] Load role template from `prompts/{role}.md`
  - [ ] Inject variables: `{{AGENT_ID}}`, `{{ISSUE_NUMBER}}`, etc.
  - [ ] Include Explore→Plan→Code→Commit instructions

### 3.2 System Prompt Templates (`prompts/`)
- [ ] Create `prompts/base.md` — shared instructions
- [ ] Create `prompts/coder.md` — coder-specific prompt
- [ ] Create `prompts/reviewer.md` — reviewer-specific prompt
- [ ] Create `prompts/researcher.md` — researcher-specific prompt
- [ ] Create `prompts/architect.md` — architect-specific prompt

### 3.3 Agent Output Handling
- [ ] Parse agent stdout for key events:
  - [ ] Commit messages
  - [ ] PR creation
  - [ ] Task completion signals
- [ ] Update agent state based on output
- [ ] Broadcast meaningful events to UI

---

## Phase 4: Scratchpad & File Watching

### 4.1 Markdown Parser (`server/parser.js`)
- [ ] Implement `parseTasksMarkdown(content)`
  - [ ] Extract tasks with checkbox state
  - [ ] Parse: `- [ ] task` and `- [x] task`
  - [ ] Return array: `[{ text, completed, line }]`
- [ ] Implement `updateTaskInMarkdown(content, index, completed)`
  - [ ] Toggle checkbox state
  - [ ] Return updated content

### 4.2 File Watcher (`server/watcher.js`)
- [ ] Install `chokidar` dependency
- [ ] Implement `watchAgentScratchpads(worktreeBasePath)`
  - [ ] Watch pattern: `*/TASKS.md`
  - [ ] On change: parse file, broadcast update
- [ ] Debounce rapid changes (agent may write multiple times)
- [ ] Map file path back to agent ID

### 4.3 Scratchpad Sync
- [ ] When TASKS.md changes → parse → update UI
- [ ] Calculate progress: `{completed}/{total}`
- [ ] Broadcast: `{ type: 'scratchpad_update', agentId, tasks, progress }`

---

## Phase 5: Task Management

### 5.1 Project Configuration
- [ ] Add project/repo configuration to server state
- [ ] Store: repo URL, local path, worktree base path
- [ ] API: `POST /api/projects` — add project
- [ ] API: `GET /api/projects` — list projects
- [ ] API: `DELETE /api/projects/:id` — remove project

### 5.2 Task Assignment
- [ ] API: `POST /api/tasks/:issueNumber/assign` — assign to agent
  - [ ] Add label `agent:{agentId}` to GitHub issue
  - [ ] Create worktree for agent
  - [ ] Update local state
- [ ] API: `POST /api/tasks/:issueNumber/unassign` — unassign
  - [ ] Remove agent label
  - [ ] Optionally delete worktree

### 5.3 Task State Management
- [ ] Track task states: backlog, assigned, in_progress, in_review, done
- [ ] Update state based on:
  - [ ] Label changes (from webhook)
  - [ ] Agent start/stop
  - [ ] PR opened/merged
  - [ ] Issue closed

---

## Phase 6: Frontend Updates

### 6.1 Task Display
- [ ] Show GitHub issue as task source (link to GitHub)
- [ ] Display issue number, title
- [ ] Show labels as tags
- [ ] Show assignment status

### 6.2 Subtask Progress
- [ ] Display subtasks from agent's TASKS.md
- [ ] Show checkboxes (read-only, reflects file state)
- [ ] Show progress bar or count: `[4/6 complete]`
- [ ] Update in real-time via WebSocket

### 6.3 Agent-Task Linking
- [ ] Show which issue agent is working on
- [ ] Show agent's branch name
- [ ] Link to PR if one exists
- [ ] Show worktree path (for debugging)

### 6.4 Task Assignment UI
- [ ] Add "Assign to agent" dropdown/button on task card
- [ ] Or: drag-and-drop task to agent column
- [ ] Show confirmation before assigning

---

## Phase 7: Integration Testing

### 7.1 End-to-End Flow Test
- [ ] Create test GitHub issue manually
- [ ] Assign to agent via claudomate UI
- [ ] Verify worktree created
- [ ] Start agent
- [ ] Verify agent creates TASKS.md
- [ ] Verify subtask progress updates in UI
- [ ] Verify agent creates PR
- [ ] Verify PR linked to issue
- [ ] Merge PR
- [ ] Verify issue auto-closes
- [ ] Verify task marked complete in UI

### 7.2 Error Handling
- [ ] Test: agent fails mid-task
- [ ] Test: GitHub API rate limit
- [ ] Test: webhook delivery failure
- [ ] Test: worktree creation failure
- [ ] Test: invalid issue number

---

## Phase 8: Documentation & Cleanup

### 8.1 README
- [ ] Write setup instructions
- [ ] Document environment variables
- [ ] Add screenshots of UI
- [ ] Explain GitHub App setup
- [ ] Quick start guide

### 8.2 Code Cleanup
- [ ] Remove deprecated code
- [ ] Add JSDoc comments to key functions
- [ ] Consistent error handling
- [ ] Logging improvements

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0",
    "@octokit/webhooks": "^12.0.0",
    "chokidar": "^3.5.3"
  }
}
```

---

## Files to Create

```
server/
├── github.js      # GitHub API client
├── webhooks.js    # Webhook handler
├── worktree.js    # Worktree management
├── watcher.js     # File watching
├── parser.js      # Markdown parsing
└── agent.js       # (update existing)

prompts/
├── base.md        # Shared prompt template
├── coder.md       # Coder role
├── reviewer.md    # Reviewer role
├── researcher.md  # Researcher role
└── architect.md   # Architect role
```

---

## Estimated GitHub Issues (for after repo setup)

Once repo is on GitHub, convert these to issues:

1. **Setup**: GitHub App configuration and webhook endpoint
2. **GitHub API**: Implement GitHub client with Octokit
3. **Webhooks**: Handle issue and PR webhook events
4. **Worktrees**: Auto-create worktrees for agent assignment
5. **Prompts**: Create role-based system prompt templates
6. **Parser**: Markdown checkbox parser for TASKS.md
7. **Watcher**: File watcher for agent scratchpads
8. **Task Sync**: Two-way sync between GitHub Issues and UI
9. **UI Tasks**: Display GitHub issues and subtask progress
10. **E2E Test**: Full workflow test with real GitHub repo

---

## Success Criteria for MVP

MVP is complete when:

1. [ ] Can add a GitHub repo as a project
2. [ ] Issues from repo appear in claudomate UI
3. [ ] Can assign issue to an agent (creates worktree)
4. [ ] Agent starts with issue context in prompt
5. [ ] Agent's TASKS.md progress shows in UI
6. [ ] Agent can create PR via `gh` CLI
7. [ ] PR appears in UI, linked to issue
8. [ ] Merging PR closes issue and updates UI
