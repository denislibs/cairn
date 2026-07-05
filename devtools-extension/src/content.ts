import { SOURCE_PAGE, SOURCE_PANEL, type PageMessage } from './bridge';

// Inject the page-world script.
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
(document.head || document.documentElement).appendChild(script);
script.onload = () => script.remove();

const port = chrome.runtime.connect({ name: 'cairn-devtools' });

// page -> panel (via background)
window.addEventListener('message', (e) => {
  const data = e.data as PageMessage | undefined;
  if (data && data.source === SOURCE_PAGE) port.postMessage(data.event);
});

// panel -> page (command forwarded from background as raw command object)
port.onMessage.addListener((command) => {
  window.postMessage({ source: SOURCE_PANEL, command }, '*');
});
