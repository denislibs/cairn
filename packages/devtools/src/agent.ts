import type { Instance } from '@cairn/runtime';
import { setRuntimeDevHooks, activateStyleOverrides, deactivateStyleOverrides, setStyleProp, toggleStyleProp, removeStyleProp } from '@cairn/runtime';
import { setReactiveDevHooks, devWriteSignal } from '@cairn/reactivity';
import { instanceById } from './ids';
import { parseStyleValue, isEditableProp } from './parse-style';
import type { AgentEvent, PanelCommand, DevtoolsHook, SnapshotNode, CommitMeta } from './protocol';
import { DEVTOOLS_VERSION } from './protocol';
import { serialize } from './serialize';
import { diffSnapshots } from './diff';
import { CommitLog } from './commit-log';
import { WhyFrameTracker } from './why-frame';
import { SignalRegistry } from './signal-registry';
import { signalId } from './signal-id';
import { coerceSignalValue } from './signal-value';
import { findNode } from './find';
import { Highlighter } from './highlight';
import { PickController } from './pick';

export interface DevtoolsOptions {
  /** Canvas element for on-page highlight + pick. Optional (headless/tests omit it). */
  canvas?: HTMLCanvasElement;
}

interface AgentState {
  subscribers: Set<(e: AgentEvent) => void>;
  log: CommitLog;
  why: WhyFrameTracker;
  registry: SignalRegistry;
  last: SnapshotNode | null;
  lastRoot: Instance | null;
  lastMeta: CommitMeta | null;
  viewport: { w: number; h: number };
  frame: number;
  highlighter: Highlighter | null;
  pick: PickController | null;
}

let state: AgentState | null = null;

export function installDevtools(opts: DevtoolsOptions = {}): void {
  if (state) return; // idempotent

  const why = new WhyFrameTracker();
  const s: AgentState = {
    subscribers: new Set(),
    log: new CommitLog(),
    why,
    registry: new SignalRegistry(),
    last: null,
    lastRoot: null,
    lastMeta: null,
    viewport: { w: 0, h: 0 },
    frame: 0,
    highlighter: opts.canvas ? new Highlighter(opts.canvas) : null,
    pick: null,
  };
  state = s;

  setReactiveDevHooks({
    onSignalCreate: (n) => { signalId(n as object); s.registry.note(n as any); },
    onSignalWrite: (n) => why.noteWrite(n as object),
    onComputationRun: (n) => why.noteEffectRun(n as object),
  });
  activateStyleOverrides();

  if (opts.canvas) {
    s.pick = new PickController(opts.canvas, () => s.viewport, {
      onHover: (id) => highlight(id),
      onSelect: (id) => emit({ type: 'selection', id }),
    });
  }

  setRuntimeDevHooks({
    onCommit: (root, viewport, durationMs) => {
      s.viewport = viewport;
      s.lastRoot = root;
      // Lazy: build snapshots only when someone is watching.
      if (s.subscribers.size === 0) { why.take(); return; }
      const snapshot = serialize(root);
      const changed = diffSnapshots(s.last, snapshot);
      const counts = why.take();
      s.frame++;
      s.log.push({ frame: s.frame, changedIds: changed.map((c) => c.id), ...counts, durationMs });
      s.last = snapshot;
      if (s.pick) s.pick.update(snapshot);
      s.lastMeta = { frame: s.frame, ...counts, durationMs };
      emit({ type: 'commit', snapshot, changed, meta: s.lastMeta });
      emitSignals();
    },
  });

  const hook: DevtoolsHook = {
    version: DEVTOOLS_VERSION,
    subscribe(cb) {
      s.subscribers.add(cb);
      cb({ type: 'hello', version: DEVTOOLS_VERSION });
      return () => s.subscribers.delete(cb);
    },
    send: handleCommand,
    getSnapshot: () => s.last ?? (s.lastRoot ? serialize(s.lastRoot) : null),
  };
  (globalThis as { __CAIRN_DEVTOOLS_HOOK__?: DevtoolsHook }).__CAIRN_DEVTOOLS_HOOK__ = hook;
}

export function uninstallDevtools(): void {
  if (!state) return;
  setReactiveDevHooks(null);
  setRuntimeDevHooks(null);
  deactivateStyleOverrides();
  if (state.pick) state.pick.stop();
  if (state.highlighter) state.highlighter.dispose();
  delete (globalThis as { __CAIRN_DEVTOOLS_HOOK__?: DevtoolsHook }).__CAIRN_DEVTOOLS_HOOK__;
  state = null;
}

function emit(e: AgentEvent): void {
  if (!state) return;
  for (const cb of state.subscribers) cb(e);
}

function emitSignals(): void {
  if (!state || state.subscribers.size === 0) return;
  emit({ type: 'signals', list: state.registry.list() });
}

function highlight(id: number | null): void {
  if (!state || !state.highlighter) return;
  if (id == null || !state.last) { state.highlighter.hide(); return; }
  const node = findNode(state.last, id);
  if (node) state.highlighter.show(node.rect, state.viewport);
  else state.highlighter.hide();
}

function handleCommand(cmd: PanelCommand): void {
  if (!state) return;
  switch (cmd.type) {
    case 'inspect-start': state.pick?.start(); break;
    case 'inspect-stop': state.pick?.stop(); break;
    case 'highlight': highlight(cmd.id); break;
    case 'select': highlight(cmd.id); emit({ type: 'selection', id: cmd.id }); break;
    case 'get-snapshot': {
      const snapshot = state.last ?? (state.lastRoot ? serialize(state.lastRoot) : null);
      if (snapshot) {
        state.last = snapshot;
        state.pick?.update(snapshot);
        emit({ type: 'commit', snapshot, changed: [], meta: state.lastMeta ?? { frame: state.frame, signalWrites: 0, effectRuns: 0, signals: [], durationMs: 0 } });
      }
      break;
    }
    case 'set-style': {
      const inst = instanceById(cmd.id);
      if (inst) { const r = parseStyleValue(cmd.prop, cmd.value); if (r.ok) setStyleProp(inst, cmd.prop, r.value); }
      break;
    }
    case 'toggle-style': {
      const inst = instanceById(cmd.id);
      if (inst && isEditableProp(cmd.prop)) toggleStyleProp(inst, cmd.prop, cmd.enabled);
      break;
    }
    case 'remove-style': {
      const inst = instanceById(cmd.id);
      if (inst && isEditableProp(cmd.prop)) removeStyleProp(inst, cmd.prop);
      break;
    }
    case 'get-signals': emitSignals(); break;
    case 'set-signal': {
      const node = state.registry.resolve(cmd.id);
      if (node) { const r = coerceSignalValue(node.value, cmd.value); if (r.ok) devWriteSignal(node as any, r.value); }
      break;
    }
  }
}
