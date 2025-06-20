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

function App() {
  const [grade, setGrade] = createSignal("");
  const [gradeData, setGradeData] = createSignal<AttendanceRecord[]>([]);
  const [searchName, setSearchName] = createSignal("");
  const [dates, setDates] = createSignal<string[]>([]);
  const [newName, setNewName] = createSignal("");
  const [newDate, setNewDate] = createSignal("");
  const [newGrade, setNewGrade] = createSignal("");
  const [allData, setAllData] = createSignal<AttendanceRecord[]>([]);  // アプリ起動時に既存データを読み込む
  onMount(async () => {
    try {
      await loadAllData();
    } catch (error) {
      // データベースがまだ存在しない場合は無視
      console.log("初回起動: データベースが見つかりません");
    }
  });
  // 学年フィルタの自動更新
  createEffect(() => {
    const currentGrade = grade();
    if (currentGrade === "") {
      setGradeData([]);
    } else {
      const gradeNum = Number(currentGrade);
      if (!isNaN(gradeNum)) {
        const filtered = allData().filter(r => r.grade === gradeNum);
        setGradeData(filtered);
      }
    }
  });

  // 名前検索の自動更新
  createEffect(() => {
    const currentName = searchName();
    if (currentName === "") {
      setDates([]);
    } else {
      const filtered = allData().filter(r => r.name.toLowerCase().includes(currentName.toLowerCase())).map(r => r.date);
      const uniqueDates = [...new Set(filtered)].sort();
      setDates(uniqueDates);
    }
  });

  async function loadCsv() {
    const selected = await open({ filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (!selected || Array.isArray(selected)) return;
    const content = await readTextFile(selected as string);
    await invoke("load_csv", { content });
    await loadAllData();
  }  async function loadAllData() {
    try {
      const data = await invoke<AttendanceRecord[]>("get_all_data");
      setAllData(data);
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
    const csvContent = "name,date,grade\n";
    await invoke("load_csv", { content: csvContent });
    await loadAllData();
    // フォームをリセット
    setGrade("");
    setSearchName("");
  }
  async function exportCsv() {
    const filePath = await save({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      defaultPath: "attendance.csv"
    });
    
    if (!filePath) return;
    
    try {
      const csvContent = await invoke<string>("export_csv");
      await writeTextFile(filePath, csvContent);
      console.log("CSVファイルが正常にエクスポートされました");
    } catch (error) {
      console.error("エクスポートに失敗しました:", error);
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
      </header>

      <div class="content">
        <section class="card add-record-section">
          <h2 class="section-title">✏️ 新しいレコードを追加</h2>
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
            </div>
            <div class="form-group">
              <label class="label">学年</label>
              <input 
                class="input" 
                type="number" 
                placeholder="1-6"
                min="1" 
                max="6"
                value={newGrade()} 
                onInput={(e) => setNewGrade(e.currentTarget.value)} 
              />
            </div>
          </div>
          <button class="btn btn-add" onClick={addRecord}>
            ➕ レコードを追加
          </button>
        </section>

        <div class="search-sections">
          <section class="card search-section">
            <h2 class="section-title">🔍 学年で検索</h2>            <div class="search-group">
              <input 
                class="input" 
                type="number"
                placeholder="学年を入力 (1-6)"
                min="1" 
                max="6"
                value={grade()} 
                onInput={(e) => setGrade(e.currentTarget.value)}
              />
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
            </div>
          </section>

          <section class="card search-section">
            <h2 class="section-title">👤 名前で検索</h2>            <div class="search-group">
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
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default App;
