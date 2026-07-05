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

const EDITABLE = new Set(['backgroundColor','color','font','opacity','borderRadius','gap','padding']);
const isColor = (v: string) => /^#([0-9a-f]{3,8})$/i.test(v.trim()) || /^(rgb|hsl)/i.test(v.trim());
const fmt = (v: unknown): string =>
  v !== null && typeof v === 'object' ? Object.values(v as Record<string, unknown>).join(' ') : String(v);

function declRow(prop: string, v: unknown, editable: boolean, nodeId: number): HTMLElement {
  const row = document.createElement('div'); row.className = 'decl';
  if (editable) {
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'chk'; chk.checked = true;
    chk.onchange = () => send({ type: 'toggle-style', id: nodeId, prop, enabled: chk.checked });
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
    val.onblur = () => send({ type: 'set-style', id: nodeId, prop, value: val.textContent || '' });
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
  for (const [pr, v] of Object.entries(node.style ?? {})) rule.appendChild(declRow(pr, v, editable, node.id));
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

function renderSignals(): void {
  const seen = new Map<number, { id: number; name?: string; count: number }>();
  for (const m of commitLog) for (const s of m.signals) {
    const e = seen.get(s.id) ?? { id: s.id, name: s.name, count: 0 };
    e.count++; if (s.name) e.name = s.name; seen.set(s.id, e);
  }
  const arr = [...seen.values()].sort((a, b) => b.count - a.count);
  $('sigN').textContent = `(${arr.length})`;
  sigList.replaceChildren();
  if (arr.length === 0) {
    const e = document.createElement('div'); e.className = 'sig'; e.style.color = 'var(--ink-faint)';
    e.textContent = 'No signal writes captured yet — interact with the app.'; sigList.appendChild(e); return;
  }
  for (const s of arr) {
    const row = document.createElement('div'); row.className = 'sig';
    const dot = document.createElement('span'); dot.className = 'dot';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = s.name ?? `#${s.id}`;
    const drives = document.createElement('span'); drives.className = 'drives';
    drives.textContent = `${s.count} commit${s.count !== 1 ? 's' : ''}`;
    row.append(dot, nm, drives);
    sigList.appendChild(row);
  }
}

function renderSpark(): void {
  const visible = commitLog.slice(-16);
  const max = Math.max(1, ...visible.map((m) => m.signalWrites + m.effectRuns));
  sparkEl.replaceChildren();
  for (const m of visible) {
    const total = m.signalWrites + m.effectRuns;
    const bar = document.createElement('div'); bar.className = 'bar' + (total === 0 ? ' empty' : '');
    if (total > 0) {
      const e = document.createElement('span'); e.className = 'e'; e.style.height = `${Math.round(m.effectRuns / max * 40)}px`;
      const s = document.createElement('span'); s.className = 's'; s.style.height = `${Math.round(m.signalWrites / max * 40)}px`;
      bar.append(e, s);
    }
    sparkEl.appendChild(bar);
  }
}

function statEl(v: string, sub: string, k: string, cls: string): HTMLElement {
  const s = document.createElement('div'); s.className = 'stat';
  const val = document.createElement('div'); val.className = 'v' + (cls ? ' ' + cls : ''); val.textContent = v;
  if (sub) { const sm = document.createElement('small'); sm.textContent = sub; val.appendChild(sm); }
  const key = document.createElement('div'); key.className = 'k'; key.textContent = k;
  s.append(val, key); return s;
}
function renderPerf(): void {
  const budget = 16.7;
  const frames = commitLog.map((m) => m.durationMs);
  const avg = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
  const worst = frames.length ? Math.max(...frames) : 0;
  const jank = frames.filter((d) => d > budget).length;
  const totalEff = commitLog.reduce((a, m) => a + m.effectRuns, 0);

  const stats = $('perfStats'); stats.replaceChildren();
  stats.append(
    statEl(avg.toFixed(1), 'ms', 'avg commit', avg > budget ? 'warn' : 'good'),
    statEl(worst.toFixed(1), 'ms', 'slowest frame', worst > budget ? 'bad' : 'good'),
    statEl(String(jank), '', 'frames over budget', jank ? 'warn' : 'good'),
    statEl(String(totalEff), '', 'effects run', ''),
  );

  const maxMs = Math.max(budget * 1.4, ...frames, 1);
  const fps = $('fps'); fps.replaceChildren();
  for (const d of frames.slice(-60)) {
    const bar = document.createElement('div');
    bar.className = 'frame' + (d > budget ? ' jank' : d > budget * 0.6 ? ' slow' : '');
    bar.style.height = `${Math.max(4, d / maxMs * 60)}px`; bar.title = `${d.toFixed(1)}ms`;
    fps.appendChild(bar);
  }
  $('perfRange').textContent = `last ${frames.length} commits`;

  const flame = $('flame'); flame.replaceChildren();
  const note = document.createElement('div'); note.className = 'tip';
  note.textContent = 'Per-effect flame chart arrives in a later cycle (needs effect→node attribution).';
  flame.appendChild(note);
  $('flameScale').replaceChildren();
}
