/**
 * Agent Adapter Client Registry — Vendor-neutral metadata, icons, and capability helpers.
 */

import { invoke } from '@tauri-apps/api/core';

export const ADAPTER_METADATA = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    icon: '✦',
    color: '#d99f5b',
    glowColor: 'rgba(217, 159, 91, 0.4)',
    badgeClass: 'adapter-claude',
    shortName: 'Claude',
    desc: 'Anthropic agent with bash & file editing capabilities',
  },
  codex: {
    id: 'codex',
    name: 'OpenAI Codex',
    icon: '⚙',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    badgeClass: 'adapter-codex',
    shortName: 'Codex',
    desc: 'OpenAI autonomous programming engine',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini CLI',
    icon: '⚡',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    badgeClass: 'adapter-gemini',
    shortName: 'Gemini',
    desc: 'Google DeepMind multimodal coding CLI',
  },
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot',
    icon: '🤖',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    badgeClass: 'adapter-copilot',
    shortName: 'Copilot',
    desc: 'GitHub Copilot CLI orchestrator',
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    icon: '◇',
    color: '#14b8a6',
    glowColor: 'rgba(20, 184, 166, 0.4)',
    badgeClass: 'adapter-opencode',
    shortName: 'OpenCode',
    desc: 'Open-weight modular code assistant',
  },
  aider: {
    id: 'aider',
    name: 'Aider',
    icon: '⚔',
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.4)',
    badgeClass: 'adapter-aider',
    shortName: 'Aider',
    desc: 'Pair programming terminal agent',
  },
  powershell: {
    id: 'powershell',
    name: 'PowerShell',
    icon: '›_',
    color: '#8ec5a4',
    glowColor: 'rgba(142, 197, 164, 0.4)',
    badgeClass: 'adapter-shell',
    shortName: 'Terminal',
    desc: 'Native Windows PowerShell ConPTY',
  },
  pwsh: {
    id: 'pwsh',
    name: 'PowerShell Core',
    icon: '›_',
    color: '#8ec5a4',
    glowColor: 'rgba(142, 197, 164, 0.4)',
    badgeClass: 'adapter-shell',
    shortName: 'PWSH',
    desc: 'Cross-platform PowerShell ConPTY',
  },
};

/**
 * Renders a crisp, geometric SVG emblem for each agent character.
 * Supports dynamic state: 'idle' | 'working' | 'waiting' | 'needs_attention' | 'completed' | 'error'
 */
export function getAgentEmblemSvg(agentType, state = 'idle', size = 24) {
  const key = (agentType || '').toLowerCase();
  const meta = ADAPTER_METADATA[key] || {
    color: '#8c909c',
    glowColor: 'rgba(140, 144, 156, 0.3)',
    name: 'Agent'
  };

  const stateClass = `emblem-state-${state}`;
  const c = meta.color;

  let innerSvg = '';
  switch (key) {
    case 'claude':
      // Warm solar diamond facet with inner pulse iris
      innerSvg = `
        <polygon points="12,2 22,12 12,22 2,12" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="3.2" fill="${c}" class="emblem-core"/>
        <line x1="12" y1="5" x2="12" y2="7.5" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="12" y1="16.5" x2="12" y2="19" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="5" y1="12" x2="7.5" y2="12" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="16.5" y1="12" x2="19" y2="12" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
      break;

    case 'codex':
      // Emerald precision orbital matrix cog
      innerSvg = `
        <circle cx="12" cy="12" r="8.5" fill="${c}" fill-opacity="0.15" stroke="${c}" stroke-width="1.6" stroke-dasharray="3 2" class="emblem-orbit"/>
        <circle cx="12" cy="12" r="4.2" fill="${c}" fill-opacity="0.4" stroke="${c}" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="1.8" fill="#ffffff" class="emblem-core"/>
        <rect x="11" y="2" width="2" height="3" rx="0.5" fill="${c}"/>
        <rect x="11" y="19" width="2" height="3" rx="0.5" fill="${c}"/>
        <rect x="2" y="11" width="3" height="2" rx="0.5" fill="${c}"/>
        <rect x="19" y="11" width="3" height="2" rx="0.5" fill="${c}"/>
      `;
      break;

    case 'gemini':
      // Multi-faceted electric cyan spark prism
      innerSvg = `
        <path d="M12 2 C12 7.5 16.5 12 22 12 C16.5 12 12 16.5 12 22 C12 16.5 7.5 12 2 12 C7.5 12 12 7.5 12 2 Z" 
              fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="1.6" stroke-linejoin="round" class="emblem-prism"/>
        <circle cx="12" cy="12" r="2.5" fill="${c}" class="emblem-core"/>
      `;
      break;

    case 'copilot':
      // Aerodynamic visor emblem
      innerSvg = `
        <rect x="3" y="6" width="18" height="12" rx="4" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="1.6"/>
        <line x1="6.5" y1="12" x2="17.5" y2="12" stroke="${c}" stroke-width="2.2" stroke-linecap="round" class="emblem-visor"/>
        <circle cx="8" cy="12" r="1.2" fill="#ffffff"/>
        <circle cx="16" cy="12" r="1.2" fill="#ffffff"/>
      `;
      break;

    case 'opencode':
      // Isometric wire-frame block / rhombic cube
      innerSvg = `
        <polygon points="12,3 20,7.5 12,12 4,7.5" fill="${c}" fill-opacity="0.3" stroke="${c}" stroke-width="1.4"/>
        <polygon points="4,7.5 12,12 12,21 4,16.5" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="1.4"/>
        <polygon points="20,7.5 12,12 12,21 20,16.5" fill="${c}" fill-opacity="0.1" stroke="${c}" stroke-width="1.4"/>
      `;
      break;

    case 'powershell':
    case 'pwsh':
      // Precision CLI prompt glyph ›_
      innerSvg = `
        <rect x="2.5" y="3" width="19" height="18" rx="3.5" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="1.5"/>
        <path d="M7 8 L11 12 L7 16" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="13" y1="16" x2="17" y2="16" stroke="${c}" stroke-width="2" stroke-linecap="round" class="emblem-cursor"/>
      `;
      break;

    default:
      // Minimal geometric tech avatar
      innerSvg = `
        <rect x="4" y="4" width="16" height="16" rx="4" fill="${c}" fill-opacity="0.2" stroke="${c}" stroke-width="1.5"/>
        <circle cx="9" cy="10" r="1.5" fill="${c}"/>
        <circle cx="15" cy="10" r="1.5" fill="${c}"/>
        <line x1="8" y1="15" x2="16" y2="15" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
      break;
  }

  return `
    <svg class="agent-emblem ${stateClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="${meta.name || agentType}">
      ${innerSvg}
    </svg>
  `.trim();
}

export class AdapterManager {
  constructor() {
    this.adapters = [];
  }

  async load() {
    try {
      this.adapters = await invoke('list_agent_adapters');
    } catch {
      this.adapters = [];
    }
    return this.adapters;
  }

  getMeta(agentType) {
    const key = (agentType || '').toLowerCase();
    return ADAPTER_METADATA[key] || {
      id: key,
      name: agentType || 'Agent',
      shortName: agentType || 'Agent',
      icon: '🤖',
      color: 'var(--adv)',
      glowColor: 'rgba(56, 189, 248, 0.3)',
      badgeClass: 'adapter-generic',
      desc: 'Generic autonomous agent',
    };
  }

  renderEmblem(agentType, state = 'idle', size = 24) {
    return getAgentEmblemSvg(agentType, state, size);
  }
}

export const adapterMgr = new AdapterManager();

