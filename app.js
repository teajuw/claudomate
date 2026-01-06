/**
 * claudomate - Agent Fleet Mission Control
 */

// ============================================
// Config
// ============================================
const API_URL = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002';

// ============================================
// State
// ============================================
const state = {
    agents: [],
    selectedPreset: null,
    editingTaskAgentId: null,
    editingTaskIndex: null,
    activityLog: [],
    serverConnected: false,
};

let ws = null;

// Role presets from design spec
const PRESETS = {
    coder: {
        icon: '\u{1F527}', // wrench
        name: 'coder',
        doneMode: 'pr',
        prompt: `You are a senior developer. Write clean, tested code.
Follow existing patterns in the codebase.
Create atomic commits with clear messages.`,
    },
    reviewer: {
        icon: '\u{1F50D}', // magnifying glass
        name: 'reviewer',
        doneMode: 'none',
        prompt: `You review pull requests for quality and correctness.
Check for: bugs, security issues, style consistency.
Be constructive. Approve or request changes.`,
    },
    researcher: {
        icon: '\u{1F4DA}', // books
        name: 'researcher',
        doneMode: 'artifact',
        prompt: `You research topics and document findings.
Output: structured markdown with sources.
Focus on actionable insights.`,
    },
    architect: {
        icon: '\u{1F3D7}', // building construction
        name: 'architect',
        doneMode: 'artifact',
        prompt: `You design systems and create technical specs.
Consider: scalability, maintainability, trade-offs.
Output: design docs, diagrams (mermaid), ADRs.`,
    },
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    renderAgents();
    setupEventListeners();
    connectWebSocket();
    logActivity('system', 'ready');
});

function setupEventListeners() {
    // Add agent button
    document.getElementById('add-agent-btn').addEventListener('click', openAddAgentModal);

    // Activity log toggle
    document.getElementById('activity-toggle').addEventListener('click', toggleActivityLog);

    // Chat input enter key
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChat();
    });

    // Task input enter key
    document.getElementById('task-title-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveTask();
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
            }
        });
    });
}

// ============================================
// WebSocket Connection
// ============================================
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        state.serverConnected = true;
        logActivity('system', 'connected to server');
        updateConnectionStatus();
    };

    ws.onclose = () => {
        state.serverConnected = false;
        logActivity('system', 'disconnected from server');
        updateConnectionStatus();
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
        state.serverConnected = false;
        updateConnectionStatus();
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
    };
}

function handleServerMessage(msg) {
    switch (msg.type) {
        case 'init':
            // Sync server agents with local state
            msg.agents.forEach(serverAgent => {
                const localAgent = state.agents.find(a => a.serverId === serverAgent.id);
                if (localAgent) {
                    localAgent.status = mapServerStatus(serverAgent.status);
                    localAgent.serverLogs = serverAgent.logs || [];
                }
            });
            renderAgents();
            break;

        case 'agent_created':
            // Server confirmed agent creation
            break;

        case 'status':
            updateAgentStatus(msg.agentId, msg.status);
            break;

        case 'log':
            appendAgentLog(msg.agentId, msg.entry);
            break;

        case 'agent_deleted':
            // Could sync delete from server
            break;
    }
}

function updateAgentStatus(serverId, serverStatus) {
    const agent = state.agents.find(a => a.serverId === serverId);
    if (agent) {
        agent.status = mapServerStatus(serverStatus);
        renderAgents();
        logActivity(agent.name, serverStatus);
    }
}

function appendAgentLog(serverId, entry) {
    const agent = state.agents.find(a => a.serverId === serverId);
    if (agent) {
        if (!agent.serverLogs) agent.serverLogs = [];
        agent.serverLogs.push(entry);

        // Update activity log for important events
        if (entry.source === 'system' || entry.text.includes('commit')) {
            logActivity(agent.name, entry.text.slice(0, 100));
        }
    }
}

function mapServerStatus(status) {
    const map = {
        'idle': 'idle',
        'running': 'active',
        'completed': 'completed',
        'error': 'error',
        'stopped': 'idle',
    };
    return map[status] || status;
}

function updateConnectionStatus() {
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.style.opacity = state.serverConnected ? '1' : '0.5';
    }
}

// ============================================
// State Persistence
// ============================================
function loadState() {
    const saved = localStorage.getItem('claudomate_state');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.agents = parsed.agents || [];
        state.activityLog = parsed.activityLog || [];
    }
}

function saveState() {
    localStorage.setItem('claudomate_state', JSON.stringify({
        agents: state.agents,
        activityLog: state.activityLog.slice(-100), // Keep last 100 entries
    }));
}

