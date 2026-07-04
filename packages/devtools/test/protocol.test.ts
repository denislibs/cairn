import { describe, it, expect } from 'vitest';
import { DEVTOOLS_VERSION, type AgentEvent, type PanelCommand } from '../src/protocol';

describe('protocol', () => {
  it('AgentEvent and PanelCommand are JSON-serializable', () => {
    const evt: AgentEvent = { type: 'selection', id: 3 };
    const cmd: PanelCommand = { type: 'highlight', id: null };
    expect(JSON.parse(JSON.stringify(evt))).toEqual(evt);
    expect(JSON.parse(JSON.stringify(cmd))).toEqual(cmd);
    expect(typeof DEVTOOLS_VERSION).toBe('string');
  });
});
