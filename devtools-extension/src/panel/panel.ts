import type { AgentEvent, PanelCommand, SnapshotNode, CommitMeta, SignalInfo } from '@cairn/devtools';

const $ = (id: string) => document.getElementById(id)!;
const treeEl = $('tree'), stylesPane = $('stylesPane'), computedPane = $('computedPane');
const sigList = $('sigList'), sparkEl = $('spark');

let snapshot: SnapshotNode | null = null;
let selected: number | null = null;
let changedIds = new Set<number>();
const openState = new Map<number, boolean>();   // id -> expanded (default true)
const commitLog: CommitMeta[] = [];
let signals: SignalInfo[] = [];
let recording = false;
const recorded: CommitMeta[] = [];

const port = chrome.runtime.connect({ name: 'cairn-panel' });
port.postMessage({ tabId: chrome.devtools.inspectedWindow.tabId });
port.onMessage.addListener((e: AgentEvent) => handleEvent(e));
function send(command: PanelCommand): void { port.postMessage({ command }); }

function handleEvent(e: AgentEvent): void {
  if (e.type === 'hello') { send({ type: 'get-snapshot' }); send({ type: 'get-signals' }); return; }
  if (e.type === 'commit') {
    snapshot = e.snapshot;
    changedIds = new Set(e.changed.map((c) => c.id));
    commitLog.push(e.meta); if (commitLog.length > 60) commitLog.shift();
    if (recording) recorded.push(e.meta);
    if (selected == null) selected = snapshot.id;
    renderTree(); renderStyles(); renderComputed(); renderSpark();
  } else if (e.type === 'signals') {
    signals = e.list;
    renderSignals();
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
const recBtn = document.getElementById('recBtn');
if (recBtn) recBtn.onclick = () => {
  recording = !recording;
  recBtn.classList.toggle('recording', recording);
  recBtn.textContent = recording ? '● Stop' : '● Record';
  if (recording) recorded.length = 0;   // start a fresh capture
  renderPerf();
};
const reloadBtn = document.getElementById('reloadBtn');
if (reloadBtn) reloadBtn.onclick = () => renderPerf();

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
  const sigN = document.getElementById('sigN');
  if (sigN) sigN.textContent = `(${signals.length})`;
  sigList.replaceChildren();
  if (signals.length === 0) {
    const e = document.createElement('div'); e.className = 'sig'; e.style.color = 'var(--ink-faint)';
    e.textContent = 'No signals yet — interact with the app.'; sigList.appendChild(e); return;
  }
  for (const s of signals) {
    const row = document.createElement('div'); row.className = 'sig';
    const dot = document.createElement('span'); dot.className = 'dot';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = s.name ?? `#${s.id}`;
    const eq = document.createElement('span'); eq.className = 'eq'; eq.textContent = '=';
    const vv = document.createElement('span'); vv.className = 'vv'; vv.textContent = s.type === 'string' ? `"${s.value}"` : s.value;
    if (s.type !== 'other') {
      vv.contentEditable = 'true';
      vv.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); (vv as HTMLElement).blur(); } };
      vv.onblur = () => send({ type: 'set-signal', id: s.id, value: vv.textContent || '' });
    }
    const drives = document.createElement('span'); drives.className = 'drives';
    drives.textContent = `${s.observers} eff`;
    row.append(dot, nm, eq, vv, drives);
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
  const windowLog = recording || recorded.length ? recorded : commitLog;
  const frames = windowLog.map((m) => m.durationMs);
  const avg = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
  const worst = windowLog.reduce<CommitMeta | null>((a, m) => (!a || m.durationMs > a.durationMs ? m : a), null);
  const worstMs = worst ? worst.durationMs : 0;
  const jank = frames.filter((d) => d > budget).length;
  const totalEff = windowLog.reduce((a, m) => a + m.effectRuns, 0);

  const stats = $('perfStats'); stats.replaceChildren();
  stats.append(
    statEl(avg.toFixed(1), 'ms', 'avg commit', avg > budget ? 'warn' : 'good'),
    statEl(worstMs.toFixed(1), 'ms', 'slowest frame', worstMs > budget ? 'bad' : 'good'),
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
  $('perfRange').textContent = recording ? `recording… ${frames.length} frames`
    : recorded.length ? `recorded ${frames.length} frames`
    : `last ${frames.length} commits`;

  renderPhaseFlame(worst);
}

function renderPhaseFlame(worst: CommitMeta | null): void {
  const flame = $('flame'); flame.replaceChildren();
  const scale = $('flameScale'); scale.replaceChildren();
  if (!worst || worst.durationMs <= 0) {
    const note = document.createElement('div'); note.className = 'tip';
    note.textContent = worst ? 'Slowest frame took ~0ms — nothing to profile.' : 'No frames yet — interact with the app (or Record).';
    flame.appendChild(note);
    return;
  }
  const total = worst.durationMs;
  const segs: { label: string; kind: string; ms: number }[] = [
    { label: 'layout', kind: 'layout', ms: worst.phases.layout },
    { label: 'a11y', kind: 'signal', ms: worst.phases.a11y },
    { label: 'paint', kind: 'paint', ms: worst.phases.paint },
  ];
  const track = document.createElement('div'); track.className = 'track';
  const tname = document.createElement('div'); tname.className = 'tname'; tname.textContent = `frame #${worst.frame}`;
  const lane = document.createElement('div'); lane.className = 'lane';
  // .lane is position:relative; .span is position:absolute — override to inline-block so segments flow side-by-side
  lane.style.display = 'flex';
  for (const s of segs) {
    if (s.ms <= 0) continue;
    const span = document.createElement('div'); span.className = `span ${s.kind}`;
    span.style.position = 'relative';
    span.style.display = 'inline-block';
    span.style.height = '100%';
    span.style.top = 'unset';
    span.style.bottom = 'unset';
    span.style.width = `${(s.ms / total) * 100}%`;
    span.title = `${s.label} · ${s.ms.toFixed(1)}ms`;
    span.textContent = s.ms / total > 0.12 ? s.label : '';
    lane.appendChild(span);
  }
  track.append(tname, lane);
  flame.appendChild(track);
  const mk = (t: string) => { const el = document.createElement('span'); el.textContent = t; return el; };
  scale.append(mk('0ms'), mk(`${(total / 2).toFixed(1)}ms`), mk(`${total.toFixed(1)}ms`));

  const tip = document.createElement('div'); tip.className = 'tip';
  tip.textContent = 'Per-effect flame + span→node arrives in a later cycle (needs effect→node attribution).';
  flame.appendChild(tip);
}
