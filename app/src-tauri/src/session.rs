//! Unified Agent Session Model for AgentSwarm.
//!
//! Provides a provider-neutral representation of a coding task executed by an agent,
//! linking the ConPTY process, attention state, SQLite event history, and verification.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Starting,
    Working,
    NeedsAttention,
    Completed,
    Failed,
    Paused,
}

impl std::fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            SessionStatus::Starting => "starting",
            SessionStatus::Working => "working",
            SessionStatus::NeedsAttention => "needs_attention",
            SessionStatus::Completed => "completed",
            SessionStatus::Failed => "failed",
            SessionStatus::Paused => "paused",
        };
        write!(f, "{s}")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VerificationStatus {
    Untested,
    Running,
    Passed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentSession {
    pub id: String,
    pub project_id: String,
    pub task_title: String,
    pub agent_type: String,
    pub status: SessionStatus,
    pub status_reason: String,
    pub attention_score: u32,
    pub pane_id: u32,
    pub cwd: String,
    pub branch: Option<String>,
    pub verification_status: VerificationStatus,
    pub created_at: u64,
    pub updated_at: u64,
}

pub struct SessionManager {
    sessions: Mutex<Vec<AgentSession>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(Vec::new()),
        }
    }

    /// Create and register a new agent session.
    pub fn create(
        &self,
        project_id: impl Into<String>,
        task_title: impl Into<String>,
        agent_type: impl Into<String>,
        pane_id: u32,
        cwd: impl Into<String>,
        branch: Option<String>,
    ) -> AgentSession {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let id = format!("sess_{now}_{}", uuid::Uuid::new_v4().simple());

        let session = AgentSession {
            id,
            project_id: project_id.into(),
            task_title: task_title.into(),
            agent_type: agent_type.into(),
            status: SessionStatus::Starting,
            status_reason: "Spinning up agent environment...".to_string(),
            attention_score: 0,
            pane_id,
            cwd: cwd.into(),
            branch,
            verification_status: VerificationStatus::Untested,
            created_at: now,
            updated_at: now,
        };

        let mut lock = self.sessions.lock().unwrap();
        lock.insert(0, session.clone());
        session
    }

    /// List all registered sessions, newest first.
    pub fn list(&self) -> Vec<AgentSession> {
        self.sessions.lock().unwrap().clone()
    }

    /// Retrieve session by pane ID.
    pub fn get_by_pane(&self, pane_id: u32) -> Option<AgentSession> {
        self.sessions
            .lock()
            .unwrap()
            .iter()
            .find(|s| s.pane_id == pane_id)
            .cloned()
    }

    /// Update status and attention score.
    pub fn update_status(
        &self,
        pane_id: u32,
        status: SessionStatus,
        reason: impl Into<String>,
        score: u32,
    ) -> Option<AgentSession> {
        let mut lock = self.sessions.lock().unwrap();
        let s = lock.iter_mut().find(|s| s.pane_id == pane_id)?;
        s.status = status;
        s.status_reason = reason.into();
        s.attention_score = score;
        s.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        Some(s.clone())
    }

    /// Update verification status.
    pub fn update_verification(
        &self,
        pane_id: u32,
        status: VerificationStatus,
    ) -> Option<AgentSession> {
        let mut lock = self.sessions.lock().unwrap();
        let s = lock.iter_mut().find(|s| s.pane_id == pane_id)?;
        s.verification_status = status;
        s.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        Some(s.clone())
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_lifecycle() {
        let mgr = SessionManager::new();
        let s = mgr.create("proj-1", "Refactor Auth", "claude", 1, "E:/test", Some("main".into()));

        assert_eq!(s.project_id, "proj-1");
        assert_eq!(s.task_title, "Refactor Auth");
        assert_eq!(s.status, SessionStatus::Starting);

        let updated = mgr
            .update_status(1, SessionStatus::Working, "Executing git status", 10)
            .expect("update");
        assert_eq!(updated.status, SessionStatus::Working);
        assert_eq!(updated.attention_score, 10);

        let verif = mgr
            .update_verification(1, VerificationStatus::Passed)
            .expect("verif");
        assert_eq!(verif.verification_status, VerificationStatus::Passed);

        let found = mgr.get_by_pane(1).expect("find");
        assert_eq!(found.id, s.id);
    }
}
