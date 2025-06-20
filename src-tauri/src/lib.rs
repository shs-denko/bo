use csv::ReaderBuilder;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use encoding_rs::{SHIFT_JIS, UTF_8};

#[derive(Serialize, Deserialize, Debug)]
struct AttendanceRecord {
    name: String,
    date: String,
    grade: i64,
}

#[derive(Serialize, Deserialize, Debug)]
struct AttendanceStatus {
    name: String,
    date: String,
    grade: i64,
    present: bool,
}

#[derive(Serialize, Deserialize, Debug)]
struct AttendanceMatrix {
    students: Vec<String>,
    dates: Vec<String>,
    attendance: Vec<AttendanceStatus>,
}

fn db_path(app: &AppHandle) -> PathBuf {
    let mut dir = app
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().expect("failed to get current directory"));
    if let Err(e) = std::fs::create_dir_all(&dir) {
        eprintln!("failed to create data directory: {}", e);
    }
    dir.push("attendance.db");
    dir
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn load_csv(app: AppHandle, content: String) -> Result<(), String> {
    println!("Loading CSV content (length: {} chars)", content.len());
    
    // 文字エンコーディングを検出して変換
    let content_bytes = content.as_bytes();
    let (decoded_content, _, had_errors) = if content.starts_with('\u{feff}') {
        // UTF-8 BOM付き
        (content.strip_prefix('\u{feff}').unwrap_or(&content).to_string(), UTF_8, false)
    } else if content_bytes.len() >= 3 && &content_bytes[0..3] == [0xEF, 0xBB, 0xBF] {
        // UTF-8 BOMをバイト列で検出
        let without_bom = &content_bytes[3..];
        let (cow, _, had_errors) = UTF_8.decode(without_bom);
        (cow.into_owned(), UTF_8, had_errors)
    } else {
        // Shift_JISの可能性をチェック
        let (cow, encoding_used, had_errors) = SHIFT_JIS.decode(content_bytes);
        if had_errors {
            // Shift_JISでエラーがある場合はUTF-8として扱う
            (content, UTF_8, false)
        } else {
            (cow.into_owned(), encoding_used, had_errors)
        }
    };
    
    if had_errors {
        println!("Warning: Character encoding conversion had errors");
    }
    
    let mut reader = ReaderBuilder::new()
        .has_headers(true)
        .flexible(true) // フィールド数の違いを許容
        .from_reader(decoded_content.as_bytes());
    
    let conn = Connection::open(db_path(&app)).map_err(|e| {
        eprintln!("Database connection error: {}", e);
        format!("データベース接続エラー: {}", e)
    })?;// Clear existing data
    conn.execute("DROP TABLE IF EXISTS attendance", [])
        .map_err(|e| {
            eprintln!("Error dropping table: {}", e);
            format!("テーブル削除エラー: {}", e)
        })?;    conn.execute(
        "CREATE TABLE attendance (name TEXT, date TEXT, grade INTEGER)",
        [],
    )
    .map_err(|e| {
        eprintln!("Error creating table: {}", e);
        format!("テーブル作成エラー: {}", e)
    })?;

    // 出席状況テーブルも作成
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attendance_status (name TEXT, date TEXT, grade INTEGER, present BOOLEAN DEFAULT 1)",
        [],
    )
    .map_err(|e| {
        eprintln!("Error creating attendance_status table: {}", e);
        format!("出席状況テーブル作成エラー: {}", e)
    })?;

    let mut record_count = 0;
    let mut error_count = 0;
    
    for (line_num, result) in reader.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                eprintln!("CSV parsing error at line {}: {}", line_num + 2, e);
                error_count += 1;
                continue;
            }
        };
        
        if record.len() < 3 {
            println!("Skipping incomplete record at line {}: {:?}", line_num + 2, record);
            error_count += 1;
            continue;
        }

        let name = record.get(0).unwrap_or("").trim();
        let date = record.get(1).unwrap_or("").trim();
        let grade_str = record.get(2).unwrap_or("").trim();

        // 空の値をスキップ
        if name.is_empty() || date.is_empty() || grade_str.is_empty() {
            println!(
                "Skipping empty record at line {}: name={}, date={}, grade={}",
                line_num + 2, name, date, grade_str
            );
            error_count += 1;
            continue;
        }

        let grade: i64 = match grade_str.parse() {
            Ok(g) => g,
            Err(_) => {
                eprintln!("Invalid grade at line {}: {}", line_num + 2, grade_str);
                error_count += 1;
                continue;
            }
        };        match conn.execute(
            "INSERT INTO attendance (name, date, grade) VALUES (?1, ?2, ?3)",
            params![name, date, grade],
        ) {
            Ok(_) => {
                record_count += 1;
                println!("Inserted record: {} - {} - {}", name, date, grade);
                
                // 出席状況テーブルにもデフォルトで出席として追加
                let _ = conn.execute(
                    "INSERT OR REPLACE INTO attendance_status (name, date, grade, present) VALUES (?1, ?2, ?3, 1)",
                    params![name, date, grade],
                );
            }
            Err(e) => {
                eprintln!("Database insert error at line {}: {}", line_num + 2, e);
                error_count += 1;
            }
        }
    }

    println!("CSV読み込み完了: {}件成功, {}件エラー", record_count, error_count);
    
    if record_count == 0 && error_count > 0 {
        return Err("CSVファイルの読み込みに失敗しました。ファイル形式を確認してください。".to_string());
    }
    
    Ok(())
}

