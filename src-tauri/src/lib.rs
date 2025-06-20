use rusqlite::{params, Connection};
use serde::Serialize;
use csv::ReaderBuilder;

#[derive(Serialize)]
struct AttendanceRecord {
    name: String,
    date: String,
    grade: i64,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn load_csv(content: String) -> Result<(), String> {
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .from_reader(content.as_bytes());
    let conn = Connection::open("attendance.db").map_err(|e| e.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attendance (name TEXT, date TEXT, grade INTEGER)",
        [],
    )
    .map_err(|e| e.to_string())?;
    for result in reader.records() {
        let record = result.map_err(|e| e.to_string())?;
        let name = record.get(0).ok_or("missing name")?;
        let date = record.get(1).ok_or("missing date")?;
        let grade: i64 = record
            .get(2)
            .ok_or("missing grade")?
            .parse()
            .map_err(|_| "invalid grade")?;
        conn.execute(
            "INSERT INTO attendance (name, date, grade) VALUES (?1, ?2, ?3)",
            params![name, date, grade],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_by_grade(grade: i64) -> Result<Vec<AttendanceRecord>, String> {
    let conn = Connection::open("attendance.db").map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT name, date, grade FROM attendance WHERE grade = ?1")
        .map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([grade], |row| {
            Ok(AttendanceRecord {
                name: row.get(0)?,
                date: row.get(1)?,
                grade: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut records = Vec::new();
    for r in iter {
        records.push(r.map_err(|e| e.to_string())?);
    }
    Ok(records)
}

#[tauri::command]
fn get_dates_by_name(name: String) -> Result<Vec<String>, String> {
    let conn = Connection::open("attendance.db").map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT date FROM attendance WHERE name = ?1")
        .map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([name], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let mut dates = Vec::new();
    for d in iter {
        dates.push(d.map_err(|e| e.to_string())?);
    }
    Ok(dates)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            load_csv,
            get_by_grade,
            get_dates_by_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
