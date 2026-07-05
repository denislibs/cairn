// Relays messages between content-script ports (keyed by tabId) and panel ports.
interface PanelPort { port: chrome.runtime.Port; tabId: number }

const contentPorts = new Map<number, chrome.runtime.Port>();
const panelPorts: PanelPort[] = [];

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'cairn-devtools') {
    const tabId = port.sender?.tab?.id;
    if (tabId == null) return;
    contentPorts.set(tabId, port);
    port.onMessage.addListener((event) => {
      for (const p of panelPorts) if (p.tabId === tabId) p.port.postMessage(event);
    });
    port.onDisconnect.addListener(() => contentPorts.delete(tabId));
  } else if (port.name === 'cairn-panel') {
    const rec: PanelPort = { port, tabId: -1 };
    panelPorts.push(rec);
    port.onMessage.addListener((msg: { tabId?: number; command?: unknown }) => {
      if (typeof msg.tabId === 'number') { rec.tabId = msg.tabId; return; }
      if (msg.command != null) contentPorts.get(rec.tabId)?.postMessage(msg.command);
    });
    port.onDisconnect.addListener(() => {
      const i = panelPorts.indexOf(rec); if (i >= 0) panelPorts.splice(i, 1);
    });
  }
});
