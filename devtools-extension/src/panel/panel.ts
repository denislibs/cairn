import type { AgentEvent, PanelCommand, SnapshotNode, CommitMeta } from '@cairn/devtools';

const $ = (id: string) => document.getElementById(id)!;
const treeEl = $('tree'), stylesPane = $('stylesPane'), computedPane = $('computedPane');
const sigList = $('sigList'), sparkEl = $('spark');

let snapshot: SnapshotNode | null = null;
let selected: number | null = null;
let changedIds = new Set<number>();
const openState = new Map<number, boolean>();   // id -> expanded (default true)
const commitLog: CommitMeta[] = [];

const port = chrome.runtime.connect({ name: 'cairn-panel' });
port.postMessage({ tabId: chrome.devtools.inspectedWindow.tabId });
port.onMessage.addListener((e: AgentEvent) => handleEvent(e));
function send(command: PanelCommand): void { port.postMessage({ command }); }

function handleEvent(e: AgentEvent): void {
  if (e.type === 'hello') { send({ type: 'get-snapshot' }); return; }
  if (e.type === 'commit') {
    snapshot = e.snapshot;
    changedIds = new Set(e.changed.map((c) => c.id));
    commitLog.push(e.meta); if (commitLog.length > 60) commitLog.shift();
    if (selected == null) selected = snapshot.id;
    renderTree(); renderStyles(); renderComputed(); renderSignals(); renderSpark();
  } else if (e.type === 'selection') {
    selected = e.id; renderTree(); renderStyles(); renderComputed();
  }
}

function findNode(n: SnapshotNode | null, id: number): SnapshotNode | null {
  if (!n) return null; if (n.id === id) return n;
  for (const c of n.children) { const f = findNode(c, id); if (f) return f; } return null;
}
function isOpen(id: number): boolean { return openState.get(id) ?? true; }

document.querySelectorAll('.subtab').forEach((t) => ((t as HTMLElement).onclick = () => {
  document.querySelectorAll('.subtab').forEach((x) => x.classList.remove('on'));
  document.querySelectorAll('.tabpane').forEach((x) => x.classList.remove('on'));
  t.classList.add('on');
  document.querySelector(`.tabpane[data-pane="${(t as HTMLElement).dataset.tab}"]`)!.classList.add('on');
}));
document.querySelectorAll('.maintab[data-panel]').forEach((t) => ((t as HTMLElement).onclick = () => {
  document.querySelectorAll('.maintab').forEach((x) => x.classList.remove('on'));
  t.classList.add('on');
  const target = (t as HTMLElement).dataset.panel;
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('on', (p as HTMLElement).dataset.panel === target));
  if (target === 'perf') renderPerf();
}));
($('inspectBtn') as HTMLElement).onclick = (ev) => {
  const b = ev.currentTarget as HTMLElement; b.classList.toggle('on');
  send({ type: b.classList.contains('on') ? 'inspect-start' : 'inspect-stop' });
};

function renderTree(): void {
  treeEl.replaceChildren();
  if (snapshot) walkTree(snapshot, 0);
}
function walkTree(node: SnapshotNode, depth: number): void {
  const parent = node.children.length > 0;
  const row = document.createElement('div');
  row.className = 'node' + (node.id === selected ? ' sel' : '') + (changedIds.has(node.id) ? ' affected' : '');
  const ind = document.createElement('span'); ind.className = 'ind'; ind.textContent = ' '.repeat(depth * 3);
  const caret = document.createElement('span');
  caret.className = 'caret' + (parent ? '' : ' leaf'); caret.textContent = parent ? (isOpen(node.id) ? '▾' : '▸') : '▸';
  if (parent) caret.onclick = (e) => { e.stopPropagation(); openState.set(node.id, !isOpen(node.id)); renderTree(); };
  const lt = document.createElement('span'); lt.className = 'punct'; lt.textContent = '<';
  const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = node.name;
  const gt = document.createElement('span'); gt.className = 'punct'; gt.textContent = '>';
  const dims = document.createElement('span'); dims.className = 'dims'; dims.textContent = `${Math.round(node.rect.w)}×${Math.round(node.rect.h)}`;
  row.append(ind, caret, lt, tag, gt, dims);
  row.onclick = () => { selected = node.id; send({ type: 'select', id: node.id }); renderTree(); renderStyles(); renderComputed(); };
  row.onmouseenter = () => send({ type: 'highlight', id: node.id });
  row.onmouseleave = () => send({ type: 'highlight', id: null });
  treeEl.appendChild(row);
  if (parent && isOpen(node.id)) for (const c of node.children) walkTree(c, depth + 1);
}

