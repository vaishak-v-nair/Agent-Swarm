//! Vendor-neutral Agent Adapter Architecture for AgentSwarm.
//!
//! Exposes discoverable capabilities for Claude Code, OpenAI Codex, Gemini CLI,
//! GitHub Copilot CLI, OpenCode, Aider, and generic shells.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AdapterCapabilities {
    pub structured_transcript: bool,
    pub supports_steer: bool,
    pub supports_task_prompt: bool,
    pub supports_permissions: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AdapterInfo {
    pub id: String,
    pub name: String,
    pub binary: String,
    pub installed: bool,
    pub capabilities: AdapterCapabilities,
}

pub fn which(bin: &str) -> bool {
    let Ok(paths) = std::env::var("PATH") else { return false };
    let exts = ["", ".exe", ".cmd", ".bat", ".ps1"];

    for p in std::env::split_paths(&paths) {
        for ext in &exts {
            let candidate = p.join(format!("{bin}{ext}"));
            if candidate.is_file() {
                return true;
            }
        }
    }
    false
}

pub struct AdapterRegistry;

impl AdapterRegistry {
    /// Detect all known coding agents and their installed status on the host.
    pub fn detect_all() -> Vec<AdapterInfo> {
        vec![
            AdapterInfo {
                id: "claude".to_string(),
                name: "Claude Code".to_string(),
                binary: "claude".to_string(),
                installed: which("claude"),
                capabilities: AdapterCapabilities {
                    structured_transcript: true,
                    supports_steer: true,
                    supports_task_prompt: true,
                    supports_permissions: true,
                },
            },
            AdapterInfo {
                id: "codex".to_string(),
                name: "OpenAI Codex".to_string(),
                binary: "codex".to_string(),
                installed: which("codex"),
                capabilities: AdapterCapabilities {
                    structured_transcript: true,
                    supports_steer: true,
                    supports_task_prompt: true,
                    supports_permissions: true,
                },
            },
            AdapterInfo {
                id: "gemini".to_string(),
                name: "Gemini CLI".to_string(),
                binary: "gemini".to_string(),
                installed: which("gemini"),
                capabilities: AdapterCapabilities {
                    structured_transcript: false,
                    supports_steer: false,
                    supports_task_prompt: true,
                    supports_permissions: false,
                },
            },
            AdapterInfo {
                id: "copilot".to_string(),
                name: "GitHub Copilot CLI".to_string(),
                binary: "copilot".to_string(),
                installed: which("copilot") || which("github-copilot-cli"),
                capabilities: AdapterCapabilities {
                    structured_transcript: false,
                    supports_steer: false,
                    supports_task_prompt: true,
                    supports_permissions: false,
                },
            },
            AdapterInfo {
                id: "opencode".to_string(),
                name: "OpenCode".to_string(),
                binary: "opencode".to_string(),
                installed: which("opencode"),
                capabilities: AdapterCapabilities {
                    structured_transcript: true,
                    supports_steer: false,
                    supports_task_prompt: true,
                    supports_permissions: false,
                },
            },
            AdapterInfo {
                id: "aider".to_string(),
                name: "Aider".to_string(),
                binary: "aider".to_string(),
                installed: which("aider"),
                capabilities: AdapterCapabilities {
                    structured_transcript: false,
                    supports_steer: false,
                    supports_task_prompt: true,
                    supports_permissions: false,
                },
            },
            AdapterInfo {
                id: "powershell".to_string(),
                name: "PowerShell (Human)".to_string(),
                binary: "powershell.exe".to_string(),
                installed: true,
                capabilities: AdapterCapabilities {
                    structured_transcript: false,
                    supports_steer: false,
                    supports_task_prompt: false,
                    supports_permissions: false,
                },
            },
            AdapterInfo {
                id: "pwsh".to_string(),
                name: "PowerShell Core".to_string(),
                binary: "pwsh.exe".to_string(),
                installed: which("pwsh"),
                capabilities: AdapterCapabilities {
                    structured_transcript: false,
                    supports_steer: false,
                    supports_task_prompt: false,
                    supports_permissions: false,
                },
            },
        ]
    }

    /// Resolve launch command and arguments for starting an agent task.
    pub fn format_launch_command(agent_type: &str, task_prompt: &str) -> (String, Vec<String>) {
        match agent_type {
            "claude" => {
                if task_prompt.trim().is_empty() {
                    ("claude".to_string(), vec![])
                } else {
                    ("claude".to_string(), vec!["-p".to_string(), task_prompt.to_string()])
                }
            }
            "codex" => {
                if task_prompt.trim().is_empty() {
                    ("codex".to_string(), vec![])
                } else {
                    ("codex".to_string(), vec!["exec".to_string(), task_prompt.to_string()])
                }
            }
            "gemini" => {
                if task_prompt.trim().is_empty() {
                    ("gemini".to_string(), vec![])
                } else {
                    ("gemini".to_string(), vec![task_prompt.to_string()])
                }
            }
            "copilot" => {
                let bin = if which("copilot") { "copilot" } else { "github-copilot-cli" };
                (bin.to_string(), vec![])
            }
            "opencode" => ("opencode".to_string(), vec![]),
            "aider" => {
                if task_prompt.trim().is_empty() {
                    ("aider".to_string(), vec![])
                } else {
                    ("aider".to_string(), vec!["--message".to_string(), task_prompt.to_string()])
                }
            }
            "pwsh" => ("pwsh.exe".to_string(), vec![]),
            _ => ("powershell.exe".to_string(), vec![]),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_all_includes_core_agents() {
        let all = AdapterRegistry::detect_all();
        let ids: Vec<_> = all.iter().map(|a| a.id.as_str()).collect();
        assert!(ids.contains(&"claude"));
        assert!(ids.contains(&"codex"));
        assert!(ids.contains(&"gemini"));
        assert!(ids.contains(&"copilot"));
        assert!(ids.contains(&"powershell"));
    }

    #[test]
    fn test_format_launch_command() {
        let (cmd, args) = AdapterRegistry::format_launch_command("claude", "fix tests");
        assert_eq!(cmd, "claude");
        assert_eq!(args, vec!["-p", "fix tests"]);

        let (cmd2, args2) = AdapterRegistry::format_launch_command("codex", "refactor auth");
        assert_eq!(cmd2, "codex");
        assert_eq!(args2, vec!["exec", "refactor auth"]);
    }
}
