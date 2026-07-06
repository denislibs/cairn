export interface Rect { x: number; y: number; w: number; h: number }

export interface SnapshotNode {
  id: number;
  name: string;
  rect: Rect;                       // absolute, layout/CSS px
  size: { w: number; h: number };
  offset: { x: number; y: number }; // relative to parent
  layout: {
    flex: number;
    zIndex: number;
    margin: { top: number; right: number; bottom: number; left: number };
    left?: number; top?: number; right?: number; bottom?: number;
  };
  flags: {
    clip: boolean;
    transform: boolean;
    opacity: number;
    focusable: boolean;
    pointerEvents: 'auto' | 'none';
  };
  semantics?: { role: string; label?: string };
  style?: Record<string, unknown>;
  children: SnapshotNode[];
}

export interface ChangedNode { id: number; fields: string[] }
export interface SignalRef { id: number; name?: string }
export interface SignalInfo { id: number; name?: string; value: string; type: 'number' | 'string' | 'boolean' | 'other'; observers: number }
export interface CommitMeta {
  frame: number;
  signalWrites: number;
  effectRuns: number;
  signals: SignalRef[];
  durationMs: number;
  phases: { layout: number; a11y: number; paint: number };
}

export interface SignalGraph { effects: { label: string; nodeId: number }[]; nodeIds: number[] }

export type AgentEvent =
  | { type: 'hello'; version: string }
  | { type: 'commit'; snapshot: SnapshotNode; changed: ChangedNode[]; meta: CommitMeta }
  | { type: 'selection'; id: number }
  | { type: 'signals'; list: SignalInfo[] }
  | { type: 'signal-graph'; id: number; graph: SignalGraph };

export type PanelCommand =
  | { type: 'inspect-start' }
  | { type: 'inspect-stop' }
  | { type: 'highlight'; id: number | null }
  | { type: 'select'; id: number }
  | { type: 'get-snapshot' }
  | { type: 'set-style'; id: number; prop: string; value: string }
  | { type: 'toggle-style'; id: number; prop: string; enabled: boolean }
  | { type: 'remove-style'; id: number; prop: string }
  | { type: 'set-signal'; id: number; value: string }
  | { type: 'get-signals' }
  | { type: 'signal-graph'; id: number };

export interface DevtoolsHook {
  version: string;
  subscribe(cb: (e: AgentEvent) => void): () => void;
  send(cmd: PanelCommand): void;
  getSnapshot(): SnapshotNode | null;
}

export const DEVTOOLS_VERSION = '0.0.0';
