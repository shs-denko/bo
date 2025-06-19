import { createSignal, For } from 'solid-js';
import { readTextFile } from '@tauri-apps/api/fs';
import { invoke } from '@tauri-apps/api/tauri';

interface Attendance {
  name: string;
  date: string;
  grade: string;
}

export default function App() {
  const [grade, setGrade] = createSignal<string>('');
  const [records, setRecords] = createSignal<Attendance[]>([]);

  const loadFile = async (path: string) => {
    const contents = await readTextFile(path);
    await invoke('load_csv', { csv: contents });
    const all: Attendance[] = await invoke('list_attendance', { grade: grade() || null });
    setRecords(all);
  };

  const handleGradeChange = async (g: string) => {
    setGrade(g);
    const all: Attendance[] = await invoke('list_attendance', { grade: g || null });
    setRecords(all);
  };

  return (
    <main>
      <h1>Attendance Book</h1>
      <input type="file" onChange={e => {
        const files = e.currentTarget.files;
        if (files && files[0]) {
          loadFile(files[0].path);
        }
      }} />
      <div>
        <label>Grade: </label>
        <input value={grade()} onInput={e => handleGradeChange(e.currentTarget.value)} />
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Date</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          <For each={records()}>{r => (
            <tr>
              <td>{r.name}</td>
              <td>{r.date}</td>
              <td>{r.grade}</td>
            </tr>
          )}</For>
        </tbody>
      </table>
    </main>
  );
}
