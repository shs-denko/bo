#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::State;
use rusqlite::{Connection, params};
use serde::Serialize;

#[derive(Default)]
struct Db(Connection);

#[derive(Serialize)]
struct Attendance {
    name: String,
    date: String,
    grade: String,
}

#[tauri::command]
fn load_csv(db: State<Db>, csv: String) -> tauri::Result<()> {
    let mut rdr = csv::Reader::from_reader(csv.as_bytes());
    let conn = &db.0;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attendance (name TEXT, date TEXT, grade TEXT)",
        [],
    ).unwrap();
    for result in rdr.records() {
        let record = result.unwrap();
        let name = record.get(0).unwrap_or("");
        let date = record.get(1).unwrap_or("");
        let grade = record.get(2).unwrap_or("");
        conn.execute(
            "INSERT INTO attendance (name, date, grade) VALUES (?1, ?2, ?3)",
            params![name, date, grade],
        ).unwrap();
    }
    Ok(())
}

#[tauri::command]
fn list_attendance(db: State<Db>, grade: Option<String>) -> tauri::Result<Vec<Attendance>> {
    let conn = &db.0;
    let mut stmt = if let Some(g) = &grade {
        conn.prepare("SELECT name, date, grade FROM attendance WHERE grade = ?1").unwrap()
    } else {
        conn.prepare("SELECT name, date, grade FROM attendance").unwrap()
    };
    let rows = if let Some(g) = grade {
        stmt.query_map(params![g], |row| {
            Ok(Attendance {
                name: row.get(0)?,
                date: row.get(1)?,
                grade: row.get(2)?,
            })
        }).unwrap()
    } else {
        stmt.query_map([], |row| {
            Ok(Attendance {
                name: row.get(0)?,
                date: row.get(1)?,
                grade: row.get(2)?,
            })
        }).unwrap()
    };
    let mut result = Vec::new();
    for r in rows {
        result.push(r.unwrap());
    }
    Ok(result)
}

fn main() {
    tauri::Builder::default()
        .manage(Db(Connection::open_in_memory().unwrap()))
        .invoke_handler(tauri::generate_handler![load_csv, list_attendance])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
