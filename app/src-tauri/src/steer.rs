use crate::pty::Panes;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SteerRequest {
    pub token: String,
    pub pane_id: u32,
    pub action: String,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SteerResponse {
    pub success: bool,
    pub message: String,
}

/// Strip dangerous ANSI escape sequences (e.g. OSC / ESC) to prevent terminal injection
/// while preserving clean command text, whitespace, and newlines.
pub fn sanitize_steer_payload(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // Strip ESC sequences
            if let Some(&next) = chars.peek() {
                if next == '[' || next == ']' || next == '(' || next == ')' {
                    chars.next();
                    // consume until end of sequence
                    while let Some(&seq_char) = chars.peek() {
                        chars.next();
                        if (seq_char >= '@' && seq_char <= '~') || seq_char == '\x07' {
                            break;
                        }
                    }
                }
            }
        } else if c == '\0' || (c < ' ' && c != '\n' && c != '\r' && c != '\t') {
            // Drop control characters except newline, carriage return, tab
            continue;
        } else {
            out.push(c);
        }
    }
    out
}

/// Process a steer request against the active panes with session token authentication.
pub fn execute_steer(
    panes: &Arc<Panes>,
    req: SteerRequest,
    expected_token: &str,
) -> SteerResponse {
    if req.token.trim() != expected_token.trim() {
        return SteerResponse {
            success: false,
            message: "invalid session token".into(),
        };
    }

    let sanitized = sanitize_steer_payload(&req.payload);
    let pane_exists = panes.0.lock().unwrap().contains_key(&req.pane_id);
    if !pane_exists {
        return SteerResponse {
            success: false,
            message: format!("pane {} not found", req.pane_id),
        };
    }

    match req.action.as_str() {
        "write" | "steer" => {
            crate::pty::write(panes, req.pane_id, &sanitized);
            SteerResponse {
                success: true,
                message: format!("steered pane {}", req.pane_id),
            }
        }
        "pause" => {
            // Send Ctrl+C (SIGINT) to pause or interrupt current execution
            crate::pty::write(panes, req.pane_id, "\x03");
            SteerResponse {
                success: true,
                message: format!("paused pane {}", req.pane_id),
            }
        }
        other => SteerResponse {
            success: false,
            message: format!("unsupported steer action: {}", other),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_steer_payload() {
        let raw = "echo 'hello'\n";
        assert_eq!(sanitize_steer_payload(raw), "echo 'hello'\n");

        let dangerous = "\x1b[31mred\x1b[0m\x00test\r\n";
        assert_eq!(sanitize_steer_payload(dangerous), "redtest\r\n");
    }

    #[test]
    fn test_execute_steer_auth_failure() {
        let panes = Arc::new(Panes::default());
        let req = SteerRequest {
            token: "wrong-token".into(),
            pane_id: 1,
            action: "write".into(),
            payload: "ls\n".into(),
        };
        let res = execute_steer(&panes, req, "correct-token");
        assert!(!res.success);
        assert_eq!(res.message, "invalid session token");
    }

    #[test]
    fn test_execute_steer_nonexistent_pane() {
        let panes = Arc::new(Panes::default());
        let req = SteerRequest {
            token: "valid-token".into(),
            pane_id: 999,
            action: "write".into(),
            payload: "ls\n".into(),
        };
        let res = execute_steer(&panes, req, "valid-token");
        assert!(!res.success);
        assert!(res.message.contains("not found") || res.message.contains("failed to write"));
    }
}
