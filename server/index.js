/**
 * claudomate Server
 *
 * Backend API for spawning and managing Claude Code agents
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================================
// State
// ============================================
const agents = new Map(); // agentId -> { process, config, logs, status }
const wsClients = new Set();

// ============================================
// WebSocket Handling
// ============================================
wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log('WebSocket client connected');

  // Send current agent states
  ws.send(JSON.stringify({
    type: 'init',
    agents: Array.from(agents.entries()).map(([id, agent]) => ({
      id,
      config: agent.config,
      status: agent.status,
      logs: agent.logs.slice(-50), // Last 50 log lines
    })),
  }));

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

function broadcast(message) {
  const data = JSON.stringify(message);
  wsClients.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });
}

// ============================================
// API Routes
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', agents: agents.size });
});

// List all agents
app.get('/api/agents', (req, res) => {
  const list = Array.from(agents.entries()).map(([id, agent]) => ({
    id,
    config: agent.config,
    status: agent.status,
    logCount: agent.logs.length,
  }));
  res.json({ success: true, agents: list });
});

// Get single agent
app.get('/api/agents/:id', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }
  res.json({
    success: true,
    agent: {
      id: req.params.id,
      config: agent.config,
      status: agent.status,
      logs: agent.logs,
    },
  });
});

// Create/spawn a new agent
app.post('/api/agents', (req, res) => {
  const { name, prompt, workdir, task } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'name is required' });
  }

  const id = uuidv4();
  const config = {
    name,
    prompt: prompt || '',
    workdir: workdir || process.cwd(),
    task: task || '',
    createdAt: new Date().toISOString(),
  };

  agents.set(id, {
    config,
    process: null,
    status: 'idle',
    logs: [],
    startTime: null,
  });

  broadcast({ type: 'agent_created', id, config });
  res.json({ success: true, id, config });
});

// Start an agent
app.post('/api/agents/:id/start', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }

  if (agent.status === 'running') {
    return res.status(400).json({ success: false, error: 'Agent already running' });
  }

  const { task } = req.body;
  const taskToRun = task || agent.config.task;

  if (!taskToRun) {
    return res.status(400).json({ success: false, error: 'No task specified' });
  }

  // Build claude command
  const args = ['--print'];

  if (agent.config.prompt) {
    args.push('--system-prompt', agent.config.prompt);
  }

  args.push(taskToRun);

  console.log(`Starting agent ${agent.config.name}: claude ${args.join(' ')}`);

  // Spawn claude process
  const proc = spawn('claude', args, {
    cwd: agent.config.workdir,
    env: { ...process.env },
    shell: true,
  });

  agent.process = proc;
  agent.status = 'running';
  agent.startTime = Date.now();
  agent.config.task = taskToRun;

  const addLog = (source, text) => {
    const entry = {
      time: new Date().toISOString(),
      source,
      text: text.toString().trim(),
    };
    agent.logs.push(entry);
    broadcast({ type: 'log', agentId: req.params.id, entry });
  };

  proc.stdout.on('data', (data) => {
    addLog('stdout', data);
  });

  proc.stderr.on('data', (data) => {
    addLog('stderr', data);
  });

  proc.on('close', (code) => {
    agent.status = code === 0 ? 'completed' : 'error';
    agent.process = null;
    addLog('system', `Process exited with code ${code}`);
    broadcast({ type: 'status', agentId: req.params.id, status: agent.status });
  });

  proc.on('error', (err) => {
    agent.status = 'error';
    addLog('system', `Error: ${err.message}`);
    broadcast({ type: 'status', agentId: req.params.id, status: agent.status });
  });

  broadcast({ type: 'status', agentId: req.params.id, status: 'running' });
  res.json({ success: true, status: 'running' });
});

// Stop an agent
app.post('/api/agents/:id/stop', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }

  if (agent.process) {
    agent.process.kill('SIGTERM');
    agent.status = 'stopped';
    agent.logs.push({
      time: new Date().toISOString(),
      source: 'system',
      text: 'Agent stopped by user',
    });
    broadcast({ type: 'status', agentId: req.params.id, status: 'stopped' });
  }

  res.json({ success: true, status: agent.status });
});

// Delete an agent
app.delete('/api/agents/:id', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }

  if (agent.process) {
    agent.process.kill('SIGTERM');
  }

  agents.delete(req.params.id);
  broadcast({ type: 'agent_deleted', agentId: req.params.id });
  res.json({ success: true });
});

// Send message to agent (chat)
app.post('/api/agents/:id/message', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }

  if (!agent.process || agent.status !== 'running') {
    return res.status(400).json({ success: false, error: 'Agent not running' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  // Write to stdin
  agent.process.stdin.write(message + '\n');
  agent.logs.push({
    time: new Date().toISOString(),
    source: 'user',
    text: message,
  });

  res.json({ success: true });
});

// ============================================
// Start Server
// ============================================
server.listen(PORT, () => {
  console.log(`claudomate server running on http://localhost:${PORT}`);
  console.log(`WebSocket available on ws://localhost:${PORT}`);
});