// ============================================
// API Helpers
// ============================================
async function apiCall(method, path, body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(`${API_URL}${path}`, options);
        return await res.json();
    } catch (err) {
        console.error('API error:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// Agent Rendering
// ============================================
function renderAgents() {
    const grid = document.getElementById('agent-grid');
    grid.innerHTML = state.agents.map((agent, idx) => renderAgentStack(agent, idx)).join('');
}

function renderAgentStack(agent, idx) {
    const statusClass = agent.status || 'idle';
    const statusLabel = agent.status === 'active' ? `active \u00b7 ${agent.duration || '0m'}` : agent.status || 'idle';

    return `
        <div class="agent-stack" data-agent-id="${agent.id}">
            <div class="agent-header">
                <div class="agent-role">
                    <span class="agent-icon">${agent.icon}</span>
                    <span class="agent-name">${agent.name}</span>
                </div>
                <div class="agent-status">
                    <span class="status-dot ${statusClass}"></span>
                    <span>${statusLabel}</span>
                </div>
            </div>

            <div class="agent-section">
                <div class="section-label">// system_prompt</div>
                <div class="prompt-preview">${escapeHtml(agent.prompt.slice(0, 150))}...</div>
                <div class="prompt-edit" onclick="editPrompt(${idx})">[edit]</div>
            </div>

            <div class="agent-controls">
                <button class="control-btn primary" onclick="startAgent(${idx})" ${agent.status === 'active' ? 'disabled' : ''}>
                    [\u25B6 start]
                </button>
                <button class="control-btn" onclick="pauseAgent(${idx})" ${agent.status !== 'active' ? 'disabled' : ''}>
                    [\u23F8 pause]
                </button>
                <button class="control-btn" onclick="stopAgent(${idx})">
                    [\u23F9 stop]
                </button>
                <button class="control-btn" onclick="openChat(${idx})">
                    [\u{1F4AC} chat]
                </button>
                <button class="control-btn" onclick="openLog(${idx})">
                    [\u{1F4CB} log]
                </button>
            </div>

            <div class="agent-tasks agent-section">
                <div class="section-label">// tasks</div>
                ${renderTasks(agent.tasks || [], idx)}
                <div class="add-task-btn" onclick="openTaskModal(${idx})">[+ add task]</div>
            </div>

            <div class="agent-output">
                <div class="output-row">
                    <span class="output-label">done:</span>
                    <span class="output-value">${agent.doneMode}</span>
                </div>
                <div class="output-row">
                    <span class="output-label">tokens:</span>
                    <span class="output-value">${formatTokens(agent.tokens || 0)} (session)</span>
                </div>
                <div class="output-row">
                    <span class="output-label">commits:</span>
                    <span class="output-value">${agent.commits || 0}</span>
                </div>
                ${agent.branch ? `
                <div class="output-row">
                    <span class="output-label">branch:</span>
                    <span class="output-value">${agent.branch}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderTasks(tasks, agentIdx) {
    if (!tasks.length) {
        return '<div class="empty-state">No tasks yet</div>';
    }

    return tasks.map((task, taskIdx) => `
        <div class="task-card ${task.completed ? 'completed' : ''}" onclick="openTaskDetail(${agentIdx}, ${taskIdx})">
            <div class="task-header">
                <span class="task-checkbox" onclick="event.stopPropagation(); toggleTask(${agentIdx}, ${taskIdx})">
                    ${task.completed ? '\u2611' : '\u2610'}
                </span>
                <span class="task-title">${escapeHtml(task.title)}</span>
            </div>
            ${task.blocks ? `<div class="task-meta">\u2192 blocks: ${escapeHtml(task.blocks)}</div>` : ''}
            ${task.repo ? `<div class="task-meta">repo: ${escapeHtml(task.repo)}</div>` : ''}
        </div>
    `).join('');
}

// ============================================
// Agent Actions (now with server calls)
// ============================================
async function startAgent(idx) {
    const agent = state.agents[idx];

    // Get the first incomplete task
    const task = (agent.tasks || []).find(t => !t.completed);
    if (!task) {
        alert('Add a task before starting the agent');
        return;
    }

    // Create on server if not exists
    if (!agent.serverId) {
        const result = await apiCall('POST', '/api/agents', {
            name: agent.name,
            prompt: agent.prompt,
            workdir: agent.workdir || process.cwd?.() || '.',
            task: task.title + (task.description ? '\n\n' + task.description : ''),
        });

        if (result.success) {
            agent.serverId = result.id;
        } else {
            logActivity('system', `Failed to create agent: ${result.error}`);
            return;
        }
    }

    // Start on server
    const result = await apiCall('POST', `/api/agents/${agent.serverId}/start`, {
        task: task.title + (task.description ? '\n\n' + task.description : ''),
    });

    if (result.success) {
        agent.status = 'active';
        agent.startTime = Date.now();
        renderAgents();
        saveState();
        logActivity(agent.name, `started task: "${task.title}"`);
    } else {
        logActivity('system', `Failed to start: ${result.error}`);
    }
}

function pauseAgent(idx) {
    const agent = state.agents[idx];
    // Note: Claude doesn't support pause, so this is just UI state
    agent.status = 'paused';
    renderAgents();
    saveState();
    logActivity(agent.name, 'paused');
}

async function stopAgent(idx) {
    const agent = state.agents[idx];

    if (agent.serverId) {
        await apiCall('POST', `/api/agents/${agent.serverId}/stop`);
    }

    agent.status = 'idle';
    agent.startTime = null;
    renderAgents();
    saveState();
    logActivity(agent.name, 'stopped');
}

function editPrompt(idx) {
    const agent = state.agents[idx];
    const newPrompt = prompt('Edit system prompt:', agent.prompt);
    if (newPrompt !== null) {
        agent.prompt = newPrompt;
        renderAgents();
        saveState();
    }
}

// ============================================
// Task Management
// ============================================
function toggleTask(agentIdx, taskIdx) {
    const task = state.agents[agentIdx].tasks[taskIdx];
    task.completed = !task.completed;
    renderAgents();
    saveState();

    const agent = state.agents[agentIdx];
    logActivity(agent.name, `${task.completed ? 'completed' : 'reopened'} task: "${task.title}"`);
}

function openTaskModal(agentIdx, taskIdx = null) {
    state.editingTaskAgentId = agentIdx;
    state.editingTaskIndex = taskIdx;

    const modal = document.getElementById('task-modal');
    const title = document.getElementById('task-modal-title');
    const titleInput = document.getElementById('task-title-input');
    const descInput = document.getElementById('task-desc-input');
    const repoInput = document.getElementById('task-repo-input');
    const blocksInput = document.getElementById('task-blocks-input');

    if (taskIdx !== null) {
        const task = state.agents[agentIdx].tasks[taskIdx];
        title.textContent = '// edit_task';
        titleInput.value = task.title || '';
        descInput.value = task.description || '';
        repoInput.value = task.repo || '';
        blocksInput.value = task.blocks || '';
    } else {
        title.textContent = '// add_task';
        titleInput.value = '';
        descInput.value = '';
        repoInput.value = '';
        blocksInput.value = '';
    }

    modal.classList.add('open');
    titleInput.focus();
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.remove('open');
    state.editingTaskAgentId = null;
    state.editingTaskIndex = null;
}

function saveTask() {
    const titleInput = document.getElementById('task-title-input');
    const descInput = document.getElementById('task-desc-input');
    const repoInput = document.getElementById('task-repo-input');
    const blocksInput = document.getElementById('task-blocks-input');

    const title = titleInput.value.trim();
    if (!title) {
        alert('Task title is required');
        return;
    }

    const task = {
        title,
        description: descInput.value.trim(),
        repo: repoInput.value.trim(),
        blocks: blocksInput.value.trim(),
        completed: false,
    };

    const agent = state.agents[state.editingTaskAgentId];

    if (state.editingTaskIndex !== null) {
        // Edit existing
        task.completed = agent.tasks[state.editingTaskIndex].completed;
        agent.tasks[state.editingTaskIndex] = task;
    } else {
        // Add new
        if (!agent.tasks) agent.tasks = [];
        agent.tasks.push(task);
        logActivity(agent.name, `added task: "${title}"`);
    }

    renderAgents();
    saveState();
    closeTaskModal();
}

function openTaskDetail(agentIdx, taskIdx) {
    openTaskModal(agentIdx, taskIdx);
}

// ============================================
// Add Agent Modal
// ============================================
function openAddAgentModal() {
    state.selectedPreset = null;
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('agent-name-input').value = '';
    document.getElementById('done-mode-select').value = 'pr';
    document.getElementById('add-agent-modal').classList.add('open');
}

function closeAddAgentModal() {
    document.getElementById('add-agent-modal').classList.remove('open');
}

function selectPreset(presetName) {
    state.selectedPreset = presetName;
    const preset = PRESETS[presetName];

    // Update UI
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.preset === presetName);
    });

    // Auto-fill name and done mode
    const existingCount = state.agents.filter(a => a.name.startsWith(presetName)).length;
    const suggestedName = existingCount > 0 ? `${presetName}-${existingCount + 1}` : presetName;

    document.getElementById('agent-name-input').value = suggestedName;
    document.getElementById('done-mode-select').value = preset.doneMode;
}