const EDITABLE = new Set(['backgroundColor','color','border','font','opacity','borderRadius','gap','width','height','padding']);
const isColor = (v: string) => /^#([0-9a-f]{3,8})$/i.test(v.trim()) || /^(rgb|hsl)/i.test(v.trim());
const fmt = (v: unknown): string =>
  typeof v === 'object' && v ? JSON.stringify(v).replace(/[{}"]/g, '').replace(/,/g, ' ').replace(/:/g, ' ') : String(v);

function declRow(prop: string, v: unknown, editable: boolean): HTMLElement {
  const row = document.createElement('div'); row.className = 'decl';
  if (editable) {
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'chk'; chk.checked = true;
    chk.onchange = () => send({ type: 'toggle-style', id: selected!, prop, enabled: chk.checked });
    row.appendChild(chk);
  }
  const p = document.createElement('span'); p.className = 'prop'; p.textContent = prop;
  const colon = document.createElement('span'); colon.className = 'colon'; colon.textContent = ': ';
  row.append(p, colon);
  const vs = fmt(v);
  if (isColor(vs)) { const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = vs; row.appendChild(sw); }
  const val = document.createElement('span'); val.className = 'value' + (/^-?\d/.test(vs) ? ' num' : ''); val.textContent = vs;
  if (editable && EDITABLE.has(prop)) {
    val.contentEditable = 'true';
    val.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); (val as HTMLElement).blur(); } };
    val.onblur = () => send({ type: 'set-style', id: selected!, prop, value: val.textContent || '' });
  }
  const semi = document.createElement('span'); semi.className = 'semi'; semi.textContent = ';';
  row.append(val, semi);
  return row;
}

function styleRule(node: SnapshotNode, editable: boolean): HTMLElement {
  const rule = document.createElement('div'); rule.className = 'rule';
  const sel = document.createElement('span'); sel.className = editable ? 'sel' : 'from';
  sel.textContent = editable ? node.name : `computed for ${node.name}`;
  const open = document.createElement('span'); open.className = 'brace'; open.textContent = ' {';
  rule.append(sel, open);
  for (const [pr, v] of Object.entries(node.style ?? {})) rule.appendChild(declRow(pr, v, editable));
  if (editable) {
    const add = document.createElement('div'); add.className = 'addrow'; add.textContent = '+ add property';
    add.onclick = beginAdd; rule.appendChild(add);
  }
  const close = document.createElement('span'); close.className = 'brace'; close.textContent = '}';
  rule.appendChild(close);
  return rule;
}

function renderStyles(): void {
  stylesPane.replaceChildren();
  const node = selected != null ? findNode(snapshot, selected) : null;
  if (!node) { stylesPane.textContent = 'Select a node'; return; }
  stylesPane.appendChild(styleRule(node, true));
}
function renderComputed(): void {
  computedPane.replaceChildren();
  const node = selected != null ? findNode(snapshot, selected) : null;
  if (!node) { computedPane.textContent = 'Select a node'; return; }
  computedPane.appendChild(styleRule(node, false));
}
function beginAdd(): void {
  const name = prompt('property (e.g. backgroundColor)'); if (!name) return;
  const value = prompt(`value for ${name}`); if (value == null) return;
  send({ type: 'set-style', id: selected!, prop: name.trim(), value });
}

function renderSignals(): void {}
function renderSpark(): void {}
function renderPerf(): void {}
