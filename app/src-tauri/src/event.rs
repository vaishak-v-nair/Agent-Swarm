use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    StatusChange,
    ToolCall,
    ToolResult,
    PromptInput,
    ErrorLoop,
    Verification,
    SteerMessage,
    ProcessExit,
    Bell,
}

impl std::fmt::Display for EventKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            EventKind::StatusChange => "status_change",
            EventKind::ToolCall => "tool_call",
            EventKind::ToolResult => "tool_result",
            EventKind::PromptInput => "prompt_input",
            EventKind::ErrorLoop => "error_loop",
            EventKind::Verification => "verification",
            EventKind::SteerMessage => "steer_message",
            EventKind::ProcessExit => "process_exit",
            EventKind::Bell => "bell",
        };
        write!(f, "{s}")
    }
}

impl std::str::FromStr for EventKind {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "status_change" => Ok(EventKind::StatusChange),
            "tool_call" => Ok(EventKind::ToolCall),
            "tool_result" => Ok(EventKind::ToolResult),
            "prompt_input" => Ok(EventKind::PromptInput),
            "error_loop" => Ok(EventKind::ErrorLoop),
            "verification" => Ok(EventKind::Verification),
            "steer_message" => Ok(EventKind::SteerMessage),
            "process_exit" => Ok(EventKind::ProcessExit),
            "bell" => Ok(EventKind::Bell),
            other => Err(format!("unknown event kind: {other}")),
        }
    }
}

/// A structured event emitted by any AgentSwarm component (PTY, transcript, steer, or verification).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgentEvent {
    pub id: String,
    pub pane_id: u32,
    pub timestamp_ms: u64,
    pub kind: EventKind,
    pub summary: String,
    pub data: serde_json::Value,
    pub is_error: bool,
}

impl AgentEvent {
    pub fn new(
        pane_id: u32,
        kind: EventKind,
        summary: impl Into<String>,
        data: serde_json::Value,
        is_error: bool,
    ) -> Self {
        let timestamp_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let id = format!("evt_{}_{}", timestamp_ms, uuid::Uuid::new_v4().simple());
        Self {
            id,
            pane_id,
            timestamp_ms,
            kind,
            summary: summary.into(),
            data,
            is_error,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_round_trip_serialization() {
        let evt = AgentEvent::new(
            1,
            EventKind::ToolCall,
            "running cargo check",
            serde_json::json!({ "command": "cargo check", "args": [] }),
            false,
        );
        let serialized = serde_json::to_string(&evt).expect("serialize");
        let deserialized: AgentEvent = serde_json::from_str(&serialized).expect("deserialize");
        assert_eq!(evt, deserialized);
        assert_eq!(evt.kind.to_string(), "tool_call");
    }

    #[test]
    fn test_event_kind_parsing() {
        let kind: EventKind = "error_loop".parse().expect("parse");
        assert_eq!(kind, EventKind::ErrorLoop);
        assert!(kind.to_string() == "error_loop");
        assert!("invalid_kind".parse::<EventKind>().is_err());
    }
}
