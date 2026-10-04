//! First-class Project management for AgentSwarm.
//!
//! A Project in AgentSwarm is a first-class workspace entity containing a repository,
//! working directory, git metadata, active agent sessions, and verification settings.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub git_root: Option<String>,
    pub current_branch: Option<String>,
    pub default_test_command: Option<String>,
    pub last_opened_at: u64,
}

impl Project {
    /// Inspect a directory path on disk and construct a Project instance.
    pub fn from_path(path: impl AsRef<Path>) -> Self {
        let abs_path = std::fs::canonicalize(path.as_ref())
            .unwrap_or_else(|_| path.as_ref().to_path_buf());
        let raw_str = abs_path.to_string_lossy();
        let path_str = raw_str.strip_prefix(r"\\?\").unwrap_or(&raw_str).to_string();

        let name = abs_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("workspace")
            .to_string();

        let id = slugify(&name);

        let (git_root, current_branch) = inspect_git(&path_str);

        // Auto-detect default test command
        let default_test_command = detect_test_command(&abs_path);

        let last_opened_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        Self {
            id,
            name,
            path: path_str,
            git_root,
            current_branch,
            default_test_command,
            last_opened_at,
        }
    }
}

fn slugify(text: &str) -> String {
    let s: String = text
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect();
    let trimmed = s.trim_matches('-');
    if trimmed.is_empty() {
        "project".to_string()
    } else {
        trimmed.to_string()
    }
}

fn inspect_git(cwd: &str) -> (Option<String>, Option<String>) {
    let root = Command::new("git")
        .current_dir(cwd)
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        });

    let branch = Command::new("git")
        .current_dir(cwd)
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if s.is_empty() || s == "HEAD" { None } else { Some(s) }
            } else {
                None
            }
        });

    (root, branch)
}

fn detect_test_command(dir: &Path) -> Option<String> {
    if dir.join("Cargo.toml").is_file() {
        Some("cargo test".to_string())
    } else if dir.join("package.json").is_file() {
        Some("npm test".to_string())
    } else if dir.join("pytest.ini").is_file() || dir.join("pyproject.toml").is_file() {
        Some("pytest".to_string())
    } else if dir.join("go.mod").is_file() {
        Some("go test ./...".to_string())
    } else {
        None
    }
}

/// Project registry file manager.
pub struct ProjectRegistry;

impl ProjectRegistry {
    fn registry_path() -> PathBuf {
        if let Ok(base) = std::env::var("LOCALAPPDATA") {
            let dir = PathBuf::from(base).join("agentswarm");
            let _ = std::fs::create_dir_all(&dir);
            dir.join("projects.json")
        } else if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            let dir = PathBuf::from(home).join(".agentswarm");
            let _ = std::fs::create_dir_all(&dir);
            dir.join("projects.json")
        } else {
            PathBuf::from(".agentswarm_projects.json")
        }
    }

    /// List all registered projects, guaranteeing the current directory's project is present.
    pub fn list(current_dir: &str) -> Vec<Project> {
        let mut projects = Self::load();
        let current_proj = Project::from_path(current_dir);

        let exists = projects.iter().any(|p| {
            p.path.eq_ignore_ascii_case(&current_proj.path) || p.id == current_proj.id
        });

        if !exists {
            projects.insert(0, current_proj);
            let _ = Self::save(&projects);
        } else if let Some(p) = projects.iter_mut().find(|p| p.path.eq_ignore_ascii_case(&current_proj.path)) {
            p.current_branch = current_proj.current_branch;
            p.git_root = current_proj.git_root;
        }

        projects
    }

    /// Load registered projects from disk.
    pub fn load() -> Vec<Project> {
        let path = Self::registry_path();
        if let Ok(data) = std::fs::read_to_string(&path) {
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    /// Save registered projects to disk.
    pub fn save(projects: &[Project]) -> Result<(), String> {
        let path = Self::registry_path();
        let json = serde_json::to_string_pretty(projects).map_err(|e| e.to_string())?;
        std::fs::write(&path, json).map_err(|e| e.to_string())
    }

    /// Add or update a project by directory path.
    pub fn add(path: &str) -> Project {
        let proj = Project::from_path(path);
        let mut projects = Self::load();
        projects.retain(|p| !p.path.eq_ignore_ascii_case(&proj.path));
        projects.insert(0, proj.clone());
        let _ = Self::save(&projects);
        proj
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("AgentSwarm"), "agentswarm");
        assert_eq!(slugify("My Cool Project!"), "my-cool-project");
        assert_eq!(slugify("---"), "project");
    }

    #[test]
    fn test_project_from_path() {
        let p = Project::from_path(".");
        assert!(!p.id.is_empty());
        assert!(!p.name.is_empty());
        assert!(!p.path.is_empty());
    }

    #[test]
    fn test_project_serialization_round_trip() {
        let p = Project {
            id: "test-proj".to_string(),
            name: "Test Project".to_string(),
            path: "/dummy/path".to_string(),
            git_root: Some("/dummy".to_string()),
            current_branch: Some("main".to_string()),
            default_test_command: Some("npm test".to_string()),
            last_opened_at: 12345678,
        };

        let json = serde_json::to_string(&p).expect("serialize");
        let decoded: Project = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(p, decoded);
    }
}
