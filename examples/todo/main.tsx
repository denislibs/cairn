import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount, For, Show } from '@cairn/runtime';
import { Box, Column, Row, Text, Input } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

const [todos, setTodos] = createSignal<Todo[]>([]);
const [draft, setDraft] = createSignal('');
let nextId = 1;

function addTodo(): void {
  const text = draft().trim();
  if (!text) return;
  setTodos([...todos(), { id: nextId++, text, done: false }]);
  setDraft('');
}

function toggle(id: number): void {
  setTodos(todos().map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
}

function remove(id: number): void {
  setTodos(todos().filter((t) => t.id !== id));
}

const activeCount = (): number => todos().filter((t) => !t.done).length;

// Keyed <For> reuses a row instance across data changes, so the row reads its todo
// REACTIVELY by id (not the captured value). `done` shows via a reactive text prefix
// (Text content is reactive; style color is not).
function TodoRow(id: number) {
  const todo = () => todos().find((t) => t.id === id);
  return (
    <Row style={{ gap: 10, align: 'center' }}>
      <Box
        style={{ width: 300, backgroundColor: '#1e1e20', borderRadius: 10, padding: 12, hover: { backgroundColor: '#26262a' } }}
        onClick={() => toggle(id)}
      >
        <Text style={{ font: '16px sans-serif', color: '#e5e7eb' }}>
          {() => {
            const t = todo();
            return t ? (t.done ? '✓ ' : '') + t.text : '';
          }}
        </Text>
      </Box>
      <Box
        style={{ width: 44, height: 44, backgroundColor: '#2a1416', borderRadius: 10, hover: { backgroundColor: '#3a191c' } }}
        onClick={() => remove(id)}
      >
        <Column style={{ justify: 'center', align: 'center' }}>
          <Row style={{ justify: 'center', align: 'center' }}>
            <Text style={{ font: '18px sans-serif', color: '#f87171' }}>✕</Text>
          </Row>
        </Column>
      </Box>
    </Row>
  );
}

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center' }}>
      <Box style={{ width: 460, padding: 28, backgroundColor: '#1b1b1d', borderRadius: 24 }}>
        <Column mainAxisSize="min" style={{ gap: 16, align: 'center' }}>
          <Text style={{ font: 'bold 26px sans-serif', color: '#ffffff' }}>Задачи</Text>
          <Input
            value={draft}
            onInput={setDraft}
            onSubmit={addTodo}
            placeholder="Новая задача — Enter"
            style={{
              width: 404,
              backgroundColor: '#0f0f10',
              color: '#f3f4f6',
              borderRadius: 10,
              padding: 12,
              font: '16px sans-serif',
              focus: { backgroundColor: '#141416' },
            }}
          />
          <Show
            when={() => todos().length > 0}
            fallback={() => (
              <Text style={{ font: '15px sans-serif', color: '#6b7280' }}>Пока пусто — добавь первую</Text>
            )}
          >
            {() => (
              <For each={() => todos()} key={(t) => t.id} gap={8}>
                {(item) => TodoRow(item.id)}
              </For>
            )}
          </Show>
          <Text style={{ font: '14px sans-serif', color: '#9ca3af' }}>{() => `Осталось: ${activeCount()}`}</Text>
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
