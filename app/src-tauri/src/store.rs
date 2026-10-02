use crate::event::{AgentEvent, EventKind};
use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;

pub struct EventStore {
    conn: Mutex<Connection>,
}

impl EventStore {
    /// Open or create an SQLite event store on disk.
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path.as_ref())
            .with_context(|| format!("failed to open sqlite event store at {:?}", path.as_ref()))?;
        let store = Self {
            conn: Mutex::new(conn),
        };
        store.init_schema()?;
        Ok(store)
    }

    /// Create an ephemeral in-memory event store (ideal for unit tests).
    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()
            .context("failed to open in-memory sqlite store")?;
        let store = Self {
            conn: Mutex::new(conn),
        };
        store.init_schema()?;
        Ok(store)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 2000;

            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                pane_id INTEGER NOT NULL,
                timestamp_ms INTEGER NOT NULL,
                kind TEXT NOT NULL,
                summary TEXT NOT NULL,
                data TEXT NOT NULL,
                is_error INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_events_pane_ts ON events(pane_id, timestamp_ms DESC);
            CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
            CREATE INDEX IF NOT EXISTS idx_events_error ON events(is_error);
            CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp_ms DESC);
            ",
        )
        .context("failed to initialize events schema and indexes")?;
        Ok(())
    }

    /// Insert an event into the store.
    pub fn insert(&self, event: &AgentEvent) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let data_str = serde_json::to_string(&event.data).unwrap_or_else(|_| "{}".into());
        let is_error_int = if event.is_error { 1 } else { 0 };

        conn.execute(
            "INSERT OR REPLACE INTO events (id, pane_id, timestamp_ms, kind, summary, data, is_error)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                event.id,
                event.pane_id,
                event.timestamp_ms as i64,
                event.kind.to_string(),
                event.summary,
                data_str,
                is_error_int,
            ],
        )
        .context("failed to insert agent event")?;
        Ok(())
    }

    /// Query recent events across all panes.
    pub fn query_recent(&self, limit: usize) -> Result<Vec<AgentEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, pane_id, timestamp_ms, kind, summary, data, is_error
             FROM events
             ORDER BY timestamp_ms DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], Self::map_row)?;
        let mut events = Vec::new();
        for r in rows {
            events.push(r?);
        }
        Ok(events)
    }

    /// Query events for a specific pane.
    pub fn query_by_pane(&self, pane_id: u32, limit: usize) -> Result<Vec<AgentEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, pane_id, timestamp_ms, kind, summary, data, is_error
             FROM events
             WHERE pane_id = ?1
             ORDER BY timestamp_ms DESC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![pane_id, limit as i64], Self::map_row)?;
        let mut events = Vec::new();
        for r in rows {
            events.push(r?);
        }
        Ok(events)
    }

    /// Query recent errors across all panes.
    pub fn query_errors(&self, limit: usize) -> Result<Vec<AgentEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, pane_id, timestamp_ms, kind, summary, data, is_error
             FROM events
             WHERE is_error = 1
             ORDER BY timestamp_ms DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], Self::map_row)?;
        let mut events = Vec::new();
        for r in rows {
            events.push(r?);
        }
        Ok(events)
    }

    /// Count total recorded events.
    pub fn count(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM events", [], |r| r.get(0))?;
        Ok(count as usize)
    }

    fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AgentEvent> {
        let id: String = row.get(0)?;
        let pane_id: u32 = row.get(1)?;
        let timestamp_ms: i64 = row.get(2)?;
        let kind_str: String = row.get(3)?;
        let summary: String = row.get(4)?;
        let data_str: String = row.get(5)?;
        let is_error_int: i32 = row.get(6)?;

        let kind = kind_str.parse().unwrap_or(EventKind::StatusChange);
        let data = serde_json::from_str(&data_str).unwrap_or(serde_json::Value::Null);

        Ok(AgentEvent {
            id,
            pane_id,
            timestamp_ms: timestamp_ms as u64,
            kind,
            summary,
            data,
            is_error: is_error_int != 0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_in_memory_store_insert_and_queries() {
        let store = EventStore::in_memory().expect("in_memory store");
        assert_eq!(store.count().expect("count"), 0);

        let evt1 = AgentEvent::new(
            1,
            EventKind::StatusChange,
            "pane 1 busy",
            serde_json::json!({ "state": "busy" }),
            false,
        );
        let evt2 = AgentEvent::new(
            1,
            EventKind::ErrorLoop,
            "pane 1 compilation error",
            serde_json::json!({ "error": "cannot find module" }),
            true,
        );
        let evt3 = AgentEvent::new(
            2,
            EventKind::ToolCall,
            "pane 2 running git status",
            serde_json::json!({ "tool": "git" }),
            false,
        );

        store.insert(&evt1).expect("insert evt1");
        store.insert(&evt2).expect("insert evt2");
        store.insert(&evt3).expect("insert evt3");

        assert_eq!(store.count().expect("count"), 3);

        // Query by pane
        let pane1_events = store.query_by_pane(1, 10).expect("query pane 1");
        assert_eq!(pane1_events.len(), 2);
        assert!(pane1_events.iter().any(|e| e.is_error));

        // Query errors
        let errors = store.query_errors(10).expect("query errors");
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].summary, "pane 1 compilation error");

        // Query recent
        let recent = store.query_recent(2).expect("query recent");
        assert_eq!(recent.len(), 2);
    }
}
