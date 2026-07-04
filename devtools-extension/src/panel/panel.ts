import type { AgentEvent, PanelCommand, SnapshotNode, ChangedNode, CommitMeta } from '@cairn/devtools';

const treeEl = document.getElementById('tree') as HTMLDivElement;
const propsEl = document.getElementById('props') as HTMLDivElement;
const logEl = document.getElementById('log') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const inspectBtn = document.getElementById('inspect') as HTMLButtonElement;

let snapshot: SnapshotNode | null = null;
let selectedId: number | null = null;
let changedIds = new Set<number>();
let inspecting = false;

const port = chrome.runtime.connect({ name: 'cairn-panel' });
port.postMessage({ tabId: chrome.devtools.inspectedWindow.tabId });
port.onMessage.addListener((event: AgentEvent) => handleEvent(event));

function send(command: PanelCommand): void { port.postMessage({ command }); }

function handleEvent(event: AgentEvent): void {
  if (event.type === 'hello') {
    statusEl.textContent = `Cairn detected (agent ${event.version})`;
    send({ type: 'get-snapshot' });
  } else if (event.type === 'commit') {
    snapshot = event.snapshot;
    changedIds = new Set(event.changed.map((c: ChangedNode) => c.id));
    renderTree();
    renderProps();
    appendCommit(event.meta);
  } else if (event.type === 'selection') {
    selectedId = event.id;
    renderTree();
    renderProps();
  }
}

function renderTree(): void {
  treeEl.replaceChildren();
  if (snapshot) renderNode(snapshot, 0);
}

function renderNode(node: SnapshotNode, depth: number): void {
  const row = document.createElement('div');
  row.className = 'row'
    + (node.id === selectedId ? ' selected' : '')
    + (changedIds.has(node.id) ? ' changed' : '');
  const dims = `${Math.round(node.rect.w)}x${Math.round(node.rect.h)}`;
  row.textContent = `${'  '.repeat(depth)}${node.name}  ${dims}`;
  row.onclick = () => { selectedId = node.id; send({ type: 'select', id: node.id }); renderTree(); renderProps(); };
  row.onmouseenter = () => send({ type: 'highlight', id: node.id });
  row.onmouseleave = () => send({ type: 'highlight', id: null });
  treeEl.appendChild(row);
  for (const child of node.children) renderNode(child, depth + 1);
}

function findNode(node: SnapshotNode | null, id: number): SnapshotNode | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children) { const f = findNode(c, id); if (f) return f; }
  return null;
}

function kv(k: string, v: string): void {
  const row = document.createElement('div');
  row.className = 'kv';
  const key = document.createElement('b');
  key.textContent = k;
  const val = document.createElement('span');
  val.textContent = v;
  row.append(key, val);
  propsEl.appendChild(row);
}

function renderProps(): void {
  propsEl.replaceChildren();
  const node = selectedId != null ? findNode(snapshot, selectedId) : null;
  if (!node) { propsEl.textContent = 'Select a node'; return; }
  kv('name', node.name);
  kv('rect', `${r(node.rect.x)}, ${r(node.rect.y)} · ${r(node.rect.w)}x${r(node.rect.h)}`);
  kv('offset', `${r(node.offset.x)}, ${r(node.offset.y)}`);
  kv('flex', String(node.layout.flex));
  kv('zIndex', String(node.layout.zIndex));
  kv('opacity', String(node.flags.opacity));
  kv('clip', String(node.flags.clip));
  kv('transform', String(node.flags.transform));
  kv('focusable', String(node.flags.focusable));
  kv('pointerEvents', node.flags.pointerEvents);
  if (node.semantics) kv('role', node.semantics.role + (node.semantics.label ? ` "${node.semantics.label}"` : ''));
}

function appendCommit(meta: CommitMeta): void {
  const line = document.createElement('div');
  line.className = 'commit';
  line.textContent = `#${meta.frame}  signals:${meta.signalWrites}  effects:${meta.effectRuns}  changed:${changedIds.size}`;
  logEl.prepend(line);
  while (logEl.childElementCount > 50) logEl.lastElementChild?.remove();
}

function r(n: number): number { return Math.round(n); }

inspectBtn.onclick = () => {
  inspecting = !inspecting;
  inspectBtn.style.background = inspecting ? '#d7e6ff' : '';
  send({ type: inspecting ? 'inspect-start' : 'inspect-stop' });
};
