use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: i64,
    pub content_type: String,
    pub content_text: Option<String>,
    pub content_image: Option<Vec<u8>>,
    pub image_width: Option<i32>,
    pub image_height: Option<i32>,
    pub mime_type: Option<String>,
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub is_pinned: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItemPreview {
    pub id: i64,
    pub content_type: String,
    pub content_text: Option<String>,
    pub has_image: bool,
    pub image_width: Option<i32>,
    pub image_height: Option<i32>,
    pub mime_type: Option<String>,
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub is_pinned: bool,
    pub created_at: String,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS clipboard_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_type TEXT NOT NULL,
                content_text TEXT,
                content_image BLOB,
                image_width INTEGER,
                image_height INTEGER,
                mime_type TEXT,
                is_pinned BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
            CREATE INDEX IF NOT EXISTS idx_content_type ON clipboard_items(content_type);
            CREATE INDEX IF NOT EXISTS idx_created_at ON clipboard_items(created_at);
            CREATE INDEX IF NOT EXISTS idx_is_pinned ON clipboard_items(is_pinned);"
        )?;

        // Migrate: add file columns if missing
        let columns: Vec<String> = self.conn
            .prepare("PRAGMA table_info(clipboard_items)")?
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();

        if !columns.contains(&"file_path".to_string()) {
            self.conn.execute_batch(
                "ALTER TABLE clipboard_items ADD COLUMN file_path TEXT;
                 ALTER TABLE clipboard_items ADD COLUMN file_name TEXT;
                 ALTER TABLE clipboard_items ADD COLUMN file_size INTEGER;"
            )?;
        }

        Ok(())
    }

    pub fn add_text_item(&self, text: &str) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO clipboard_items (content_type, content_text) VALUES ('text', ?1)",
            params![text],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn add_image_item(&self, image_data: &[u8], width: i32, height: i32, mime_type: &str) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO clipboard_items (content_type, content_image, image_width, image_height, mime_type) 
             VALUES ('image', ?1, ?2, ?3, ?4)",
            params![image_data, width, height, mime_type],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_items(
        &self,
        content_type: Option<&str>,
        search_query: Option<&str>,
        time_filter: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ClipboardItemPreview>> {
        let mut query = String::from(
            "SELECT id, content_type, content_text, 
                    CASE WHEN content_image IS NOT NULL THEN 1 ELSE 0 END as has_image,
                    image_width, image_height, mime_type, file_path, file_name, file_size,
                    is_pinned, created_at 
             FROM clipboard_items WHERE 1=1"
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ct) = content_type {
            if ct != "all" {
                query.push_str(" AND content_type = ?1");
                param_values.push(Box::new(ct.to_string()));
            }
        }

        if let Some(sq) = search_query {
            if !sq.is_empty() {
                let idx = param_values.len() + 1;
                query.push_str(&format!(" AND (content_text LIKE ?{} OR file_name LIKE ?{})", idx, idx + 1));
                param_values.push(Box::new(format!("%{}%", sq)));
                param_values.push(Box::new(format!("%{}%", sq)));
            }
        }

        if let Some(tf) = time_filter {
            if tf != "all" {
                let time_condition = match tf {
                    "today" => format!(" AND date(created_at) = date('now')"),
                    "yesterday" => format!(" AND date(created_at) = date('now', '-1 day')"),
                    "week" => format!(" AND created_at >= datetime('now', '-7 days')"),
                    "month" => format!(" AND created_at >= datetime('now', '-30 days')"),
                    _ => String::new(),
                };
                query.push_str(&time_condition);
            }
        }

        query.push_str(" ORDER BY is_pinned DESC, created_at DESC");
        
        let idx = param_values.len() + 1;
        query.push_str(&format!(" LIMIT ?{}", idx));
        param_values.push(Box::new(limit));
        
        let idx = param_values.len() + 1;
        query.push_str(&format!(" OFFSET ?{}", idx));
        param_values.push(Box::new(offset));

        let mut stmt = self.conn.prepare(&query)?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        
        let items = stmt.query_map(params_ref.as_slice(), |row| {
            Ok(ClipboardItemPreview {
                id: row.get(0)?,
                content_type: row.get(1)?,
                content_text: row.get(2)?,
                has_image: row.get::<_, i32>(3)? == 1,
                image_width: row.get(4)?,
                image_height: row.get(5)?,
                mime_type: row.get(6)?,
                file_path: row.get(7)?,
                file_name: row.get(8)?,
                file_size: row.get(9)?,
                is_pinned: row.get::<_, i32>(10)? == 1,
                created_at: row.get(11)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(items)
    }

    pub fn get_item_detail(&self, id: i64) -> Result<Option<ClipboardItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content_type, content_text, content_image, image_width, image_height, 
                    mime_type, file_path, file_name, file_size, is_pinned, created_at 
             FROM clipboard_items WHERE id = ?1"
        )?;

        let mut items = stmt.query_map(params![id], |row| {
            Ok(ClipboardItem {
                id: row.get(0)?,
                content_type: row.get(1)?,
                content_text: row.get(2)?,
                content_image: row.get(3)?,
                image_width: row.get(4)?,
                image_height: row.get(5)?,
                mime_type: row.get(6)?,
                file_path: row.get(7)?,
                file_name: row.get(8)?,
                file_size: row.get(9)?,
                is_pinned: row.get::<_, i32>(10)? == 1,
                created_at: row.get(11)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(items.pop())
    }

    pub fn delete_item(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM clipboard_items WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn toggle_pin(&self, id: i64) -> Result<bool> {
        self.conn.execute(
            "UPDATE clipboard_items SET is_pinned = NOT is_pinned WHERE id = ?1",
            params![id],
        )?;
        let is_pinned: bool = self.conn.query_row(
            "SELECT is_pinned FROM clipboard_items WHERE id = ?1",
            params![id],
            |row| row.get::<_, i32>(0).map(|v| v == 1),
        )?;
        Ok(is_pinned)
    }

    pub fn clear_all(&self) -> Result<()> {
        self.conn.execute("DELETE FROM clipboard_items WHERE is_pinned = 0", [])?;
        Ok(())
    }

    pub fn get_total_count(&self, content_type: Option<&str>, search_query: Option<&str>, time_filter: Option<&str>) -> Result<i64> {
        let mut query = String::from("SELECT COUNT(*) FROM clipboard_items WHERE 1=1");
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ct) = content_type {
            if ct != "all" {
                query.push_str(" AND content_type = ?1");
                param_values.push(Box::new(ct.to_string()));
            }
        }

        if let Some(sq) = search_query {
            if !sq.is_empty() {
                let idx = param_values.len() + 1;
                query.push_str(&format!(" AND content_text LIKE ?{}", idx));
                param_values.push(Box::new(format!("%{}%", sq)));
            }
        }

        if let Some(tf) = time_filter {
            if tf != "all" {
                let time_condition = match tf {
                    "today" => " AND date(created_at) = date('now')",
                    "yesterday" => " AND date(created_at) = date('now', '-1 day')",
                    "week" => " AND created_at >= datetime('now', '-7 days')",
                    "month" => " AND created_at >= datetime('now', '-30 days')",
                    _ => "",
                };
                query.push_str(time_condition);
            }
        }

        let mut stmt = self.conn.prepare(&query)?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        let count = stmt.query_row(params_ref.as_slice(), |row| row.get(0))?;
        Ok(count)
    }

    pub fn is_duplicate_text(&self, text: &str) -> Result<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM clipboard_items WHERE content_type = 'text' AND content_text = ?1",
            params![text],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }
}
