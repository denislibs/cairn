import { SOURCE_PAGE, SOURCE_PANEL, type PanelMessage } from './bridge';
import type { DevtoolsHook } from '@cairn/devtools';

declare global {
  interface Window { __CAIRN_DEVTOOLS_HOOK__?: DevtoolsHook }
}

function connect(hook: DevtoolsHook): void {
  hook.subscribe((event) => {
    window.postMessage({ source: SOURCE_PAGE, event }, '*');
  });
  window.addEventListener('message', (e) => {
    const data = e.data as PanelMessage | undefined;
    if (data && data.source === SOURCE_PANEL) hook.send(data.command);
  });
}

const existing = window.__CAIRN_DEVTOOLS_HOOK__;
if (existing) {
  connect(existing);
} else {
  // Agent may install after the page script runs; poll briefly.
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const hook = window.__CAIRN_DEVTOOLS_HOOK__;
    if (hook) { clearInterval(timer); connect(hook); }
    else if (tries > 40) clearInterval(timer); // ~10s
  }, 250);
}
