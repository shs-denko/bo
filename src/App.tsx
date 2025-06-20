import { createSignal, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
// Use the dialog plugin directly via `invoke` so no JS dependency is required

import { readTextFile } from "@tauri-apps/api/fs";
import "./App.css";

interface AttendanceRecord {
  name: string;
  date: string;
  grade: number;
}

async function dialogOpen(options: unknown) {
  // call the dialog plugin command via the Tauri core invoke API
  return invoke<string | null>("plugin:dialog|open", { options });
}

function App() {
  const [grade, setGrade] = createSignal("");
  const [gradeData, setGradeData] = createSignal<AttendanceRecord[]>([]);
  const [searchName, setSearchName] = createSignal("");
  const [dates, setDates] = createSignal<string[]>([]);

  async function loadCsv() {
    const selected = await dialogOpen({ filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (!selected || Array.isArray(selected)) return;
    const content = await readTextFile(selected as string);
    await invoke("load_csv", { content });
    await fetchByGrade();
  }

  async function fetchByGrade() {
    if (!grade()) return;
    const data = await invoke<AttendanceRecord[]>("get_by_grade", { grade: Number(grade()) });
    setGradeData(data);
  }

  async function fetchDates() {
    if (!searchName()) return;
    const d = await invoke<string[]>("get_dates_by_name", { name: searchName() });
    setDates(d);
  }

  return (
    <main class="container">
      <h1>出席簿</h1>
      <button onClick={loadCsv}>CSV を読み込む</button>

      <div>
        <label>学年でフィルタ: </label>
        <input value={grade()} onInput={(e) => setGrade(e.currentTarget.value)} />
        <button onClick={fetchByGrade}>検索</button>
      </div>

      <ul>
        <For each={gradeData()}>{(r) => <li>{`${r.name} - ${r.date} - ${r.grade}`}</li>}</For>
      </ul>

      <div>
        <label>名前で検索: </label>
        <input value={searchName()} onInput={(e) => setSearchName(e.currentTarget.value)} />
        <button onClick={fetchDates}>検索</button>
      </div>

      <ul>
        <For each={dates()}>{(d) => <li>{d}</li>}</For>
      </ul>
    </main>
  );
}

export default App;
