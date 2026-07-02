import { createContext, useContext } from '@cairn/reactivity';
import type { Host } from '@cairn/host';

// The active Host, provided by mount() so primitives can reach services
// (e.g. textInput, renderer.measureText) without prop-drilling.
export const hostContext = createContext<Host | null>(null);

export function useHost(): Host {
  const host = useContext(hostContext);
  if (!host) {
    throw new Error('[cairn] useHost() must be called within a mounted component tree.');
  }
  return host;
}