#[tauri::command]
fn get_by_grade(app: AppHandle, grade: i64) -> Result<Vec<AttendanceRecord>, String> {
    let conn = Connection::open(db_path(&app)).map_err(|e| e.to_string())?;
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
fn get_all_data(app: AppHandle) -> Result<Vec<AttendanceRecord>, String> {
    println!("Getting all data from database");
    let db_path = db_path(&app);
    println!("Database path: {:?}", db_path);
    
    // ファイルが存在するかチェック
    if !db_path.exists() {
        println!("Database file does not exist");
        return Ok(Vec::new());
    }
    
    let conn = Connection::open(&db_path).map_err(|e| {
        eprintln!("Failed to open database: {}", e);
        format!("データベース接続エラー: {}", e)
    })?;
    
    // テーブルが存在するかチェック
    let table_exists: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance'")
        .and_then(|mut stmt| {
            stmt.query_row([], |_| Ok(true))
        })
        .unwrap_or(false);
    
    if !table_exists {
        println!("Attendance table does not exist");
        return Ok(Vec::new());
    }
    
    let mut stmt = conn
        .prepare("SELECT name, date, grade FROM attendance ORDER BY name, date")
        .map_err(|e| {
            eprintln!("Failed to prepare statement: {}", e);
            format!("クエリ準備エラー: {}", e)
        })?;
    
    let iter = stmt
        .query_map([], |row| {
            Ok(AttendanceRecord {
                name: row.get(0)?,
                date: row.get(1)?,
                grade: row.get(2)?,
            })
        })
        .map_err(|e| {
            eprintln!("Failed to execute query: {}", e);
            format!("クエリ実行エラー: {}", e)
        })?;
        
    let mut records = Vec::new();
    for r in iter {
        let record = r.map_err(|e| {
            eprintln!("Failed to read record: {}", e);
            format!("レコード読み込みエラー: {}", e)
        })?;
        records.push(record);
    }
    
    println!("Retrieved {} records from database", records.len());
    for record in &records {
        println!("Record: {:?}", record);
    }
    
    Ok(records)
}

#[tauri::command]
fn add_record(app: AppHandle, record: AttendanceRecord) -> Result<(), String> {
    println!("Adding record: {:?}", record);
    let conn = Connection::open(db_path(&app)).map_err(|e| e.to_string())?;    conn.execute(
        "CREATE TABLE IF NOT EXISTS attendance (name TEXT, date TEXT, grade INTEGER)",
        [],
    )
    .map_err(|e| e.to_string())?;

    // 出席状況テーブルも作成
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attendance_status (name TEXT, date TEXT, grade INTEGER, present BOOLEAN DEFAULT 1)",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO attendance (name, date, grade) VALUES (?1, ?2, ?3)",
        params![record.name, record.date, record.grade],
    )
    .map_err(|e| e.to_string())?;

    // 出席状況テーブルにもデフォルトで出席として追加
    conn.execute(
        "INSERT OR REPLACE INTO attendance_status (name, date, grade, present) VALUES (?1, ?2, ?3, 1)",
        params![record.name, record.date, record.grade],
    )
    .map_err(|e| e.to_string())?;

    println!("Record added successfully");
    Ok(())
}

#[tauri::command]
fn export_csv(app: AppHandle) -> Result<String, String> {
    println!("Exporting CSV data");
    let conn = Connection::open(db_path(&app)).map_err(|e| {
        eprintln!("Database connection error during export: {}", e);
        format!("データベース接続エラー: {}", e)
    })?;
    
    // テーブルが存在するかチェック
    let table_exists: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance'")
        .and_then(|mut stmt| {
            stmt.query_row([], |_| Ok(true))
        })
        .unwrap_or(false);
    
    if !table_exists {
        return Err("データベースにattendanceテーブルが存在しません。".to_string());
    }
    
    let mut stmt = conn
        .prepare("SELECT name, date, grade FROM attendance ORDER BY name, date")
        .map_err(|e| {
            eprintln!("Error preparing select statement: {}", e);
            format!("クエリ準備エラー: {}", e)
        })?;

    let iter = stmt
        .query_map([], |row| {
            Ok(AttendanceRecord {
                name: row.get(0)?,
                date: row.get(1)?,
                grade: row.get(2)?,
            })
        })
        .map_err(|e| {
            eprintln!("Error executing query: {}", e);
            format!("クエリ実行エラー: {}", e)
        })?;

    let mut csv_content = String::from("name,date,grade\n");
    let mut record_count = 0;
    
    for record in iter {
        let r = record.map_err(|e| {
            eprintln!("Error reading record: {}", e);
            format!("レコード読み込みエラー: {}", e)
        })?;
        
        // CSVエスケープ処理
        let escaped_name = if r.name.contains(',') || r.name.contains('"') || r.name.contains('\n') {
            format!("\"{}\"", r.name.replace('"', "\"\""))
        } else {
            r.name
        };
        
        csv_content.push_str(&format!("{},{},{}\n", escaped_name, r.date, r.grade));
        record_count += 1;
    }    println!("Exported {} records to CSV", record_count);
    Ok(csv_content)
}

