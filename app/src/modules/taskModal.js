/**
 * Task Creation Modal — Start a new coding agent task cleanly.
 */

import { workspace } from './workspace.js';
import { adapterMgr } from './adapters.js';

export class TaskModal {
  constructor(options = {}) {
    this.onLaunchTask = options.onLaunchTask || null;
    this.defaultAgent = options.defaultAgent || 'claude';
    this.modalEl = null;
  }

  async open(initialAgent = null) {
    if (this.modalEl) this.close();
    await adapterMgr.load();

    const selectedAgentInitial = initialAgent || this.defaultAgent || 'claude';

    const el = document.createElement('div');
    el.className = 'task-modal-overlay';
    el.innerHTML = `
      <div class="task-modal-card">
        <div class="task-modal-head">
          <div class="modal-title">Create New Agent Task</div>
          <button class="modal-close-btn" id="modal-close-x">✕</button>
        </div>
        <div class="task-modal-body">
          <div class="form-group">
            <label>Project Workspace</label>
            <select id="task-proj-select" class="form-select">
              ${workspace.projects.map(p => `
                <option value="${p.id}" ${p.id === workspace.activeProject?.id ? 'selected' : ''}>
                  ${p.name} (${p.path})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Select Coding Agent</label>
            <div class="agent-selector-grid">
              ${adapterMgr.adapters.map(a => {
                const meta = adapterMgr.getMeta(a.id);
                const isSelected = a.id === selectedAgentInitial;
                return `
                  <div class="agent-opt-card ${a.installed ? 'installed' : 'not-installed'} ${isSelected ? 'selected' : ''}" data-agent-id="${a.id}">
                    <div class="agent-opt-icon" style="color: ${meta.color}">${meta.icon}</div>
                    <div class="agent-opt-name">${a.name}</div>
                    <div class="agent-opt-status">${a.installed ? 'Detected' : 'Not on PATH'}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>Task Description / Instructions</label>
            <textarea id="task-prompt-input" class="form-textarea" rows="4" placeholder="e.g. Refactor authentication middleware and verify all tests pass..."></textarea>
          </div>
        </div>
        <div class="task-modal-foot">
          <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="modal-launch-btn">Launch Agent Task</button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.modalEl = el;

    let selectedAgent = selectedAgentInitial;

    el.querySelectorAll('.agent-opt-card').forEach(card => {
      card.addEventListener('click', () => {
        el.querySelectorAll('.agent-opt-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedAgent = card.dataset.agentId;
      });
    });

    setTimeout(() => {
      el.querySelector('#task-prompt-input')?.focus();
    }, 60);

    const close = () => this.close();
    el.querySelector('#modal-close-x').addEventListener('click', close);
    el.querySelector('#modal-cancel-btn').addEventListener('click', close);

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    el.querySelector('#modal-launch-btn').addEventListener('click', () => {
      const projId = el.querySelector('#task-proj-select').value;
      const prompt = el.querySelector('#task-prompt-input').value.trim();
      const proj = workspace.projects.find(p => p.id === projId) || workspace.activeProject;

      if (!prompt) {
        alert('Please describe what you want the agent to do.');
        return;
      }

      this.close();
      if (this.onLaunchTask) {
        this.onLaunchTask({
          project: proj,
          agent: selectedAgent,
          prompt,
        });
      }
    });

    el.querySelector('#task-prompt-input').focus();
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }
}
