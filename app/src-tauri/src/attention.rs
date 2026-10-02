use crate::event::{AgentEvent, EventKind};
use crate::store::EventStore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AttentionLevel {
    Urgent,       // Bell, fatal error, crash
    ActionNeeded, // Tool confirmation, human input required
    Waiting,      // Turn finished, prompt ready
    Working,      // Actively streaming output / tool running
    Idle,         // Inactive
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttentionItem {
    pub pane_id: u32,
    pub score: i32,
    pub level: AttentionLevel,
    pub reason: String,
    pub last_event_ms: u64,
    pub is_error: bool,
}

pub struct AttentionScorer;

impl AttentionScorer {
    /// Calculate the attention score and level for a list of recent events belonging to a pane.
    pub fn score_pane(pane_id: u32, events: &[AgentEvent], now_ms: u64) -> AttentionItem {
        if events.is_empty() {
            return AttentionItem {
                pane_id,
                score: 0,
                level: AttentionLevel::Idle,
                reason: "no recorded events".to_string(),
                last_event_ms: 0,
                is_error: false,
            };
        }

        let latest = &events[0];
        let mut score: i32 = 0;
        let mut level = AttentionLevel::Idle;
        let mut reason = latest.summary.clone();
        let is_error = latest.is_error;

        // Check if a bell rung recently (within last 60 seconds)
        let has_recent_bell = events.iter().any(|e| {
            e.kind == EventKind::Bell && now_ms.saturating_sub(e.timestamp_ms) < 60_000
        });

        match latest.kind {
            EventKind::Bell => {
                score += 50;
                level = AttentionLevel::Urgent;
                reason = "terminal bell rung".to_string();
            }
            EventKind::ProcessExit => {
                if latest.is_error {
                    score += 45;
                    level = AttentionLevel::Urgent;
                    reason = format!("process crashed or exited with error");
                } else {
                    score += 10;
                    level = AttentionLevel::Waiting;
                    reason = "process exited normally".to_string();
                }
            }
            EventKind::ErrorLoop => {
                score += 40;
                level = AttentionLevel::Urgent;
                reason = "error loop detected".to_string();
            }
            EventKind::ToolCall => {
                let lower = latest.summary.to_lowercase();
                let is_asking_permission = lower.contains("permission")
                    || lower.contains("confirm")
                    || lower.contains("approve");
                if is_asking_permission {
                    score += 40;
                    level = AttentionLevel::ActionNeeded;
                } else {
                    score += 5;
                    level = AttentionLevel::Working;
                }
            }
            EventKind::PromptInput => {
                score += 20;
                level = AttentionLevel::Waiting;
                reason = "waiting for user input".to_string();
            }
            EventKind::StatusChange => {
                if latest.summary.contains("waiting") || latest.summary.contains("your turn") {
                    score += 25;
                    level = AttentionLevel::ActionNeeded;
                } else if latest.summary.contains("working") || latest.summary.contains("tool") {
                    score += 5;
                    level = AttentionLevel::Working;
                } else {
                    score += 0;
                    level = AttentionLevel::Idle;
                }
            }
            _ => {
                if latest.is_error {
                    score += 35;
                    level = AttentionLevel::Urgent;
                }
            }
        }

        if has_recent_bell && level != AttentionLevel::Urgent {
            score += 30;
            level = AttentionLevel::Urgent;
            reason = format!("{reason} (bell rung)");
        }

        // Apply time decay: -5 score per minute since last event
        let elapsed_mins = (now_ms.saturating_sub(latest.timestamp_ms) / 60_000) as i32;
        let decayed_score = (score - (elapsed_mins * 5)).max(0);

        AttentionItem {
            pane_id,
            score: decayed_score,
            level,
            reason,
            last_event_ms: latest.timestamp_ms,
            is_error,
        }
    }

    /// Compute ranked attention queue across all active panes.
    pub fn rank_panes(
        pane_ids: &[u32],
        store: &EventStore,
        now_ms: u64,
    ) -> Vec<AttentionItem> {
        let mut items = Vec::new();
        for &id in pane_ids {
            let events = store.query_by_pane(id, 20).unwrap_or_default();
            items.push(Self::score_pane(id, &events, now_ms));
        }

        // Sort descending: highest attention score first
        items.sort_by(|a, b| {
            b.score
                .cmp(&a.score)
                .then_with(|| b.last_event_ms.cmp(&a.last_event_ms))
        });
        items
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_empty_events_yields_idle() {
        let item = AttentionScorer::score_pane(1, &[], 100_000);
        assert_eq!(item.pane_id, 1);
        assert_eq!(item.score, 0);
        assert_eq!(item.level, AttentionLevel::Idle);
    }

    #[test]
    fn test_bell_scores_urgent_highest() {
        let event = AgentEvent::new(
            1,
            EventKind::Bell,
            "bell rung".to_string(),
            json!({}),
            false,
        );
        let now = event.timestamp_ms;
        let item = AttentionScorer::score_pane(1, &[event], now);
        assert_eq!(item.level, AttentionLevel::Urgent);
        assert_eq!(item.score, 50);
    }

    #[test]
    fn test_error_exit_scores_urgent() {
        let event = AgentEvent::new(
            2,
            EventKind::ProcessExit,
            "exit code 1".to_string(),
            json!({ "code": 1 }),
            true,
        );
        let now = event.timestamp_ms;
        let item = AttentionScorer::score_pane(2, &[event], now);
        assert_eq!(item.level, AttentionLevel::Urgent);
        assert_eq!(item.score, 45);
        assert!(item.is_error);
    }

    #[test]
    fn test_time_decay_reduces_score() {
        let mut event = AgentEvent::new(
            3,
            EventKind::PromptInput,
            "prompt waiting".to_string(),
            json!({}),
            false,
        );
        event.timestamp_ms = 1_000_000;
        // 2 minutes later
        let now = event.timestamp_ms + 120_000;
        let item = AttentionScorer::score_pane(3, &[event], now);
        // Base score for prompt input is 20, decayed by 2*5 = 10 -> 10
        assert_eq!(item.score, 10);
        assert_eq!(item.level, AttentionLevel::Waiting);
    }

    #[test]
    fn test_ranking_orders_urgent_over_working() {
        let store = EventStore::in_memory().unwrap();

        // Pane 1: Working on tool
        let e1 = AgentEvent::new(1, EventKind::ToolCall, "running git status", json!({}), false);
        store.insert(&e1).unwrap();

        // Pane 2: Bell rung
        let e2 = AgentEvent::new(2, EventKind::Bell, "test suite done", json!({}), false);
        store.insert(&e2).unwrap();

        let queue = AttentionScorer::rank_panes(&[1, 2], &store, e2.timestamp_ms);
        assert_eq!(queue.len(), 2);
        assert_eq!(queue[0].pane_id, 2, "Pane 2 with bell must rank first");
        assert_eq!(queue[1].pane_id, 1, "Pane 1 working must rank second");
    }
}
