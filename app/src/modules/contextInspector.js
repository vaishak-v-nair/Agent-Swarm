/**
 * Context Inspector — Contextual right panel showing changes, files, verification, and agent metadata.
 *
 * Collapses to 0px on Home by default to let the workspace breathe, and smoothly expands
 * when an agent, task, or file diff is actively selected.
 */

import { workspace } from './workspace.js';
import { adapterMgr, getAgentEmblemSvg } from './adapters.js';

let inspectorManuallyClosed = false;
let lastInspectedSessionId = null;

export function renderContextInspector(container, options = {}) {
  const session = workspace.getActiveSession();
  const changes = options.changes || { files: [] };
  const isHome = workspace.activeNav === 'home';

  // If active session changed, automatically reset manual dismissal
  if (session && session.id !== lastInspectedSessionId) {
    inspectorManuallyClosed = false;
    lastInspectedSessionId = session.id;
  } else if (!session && lastInspectedSessionId) {
    lastInspectedSessionId = null;
  }

  // Collapse if on Home with no active session selected or user manually dismissed it
  const shouldCollapse = (isHome && !session) || inspectorManuallyClosed;

  if (shouldCollapse) {
    container.className = 'context-inspector collapsed';
    container.innerHTML = '';
    return;
  }

  container.className = 'context-inspector open';

  if (!session) {
    // General context if opened without a specific session
    const p = workspace.activeProject;
    container.innerHTML = `
      <div class="inspector-panel">
        <div class="inspector-head">
          <div class="inspector-title">Workspace Context</div>
          <button class="inspector-close-btn" id="inspector-close-btn" title="Collapse Inspector (Esc)">✕</button>
        </div>
        <div class="inspector-section">
          <div class="sec-label">Workspace</div>
          <div class="sec-val">${p ? p.name : 'No project open'}</div>
          <div class="sec-sub">${p ? p.path : ''}</div>
        </div>
        <div class="inspector-section">
          <div class="sec-label">Git Branch</div>
          <div class="sec-val">⌥ ${p?.current_branch || 'main'}</div>
        </div>
        <div class="inspector-section">
          <div class="sec-label">Active Agents</div>
          <div class="sec-val">${workspace.sessions.length}</div>
        </div>
      </div>
    `;
    container.querySelector('#inspector-close-btn')?.addEventListener('click', () => {
      inspectorManuallyClosed = true;
      container.className = 'context-inspector collapsed';
      container.innerHTML = '';
    });
    return;
  }

  // Active Session Inspection
  const meta = adapterMgr.getMeta(session.agent_type);
  const emblem = getAgentEmblemSvg(session.agent_type, session.status, 22);

  container.innerHTML = `
    <div class="inspector-panel">
      <div class="inspector-head">
        <div class="inspector-title-row">
          <span class="inspector-icon">⌕</span>
          <span class="inspector-title">Task Inspector</span>
        </div>
        <button class="inspector-close-btn" id="inspector-close-btn" title="Collapse Inspector (Esc)">✕</button>
      </div>

      <!-- Agent Metadata -->
      <div class="inspector-section agent-spec-section">
        <div class="sec-label">ORCHESTRATED AGENT</div>
        <div class="agent-spec-row">
          <span class="agent-emblem-wrap">${emblem}</span>
          <div class="agent-spec-info">
            <div class="agent-name" style="color: ${meta.color}">${meta.name}</div>
            <div class="agent-sub-badge">ConPTY Pane #${session.pane_id}</div>
          </div>
        </div>
        <div class="sec-cwd" title="${session.cwd || ''}">${session.cwd || ''}</div>
      </div>

      <!-- Attention Alert & Quick HITL Action -->
      ${session.status === 'needs_attention' || session.attention_score >= 25 ? `
        <div class="inspector-alert-card">
          <div class="alert-head">
            <span class="alert-dot"></span>
            <span class="alert-title">Attention Escalation</span>
            <span class="alert-score">Score: ${session.attention_score}</span>
          </div>
          <div class="alert-body">
            ${session.status_reason || 'Agent is awaiting human input or permission.'}
          </div>
          <div class="hitl-actions-row">
            <button class="hitl-btn approve" id="inspector-approve-btn">Approve (y)</button>
            <button class="hitl-btn reject" id="inspector-reject-btn">Reject (n)</button>
          </div>
        </div>
      ` : ''}

      <!-- Verification Evidence -->
      <div class="inspector-section">
        <div class="sec-label">VERIFICATION STATUS</div>
        <div class="verif-status-badge ${session.verification_status}">
          ${session.verification_status === 'passed' ? '✓ Verified (Tests Passed)' :
            session.verification_status === 'failed' ? '✕ Failed Verification' :
            '○ Untested (No recent test run)'}
        </div>
      </div>

      <!-- Modified Files -->
      <div class="inspector-section">
        <div class="sec-label">
          <span>MODIFIED FILES (${changes.files.length})</span>
        </div>
        <div class="inspector-file-list">
          ${changes.files.length === 0 ? `
            <div class="no-files-sub">Working tree is clean.</div>
          ` : changes.files.map(f => `
            <div class="inspector-file-row" data-path="${f.path}">
              <span class="file-status">${f.status}</span>
              <span class="file-path" title="${f.path}">${f.path}</span>
              <span class="file-counts">
                ${f.added ? `<span class="add">+${f.added}</span>` : ''}
                ${f.removed ? `<span class="del">-${f.removed}</span>` : ''}
              </span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Provenance / Reason -->
      <div class="inspector-section">
        <div class="sec-label">PROVENANCE & LOG TRACE</div>
        <div class="provenance-text">${session.status_reason || 'Agent is actively executing task commands.'}</div>
      </div>
    </div>
  `;

  // Close button
  container.querySelector('#inspector-close-btn')?.addEventListener('click', () => {
    inspectorManuallyClosed = true;
    container.className = 'context-inspector collapsed';
    container.innerHTML = '';
  });

  // HITL Action buttons
  container.querySelector('#inspector-approve-btn')?.addEventListener('click', () => {
    if (session.pane_id && options.onSteerPane) {
      options.onSteerPane(session.pane_id, 'y\r');
    }
  });
  container.querySelector('#inspector-reject-btn')?.addEventListener('click', () => {
    if (session.pane_id && options.onSteerPane) {
      options.onSteerPane(session.pane_id, 'n\r');
    }
  });

  // Attach file click handlers
  container.querySelectorAll('.inspector-file-row').forEach(row => {
    row.addEventListener('click', () => {
      const path = row.dataset.path;
      if (options.onOpenFileDiff) options.onOpenFileDiff(path);
    });
  });
}

export function resetInspectorCollapse() {
  inspectorManuallyClosed = false;
}