function createAgent() {
    if (!state.selectedPreset) {
        alert('Please select a role preset');
        return;
    }

    const preset = PRESETS[state.selectedPreset];
    const name = document.getElementById('agent-name-input').value.trim() || preset.name;
    const doneMode = document.getElementById('done-mode-select').value;

    const agent = {
        id: `agent_${Date.now()}`,
        name,
        icon: preset.icon,
        prompt: preset.prompt,
        doneMode,
        status: 'idle',
        tasks: [],
        tokens: 0,
        commits: 0,
        serverId: null, // Will be set when first started
        serverLogs: [],
    };

    state.agents.push(agent);
    renderAgents();
    saveState();
    closeAddAgentModal();
    logActivity('system', `created agent: ${name}`);
}

// ============================================
// Chat Panel
// ============================================
let currentChatAgent = null;

function openChat(agentIdx) {
    currentChatAgent = agentIdx;
    const agent = state.agents[agentIdx];

    document.getElementById('chat-title').textContent = `\u{1F4AC} Chat with ${agent.name.toUpperCase()}`;
    document.getElementById('chat-messages').innerHTML = `
        <div class="empty-state">Start a conversation with ${agent.name}</div>
    `;
    document.getElementById('chat-panel').classList.add('open');
    document.getElementById('chat-input').focus();
}

