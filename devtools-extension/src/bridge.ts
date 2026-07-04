import type { AgentEvent, PanelCommand } from '@cairn/devtools';

export const SOURCE_PAGE = 'cairn-devtools-page';
export const SOURCE_PANEL = 'cairn-devtools-panel';

export interface PageMessage { source: typeof SOURCE_PAGE; event: AgentEvent }
export interface PanelMessage { source: typeof SOURCE_PANEL; command: PanelCommand }