#[tauri::command]
fn get_attendance_matrix(app: AppHandle, grade: i64) -> Result<AttendanceMatrix, String> {
    println!("Getting attendance matrix for grade: {}", grade);
    let conn = Connection::open(db_path(&app)).map_err(|e| {
        eprintln!("Database connection error: {}", e);
        format!("データベース接続エラー: {}", e)
    })?;

    // 出席状況テーブルが存在するかチェック
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attendance_status (name TEXT, date TEXT, grade INTEGER, present BOOLEAN DEFAULT 1)",
        [],
    )
    .map_err(|e| format!("テーブル作成エラー: {}", e))?;

    // 学生一覧を取得（指定された学年のみ）
    let mut stmt = conn
        .prepare("SELECT DISTINCT name FROM attendance WHERE grade = ? ORDER BY name")
        .map_err(|e| format!("学生一覧取得エラー: {}", e))?;
    
    let student_iter = stmt
        .query_map([grade], |row| Ok(row.get::<_, String>(0)?))
        .map_err(|e| format!("学生一覧クエリエラー: {}", e))?;
    
    let mut students = Vec::new();
    for student in student_iter {
        students.push(student.map_err(|e| format!("学生データエラー: {}", e))?);
    }

    println!("Found {} students for grade {}", students.len(), grade);

    // 日付一覧を取得（指定された学年のみ）
    let mut stmt = conn
        .prepare("SELECT DISTINCT date FROM attendance WHERE grade = ? ORDER BY date")
        .map_err(|e| format!("日付一覧取得エラー: {}", e))?;
    
    let date_iter = stmt
        .query_map([grade], |row| Ok(row.get::<_, String>(0)?))
        .map_err(|e| format!("日付一覧クエリエラー: {}", e))?;
    
    let mut dates = Vec::new();
    for date in date_iter {
        dates.push(date.map_err(|e| format!("日付データエラー: {}", e))?);
    }

    println!("Found {} dates for grade {}", dates.len(), grade);

    // 出席状況を取得（指定された学年のみ）
    let mut stmt = conn
        .prepare(
            "SELECT a.name, a.date, a.grade, COALESCE(s.present, 1) as present 
             FROM attendance a 
             LEFT JOIN attendance_status s ON a.name = s.name AND a.date = s.date 
             WHERE a.grade = ?
             ORDER BY a.name, a.date"
        )
        .map_err(|e| format!("出席状況取得エラー: {}", e))?;    
    let attendance_iter = stmt
        .query_map([grade], |row| {
            Ok(AttendanceStatus {
                name: row.get(0)?,
                date: row.get(1)?,
                grade: row.get(2)?,
                present: row.get::<_, i64>(3)? == 1,
            })
        })
        .map_err(|e| format!("出席状況クエリエラー: {}", e))?;
    
    let mut attendance = Vec::new();
    for status in attendance_iter {
        attendance.push(status.map_err(|e| format!("出席状況データエラー: {}", e))?);
    }

    println!("Retrieved {} students, {} dates, {} attendance records for grade {}", 
             students.len(), dates.len(), attendance.len(), grade);

    Ok(AttendanceMatrix {
        students,
        dates,
        attendance,
    })
}

#[tauri::command]
fn update_attendance(app: AppHandle, name: String, date: String, present: bool) -> Result<(), String> {
    println!("Updating attendance: {} - {} - {}", name, date, present);
    let conn = Connection::open(db_path(&app)).map_err(|e| {
        eprintln!("Database connection error: {}", e);
        format!("データベース接続エラー: {}", e)
    })?;

    // 出席状況テーブルが存在するかチェック
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attendance_status (name TEXT, date TEXT, grade INTEGER, present BOOLEAN DEFAULT 1)",
        [],
    )
    .map_err(|e| format!("テーブル作成エラー: {}", e))?;

    // 学年情報を取得
    let grade: i64 = conn
        .query_row(
            "SELECT grade FROM attendance WHERE name = ?1 AND date = ?2 LIMIT 1",
            params![name, date],
            |row| row.get(0),
        )
        .map_err(|e| format!("学年取得エラー: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO attendance_status (name, date, grade, present) VALUES (?1, ?2, ?3, ?4)",
        params![name, date, grade, present as i64],
    )
    .map_err(|e| format!("出席状況更新エラー: {}", e))?;

    println!("Attendance updated successfully");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())        .invoke_handler(tauri::generate_handler![
            greet,
            load_csv,
            get_by_grade,
            get_all_data,
            add_record,
            export_csv,
            get_attendance_matrix,
            update_attendance
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