function closeChat() {
    document.getElementById('chat-panel').classList.remove('open');
    currentChatAgent = null;
}

async function sendChat() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message || currentChatAgent === null) return;

    const agent = state.agents[currentChatAgent];
    const messagesEl = document.getElementById('chat-messages');

    // Clear empty state if present
    const emptyState = messagesEl.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    // Add user message
    messagesEl.innerHTML += `
        <div class="chat-message">
            <div class="chat-message-sender">You:</div>
            <div class="chat-message-content">${escapeHtml(message)}</div>
        </div>
    `;

    input.value = '';
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Send to server if agent is running
    if (agent.serverId && agent.status === 'active') {
        const result = await apiCall('POST', `/api/agents/${agent.serverId}/message`, { message });
        if (!result.success) {
            messagesEl.innerHTML += `
                <div class="chat-message">
                    <div class="chat-message-sender">system:</div>
                    <div class="chat-message-content" style="color: var(--status-error)">Failed to send: ${result.error}</div>
                </div>
            `;
        }
    } else {
        messagesEl.innerHTML += `
            <div class="chat-message">
                <div class="chat-message-sender">system:</div>
                <div class="chat-message-content" style="color: var(--text-muted)">Agent not running. Start the agent first.</div>
            </div>
        `;
    }
}

function openLog(agentIdx) {
    const agent = state.agents[agentIdx];
    const logs = agent.serverLogs || [];

    if (logs.length === 0) {
        alert(`Log for ${agent.name}:\n\nNo activity recorded yet.`);
        return;
    }

    // Format logs for display
    const logText = logs.map(l =>
        `[${new Date(l.time).toLocaleTimeString()}] ${l.source}: ${l.text}`
    ).join('\n');

    alert(`Log for ${agent.name}:\n\n${logText.slice(-2000)}`);
}

// ============================================
// Activity Log
// ============================================
function logActivity(agent, message) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    state.activityLog.push({ time, agent, message });
    saveState();

    const content = document.getElementById('activity-content');
    const entry = document.createElement('div');
    entry.className = 'activity-entry';
    entry.innerHTML = `
        <span class="activity-time">${time}</span>
        <span class="activity-agent">[${agent}]</span>
        <span class="activity-message">${escapeHtml(message)}</span>
    `;

    content.appendChild(entry);
    content.scrollTop = content.scrollHeight;
}

function toggleActivityLog() {
    const log = document.getElementById('activity-log');
    const btn = document.getElementById('activity-toggle');

    log.classList.toggle('minimized');
    btn.textContent = log.classList.contains('minimized') ? '[expand]' : '[minimize]';
}

// ============================================
// Utilities
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTokens(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
}

// ============================================
// Expose to global scope for onclick handlers
// ============================================
window.openAddAgentModal = openAddAgentModal;
window.closeAddAgentModal = closeAddAgentModal;
window.selectPreset = selectPreset;
window.createAgent = createAgent;
window.startAgent = startAgent;
window.pauseAgent = pauseAgent;
window.stopAgent = stopAgent;
window.editPrompt = editPrompt;
window.openChat = openChat;
window.closeChat = closeChat;
window.sendChat = sendChat;
window.openLog = openLog;
window.toggleTask = toggleTask;
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.saveTask = saveTask;
window.openTaskDetail = openTaskDetail;
