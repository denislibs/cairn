import { useHost } from '@cairn/runtime';

export function useAnnounce(): (message: string, assertive?: boolean) => void {
  const host = useHost();
  return (message: string, assertive?: boolean) => {
    host.a11y?.announce(message, assertive);
  };
}
