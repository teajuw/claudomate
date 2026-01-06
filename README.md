# claudomate

Mission control for Claude Code agent fleets.

claudomate is a web-based dashboard for managing multiple Claude Code agents. It provides a visual interface to spawn, monitor, and coordinate AI coding agents working on different tasks in parallel.

## Features

- **Agent Management**: Create and manage multiple Claude Code agents with different roles (coder, reviewer, researcher, architect)
- **Task Tracking**: Assign tasks to agents and track their progress
- **Real-time Logs**: Monitor agent activity through WebSocket-powered live logs
- **Chat Interface**: Communicate with running agents to provide guidance or ask questions
- **Activity Feed**: See a unified timeline of all agent actions

## Prerequisites

- Node.js 18+
- [Claude Code CLI](https://github.com/anthropics/claude-code) installed and configured
- GitHub CLI (`gh`) for PR workflows (optional)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/teajuw/claudomate.git
   cd claudomate
   ```

2. Install server dependencies:
   ```bash
   cd server
   npm install
   cd ..
   ```

3. Configure environment (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. Start the backend server:
   ```bash
   cd server
   npm run dev
   ```

5. In a separate terminal, start the frontend:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3001 in your browser.

## Usage

### Adding an Agent

1. Click the **[+ add role]** button
2. Select a role preset (coder, reviewer, researcher, or architect)
3. Customize the agent name and completion mode
4. Click **[create]**

### Assigning Tasks

1. Click **[+ add task]** on an agent's card
2. Enter a task title and description
3. Optionally specify a repository and blocking dependencies
4. Click **[save]**

### Running an Agent

1. Ensure the agent has at least one task assigned
2. Click **[start]** to begin execution
3. Monitor progress in the activity log or click **[log]** for detailed output
4. Use **[chat]** to send messages to the running agent

### Agent Roles

| Role | Icon | Purpose |
|------|------|---------|
| coder | wrench | Write and commit code |
| reviewer | magnifying glass | Review pull requests |
| researcher | books | Research topics and document findings |
| architect | construction | Design systems and create specs |

## Project Structure

```
claudomate/
├── index.html      # Dashboard UI
├── app.js          # Frontend logic
├── style.css       # Styling
├── server/
│   ├── index.js    # Express + WebSocket server
│   └── package.json
├── docs/
│   └── DESIGN.md   # Design specification
└── .env.example    # Environment template
```

## License

MIT
