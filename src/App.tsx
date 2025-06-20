import { createSignal, For, onMount, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import "./App.css";

interface AttendanceRecord {
  name: string;
  date: string;
  grade: number;
}

interface AttendanceStatus {
  name: string;
  date: string;
  grade: number;
  present: boolean;
}

interface AttendanceMatrix {
  students: string[];
  dates: string[];
  attendance: AttendanceStatus[];
}

function App() {  const [grade, setGrade] = createSignal("");
  const [gradeData, setGradeData] = createSignal<AttendanceRecord[]>([]);
  const [searchName, setSearchName] = createSignal("");
  const [dates, setDates] = createSignal<string[]>([]);  const [newName, setNewName] = createSignal("");
  const [newDate, setNewDate] = createSignal("");
  const [newGrade, setNewGrade] = createSignal("");
  const [allData, setAllData] = createSignal<AttendanceRecord[]>([]);
  const [attendanceMatrix, setAttendanceMatrix] = createSignal<AttendanceMatrix | null>(null);
  const [matrixGrade, setMatrixGrade] = createSignal("");
  const [newStudentName, setNewStudentName] = createSignal("");
  const [newMatrixDate, setNewMatrixDate] = createSignal("");// アプリ起動時に既存データを読み込む
  onMount(async () => {
    try {
      await loadAllData();
    } catch (error) {
      // データベースがまだ存在しない場合は無視
      console.log("初回起動: データベースが見つかりません");
    }
  });  // 学年フィルタの自動更新
  createEffect(() => {
    const currentGrade = grade();
    console.log("Grade filter effect triggered:", currentGrade);
    if (currentGrade === "") {
      setGradeData([]);
      console.log("Grade cleared, gradeData set to empty");
    } else {
      const gradeNum = Number(currentGrade);
      console.log("Parsed grade number:", gradeNum, "isNaN:", isNaN(gradeNum));
      if (!isNaN(gradeNum)) {
        const allDataCurrent = allData();
        console.log("All data for filtering:", allDataCurrent);
        const filtered = allDataCurrent.filter(r => {
          console.log(`Comparing record grade ${r.grade} with filter ${gradeNum}:`, r.grade === gradeNum);
          return r.grade === gradeNum;
        });
        console.log("Filtered results:", filtered);
        setGradeData(filtered);
      }
    }
  });
  // 名前検索の自動更新
  createEffect(() => {
    const currentName = searchName();
    console.log("Name search effect triggered:", currentName);
    if (currentName === "") {
      setDates([]);
      console.log("Name cleared, dates set to empty");
    } else {
      const allDataCurrent = allData();
      console.log("All data for name filtering:", allDataCurrent);
      const filtered = allDataCurrent.filter(r => r.name.toLowerCase().includes(currentName.toLowerCase())).map(r => r.date);
      console.log("Filtered dates:", filtered);
      const uniqueDates = [...new Set(filtered)].sort();
      console.log("Unique dates:", uniqueDates);
      setDates(uniqueDates);
    }
  });
  // 出席管理マトリックス用のエフェクト
  createEffect(() => {
    const currentMatrixGrade = matrixGrade();
    if (currentMatrixGrade !== "") {
      loadAttendanceMatrix(Number(currentMatrixGrade));
    } else {
      setAttendanceMatrix(null);
    }
  });  async function loadAttendanceMatrix(grade: number) {
    try {
      console.log("Loading attendance matrix for grade:", grade);
      console.log("Available data in allData:", allData());
      console.log("Records with grade", grade, ":", allData().filter(r => r.grade === grade));
      
      console.log("Calling get_attendance_matrix with grade:", grade);
      const matrix = await invoke<AttendanceMatrix>("get_attendance_matrix", { grade });
      console.log("Received attendance matrix:", matrix);
      
      if (matrix && matrix.students && matrix.students.length > 0) {
        setAttendanceMatrix(matrix);
        console.log("Successfully set attendance matrix with", matrix.students.length, "students");
      } else {
        console.log("No students found in matrix, setting to null");
        setAttendanceMatrix(null);
      }
    } catch (error) {
      console.error("出席マトリックスの読み込みに失敗しました:", error);
      console.error("Error details:", JSON.stringify(error));
      setAttendanceMatrix(null);
    }
  }

  async function updateAttendance(name: string, date: string, present: boolean) {
    try {
      await invoke("update_attendance", { name, date, present });
      // マトリックスを再読み込み
      if (matrixGrade() !== "") {
        await loadAttendanceMatrix(Number(matrixGrade()));
      }
    } catch (error) {
      console.error("出席状況の更新に失敗しました:", error);
    }
  }

  async function loadCsv() {
    try {
      const selected = await open({ filters: [{ name: "CSV", extensions: ["csv"] }] });
      if (!selected || Array.isArray(selected)) return;
      
      console.log("Selected file:", selected);
      const content = await readTextFile(selected as string);
      console.log("File content loaded, length:", content.length);
      
      await invoke("load_csv", { content });
      await loadAllData();
      
      console.log("CSV loaded successfully");
      // 成功メッセージを表示（オプション）
      alert("CSVファイルが正常に読み込まれました");
    } catch (error) {
      console.error("CSV読み込みエラー:", error);
      alert(`CSVファイルの読み込みに失敗しました: ${error}`);
    }
  }  async function loadAllData() {
    try {
      console.log("Calling get_all_data...");
      const data = await invoke<AttendanceRecord[]>("get_all_data");
      console.log("Received data:", data);
      console.log("Data length:", data.length);
      setAllData(data);
      console.log("allData updated, current length:", allData().length);
    } catch (error) {
      console.error("データの読み込みに失敗しました:", error);
      setAllData([]);
    }
  }

  async function addRecord() {
    if (!newName() || !newDate() || !newGrade()) return;
    
    const record = {
      name: newName(),
      date: newDate(),
      grade: Number(newGrade())
    };
    
    try {
      await invoke("add_record", { record });
      setNewName("");
      setNewDate("");
      setNewGrade("");
      await loadAllData();
    } catch (error) {
      console.error("レコードの追加に失敗しました:", error);
    }
  }
  async function createNewCsv() {
    try {
      const csvContent = "name,date,grade\n";
      await invoke("load_csv", { content: csvContent });
      await loadAllData();
      // フォームをリセット
      setGrade("");
      setSearchName("");
      console.log("新しいCSVが作成されました");
      alert("新しいデータベースが作成されました");
    } catch (error) {
      console.error("新規作成エラー:", error);
      alert(`新規作成に失敗しました: ${error}`);
    }
  }  async function exportCsv() {
    try {
      const filePath = await save({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        defaultPath: "attendance.csv"
      });
      
      if (!filePath) return;
      
      console.log("Export path:", filePath);
      const csvContent = await invoke<string>("export_csv");
      console.log("CSV content generated, length:", csvContent.length);
      
      await writeTextFile(filePath, csvContent);
      console.log("CSVファイルが正常にエクスポートされました");
      alert("CSVファイルが正常にエクスポートされました");
    } catch (error) {
      console.error("エクスポートエラー:", error);
      alert(`エクスポートに失敗しました: ${error}`);
    }
  }

  async function addStudent() {
    if (!newStudentName() || !matrixGrade()) return;
    
    const record = {
      name: newStudentName(),
      date: new Date().toISOString().split('T')[0], // 今日の日付をデフォルト
      grade: Number(matrixGrade())
    };
    
    try {
      await invoke("add_record", { record });
      setNewStudentName("");
      await loadAllData();
      if (matrixGrade() !== "") {
        await loadAttendanceMatrix(Number(matrixGrade()));
      }
    } catch (error) {
      console.error("学生の追加に失敗しました:", error);
    }
  }
  async function addDate() {
    if (!newMatrixDate() || !matrixGrade()) return;
    
    const matrix = attendanceMatrix();
    if (!matrix) return;
    
    // 既存の学生全員に新しい日付のレコードを追加
    try {
      for (const student of matrix.students) {
        const record = {
          name: student,
          date: newMatrixDate(),
          grade: Number(matrixGrade())
        };
        await invoke("add_record", { record });
      }
      setNewMatrixDate("");
      await loadAllData();
      await loadAttendanceMatrix(Number(matrixGrade()));
    } catch (error) {
      console.error("日付の追加に失敗しました:", error);
    }
  }

  async function deleteStudent(studentName: string) {
    if (!confirm(`「${studentName}」の全てのレコードを削除しますか？`)) return;
    
    try {
      await invoke("delete_student", { name: studentName, grade: Number(matrixGrade()) });
      await loadAllData();
      if (matrixGrade() !== "") {
        await loadAttendanceMatrix(Number(matrixGrade()));
      }
    } catch (error) {
      console.error("学生の削除に失敗しました:", error);
    }
  }

  async function deleteDate(date: string) {
    if (!confirm(`「${date}」の全ての出席データを削除しますか？`)) return;
    
    try {
      await invoke("delete_date", { date, grade: Number(matrixGrade()) });
      await loadAllData();
      if (matrixGrade() !== "") {
        await loadAttendanceMatrix(Number(matrixGrade()));
      }
    } catch (error) {
      console.error("日付の削除に失敗しました:", error);
    }
  }return (
    <main class="app">
      <header class="header">
        <h1 class="title">📚 出席簿管理システム</h1>
        <div class="file-actions">
          <button class="btn btn-primary" onClick={loadCsv}>
            📂 CSV を読み込む
          </button>
          <button class="btn btn-secondary" onClick={createNewCsv}>
            ✨ 新規作成
          </button>
          <button class="btn btn-success" onClick={exportCsv}>
            💾 エクスポート
          </button>
        </div>
      </header>      <div class="content">
        {/* 出席管理マトリックス - メイン機能 */}
        <section class="card">
          <h2 class="section-title">📋 出席管理マトリックス</h2>
            <div class="search-group">
            <label class="label">学年を選択</label>
            <select 
              class="input" 
              value={matrixGrade()} 
              onChange={(e) => setMatrixGrade(e.currentTarget.value)}
            >
              <option value="">-- 学年を選択してください --</option>
              <option value="1">1年生</option>
              <option value="2">2年生</option>
              <option value="3">3年生</option>
            </select>
          </div>

          {/* 学生と日付の追加フォーム */}
          {matrixGrade() !== "" && (
            <div class="add-controls" style="display: flex; gap: 1rem; margin: 1rem 0; flex-wrap: wrap;">
              <div class="add-student" style="flex: 1; min-width: 200px;">
                <label class="label">新しい学生を追加</label>
                <div style="display: flex; gap: 0.5rem;">
                  <input 
                    class="input" 
                    placeholder="学生の名前"
                    value={newStudentName()} 
                    onInput={(e) => setNewStudentName(e.currentTarget.value)} 
                    style="flex: 1;"
                  />
                  <button class="btn btn-primary" onClick={addStudent}>
                    ➕ 学生追加
                  </button>
                </div>
              </div>
              <div class="add-date" style="flex: 1; min-width: 200px;">
                <label class="label">新しい日付を追加</label>
                <div style="display: flex; gap: 0.5rem;">
                  <input 
                    class="input" 
                    type="date"
                    value={newMatrixDate()} 
                    onInput={(e) => setNewMatrixDate(e.currentTarget.value)} 
                    style="flex: 1;"
                  />
                  <button class="btn btn-primary" onClick={addDate}>
                    ➕ 日付追加
                  </button>
                </div>              </div>
            </div>
          )}
            {/* マトリックステーブル */}
          {attendanceMatrix() && attendanceMatrix()!.students.length > 0 && (
            <div class="attendance-matrix" style="overflow-x: auto; margin-top: 1rem;">
              <table style="border-collapse: collapse; width: 100%; min-width: 600px;">
                <thead>
                  <tr>
                    <th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; position: sticky; left: 0; z-index: 10;">
                      名前
                    </th>
                    <For each={attendanceMatrix()!.dates}>
                      {(date) => (
                        <th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; min-width: 100px; position: relative;">
                          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <span>{date}</span>
                            <button 
                              class="btn" 
                              onClick={() => deleteDate(date)}
                              style="font-size: 10px; padding: 2px 6px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;"
                              title="この日付を削除"
                            >
                              🗑️
                            </button>
                          </div>
                        </th>
                      )}
                    </For>
                  </tr>
                </thead>
                <tbody>
                  <For each={attendanceMatrix()!.students}>
                    {(student) => (
                      <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; background: #f9f9f9; position: sticky; left: 0; z-index: 5; font-weight: bold;">
                          <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span>{student}</span>
                            <button 
                              class="btn" 
                              onClick={() => deleteStudent(student)}
                              style="font-size: 10px; padding: 2px 6px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 8px;"
                              title="この学生を削除"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                        <For each={attendanceMatrix()!.dates}>
                          {(date) => {
                            const attendanceRecord = attendanceMatrix()!.attendance.find(
                              a => a.name === student && a.date === date
                            );
                            return (
                              <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                                <input
                                  type="checkbox"
                                  checked={attendanceRecord?.present ?? true}
                                  onChange={(e) => updateAttendance(student, date, e.currentTarget.checked)}
                                  style="transform: scale(1.2);"
                                />
                              </td>
                            );
                          }}
                        </For>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          )}
          
          {matrixGrade() !== "" && !attendanceMatrix() && (
            <div style="color: #666; font-style: italic; padding: 20px; text-align: center;">
              該当する学年のデータが見つかりません
            </div>
          )}
        </section>

        {/* オプション機能 */}
        <details class="card" style="margin-top: 2rem;">
          <summary style="cursor: pointer; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
            <strong>🔧 その他の機能</strong>
          </summary>
          
          <div style="padding: 1rem;">
            <section class="card add-record-section">
              <h3 class="section-title">✏️ 直接レコード追加</h3>
              <div class="form-grid">
                <div class="form-group">
                  <label class="label">名前</label>
                  <input 
                    class="input" 
                    placeholder="学生の名前を入力"
                    value={newName()} 
                    onInput={(e) => setNewName(e.currentTarget.value)} 
                  />
                </div>
                <div class="form-group">
                  <label class="label">日付</label>
                  <input 
                    class="input" 
                    type="date" 
                    value={newDate()} 
                    onInput={(e) => setNewDate(e.currentTarget.value)} 
                  />
                </div>                <div class="form-group">
                  <label class="label">学年</label>
                  <select 
                    class="input" 
                    value={newGrade()} 
                    onChange={(e) => setNewGrade(e.currentTarget.value)}
                  >
                    <option value="">-- 学年を選択してください --</option>
                    <option value="1">1年生</option>
                    <option value="2">2年生</option>
                    <option value="3">3年生</option>
                  </select>
                </div>
              </div>
              <button class="btn btn-add" onClick={addRecord}>
                ➕ レコードを追加
              </button>
            </section>

            <div class="search-sections">
              <section class="card search-section">                <h3 class="section-title">🔍 学年で検索</h3>
                <div class="search-group">
                  <select 
                    class="input" 
                    value={grade()} 
                    onChange={(e) => setGrade(e.currentTarget.value)}
                  >
                    <option value="">-- 学年を選択してください --</option>
                    <option value="1">1年生</option>
                    <option value="2">2年生</option>
                    <option value="3">3年生</option>
                  </select>
                </div>
                <div class="results">
                  <For each={gradeData()}>
                    {(r) => (
                      <div class="result-item">
                        <span class="name">{r.name}</span>
                        <span class="date">{r.date}</span>
                        <span class="grade">学年: {r.grade}</span>
                      </div>
                    )}
                  </For>
                  {gradeData().length === 0 && grade() !== "" && (
                    <div style="color: #666; font-style: italic; padding: 10px;">
                      該当する学年のデータが見つかりません
                    </div>
                  )}
                </div>
              </section>

              <section class="card search-section">
                <h3 class="section-title">👤 名前で検索</h3>
                <div class="search-group">
                  <input 
                    class="input" 
                    placeholder="学生の名前を入力"
                    value={searchName()} 
                    onInput={(e) => setSearchName(e.currentTarget.value)}
                  />
                </div>
                <div class="results">
                  <For each={dates()}>
                    {(d) => (
                      <div class="result-item date-item">
                        📅 {d}
                      </div>
                    )}
                  </For>
                  {dates().length === 0 && searchName() !== "" && (
                    <div style="color: #666; font-style: italic; padding: 10px;">
                      該当する名前のデータが見つかりません
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}

export default App;
