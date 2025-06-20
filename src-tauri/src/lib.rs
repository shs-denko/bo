use csv::ReaderBuilder;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
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
    println!("Loading CSV content: {}", content);
    let mut reader = ReaderBuilder::new()
        .has_headers(true)  // ヘッダー行を正しく処理
        .from_reader(content.as_bytes());
    let conn = Connection::open("attendance.db").map_err(|e| e.to_string())?;
    
    // Clear existing data
    conn.execute("DROP TABLE IF EXISTS attendance", [])
        .map_err(|e| e.to_string())?;
    
    conn.execute(
        "CREATE TABLE attendance (name TEXT, date TEXT, grade INTEGER)",
        [],
    )
    .map_err(|e| e.to_string())?;
    
    let mut record_count = 0;
    for result in reader.records() {
        let record = result.map_err(|e| e.to_string())?;
        if record.len() < 3 {
            println!("Skipping incomplete record: {:?}", record);
            continue;
        }
        
        let name = record.get(0).ok_or("missing name")?.trim();
        let date = record.get(1).ok_or("missing date")?.trim();
        let grade_str = record.get(2).ok_or("missing grade")?.trim();
        
        // 空の値をスキップ
        if name.is_empty() || date.is_empty() || grade_str.is_empty() {
            println!("Skipping empty record: name={}, date={}, grade={}", name, date, grade_str);
            continue;
        }
        
        let grade: i64 = grade_str
            .parse()
            .map_err(|_| format!("invalid grade: {}", grade_str))?;
            
        conn.execute(
            "INSERT INTO attendance (name, date, grade) VALUES (?1, ?2, ?3)",
            params![name, date, grade],
        )
        .map_err(|e| e.to_string())?;
        
        record_count += 1;
        println!("Inserted record: {} - {} - {}", name, date, grade);
    }
    
    println!("Total records inserted: {}", record_count);
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
fn get_all_data() -> Result<Vec<AttendanceRecord>, String> {
    println!("Getting all data from database");
    let conn = Connection::open("attendance.db").map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT name, date, grade FROM attendance ORDER BY name, date")
        .map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([], |row| {
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
    println!("Retrieved {} records from database", records.len());
    Ok(records)
}

#[tauri::command]
fn add_record(record: AttendanceRecord) -> Result<(), String> {
    println!("Adding record: {:?}", record);
    let conn = Connection::open("attendance.db").map_err(|e| e.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attendance (name TEXT, date TEXT, grade INTEGER)",
        [],
    )
    .map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO attendance (name, date, grade) VALUES (?1, ?2, ?3)",
        params![record.name, record.date, record.grade],
    )
    .map_err(|e| e.to_string())?;
    
    println!("Record added successfully");
    Ok(())
}

#[tauri::command]
fn export_csv() -> Result<String, String> {
    let conn = Connection::open("attendance.db").map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT name, date, grade FROM attendance ORDER BY name, date")
        .map_err(|e| e.to_string())?;
    
    let iter = stmt
        .query_map([], |row| {
            Ok(AttendanceRecord {
                name: row.get(0)?,
                date: row.get(1)?,
                grade: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    
    let mut csv_content = String::from("name,date,grade\n");
    for record in iter {
        let r = record.map_err(|e| e.to_string())?;
        csv_content.push_str(&format!("{},{},{}\n", r.name, r.date, r.grade));
    }
    
    Ok(csv_content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            load_csv,
            get_by_grade,
            get_all_data,
            add_record,
            export_csv
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
