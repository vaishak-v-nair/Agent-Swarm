/**
 * Project Switcher Modal — Seamlessly switch or add projects without blocking prompts.
 */

import { workspace } from './workspace.js';

export class ProjectModal {
  constructor(options = {}) {
    this.onSelectProject = options.onSelectProject || null;
    this.onAddProject = options.onAddProject || null;
    this.modalEl = null;
  }

  open() {
    if (this.modalEl) this.close();

    const el = document.createElement('div');
    el.className = 'task-modal-overlay project-modal-overlay';
    el.innerHTML = `
      <div class="task-modal-card project-modal-card">
        <div class="task-modal-head">
          <div class="modal-title">Switch Project Workspace</div>
          <button class="modal-close-btn" id="proj-modal-close-x">✕</button>
        </div>
        <div class="task-modal-body">
          <div class="form-group">
            <label>Recent Projects</label>
            <div class="project-list-grid" style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto;">
              ${workspace.projects.map(p => `
                <div class="project-item-card ${p.id === workspace.activeProject?.id ? 'active' : ''}" 
                     data-project-id="${p.id}"
                     style="padding:10px 14px; background:var(--bg-2); border:1px solid ${p.id === workspace.activeProject?.id ? 'var(--signal-accent)' : 'var(--border-subtle)'}; border-radius:6px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-weight:600; font-size:13px; color:var(--tx-0);">${p.name} ${p.id === workspace.activeProject?.id ? '<span style="font-size:11px; opacity:0.7;">(Current)</span>' : ''}</div>
                    <div style="font-size:11px; color:var(--tx-2); font-family:var(--font-mono);">${p.path}</div>
                  </div>
                  ${p.current_branch ? `<span style="font-size:11px; padding:2px 6px; background:var(--bg-3); border-radius:4px; color:var(--tx-1);">⌥ ${p.current_branch}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="form-group" style="margin-top:16px;">
            <label>Open New Project Directory</label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="custom-proj-path-input" class="form-input" style="flex:1; padding:8px 12px; background:var(--bg-2); border:1px solid var(--border-subtle); border-radius:6px; color:var(--tx-0); font-family:var(--font-mono); font-size:12px;" placeholder="e.g. C:/Projects/my-app or /home/dev/repo" />
              <button class="btn btn-primary" id="custom-proj-open-btn">Open</button>
            </div>
          </div>
        </div>
        <div class="task-modal-foot">
          <button class="btn btn-secondary" id="proj-modal-cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.modalEl = el;

    const close = () => this.close();
    el.querySelector('#proj-modal-close-x')?.addEventListener('click', close);
    el.querySelector('#proj-modal-cancel-btn')?.addEventListener('click', close);

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    // Project card click
    el.querySelectorAll('.project-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.projectId;
        this.close();
        if (this.onSelectProject) this.onSelectProject(id);
      });
    });

    // Custom path click
    const submitCustom = () => {
      const path = el.querySelector('#custom-proj-path-input')?.value.trim();
      if (!path) return;
      this.close();
      if (this.onAddProject) this.onAddProject(path);
    };

    el.querySelector('#custom-proj-open-btn')?.addEventListener('click', submitCustom);
    el.querySelector('#custom-proj-path-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCustom();
    });
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }
}
