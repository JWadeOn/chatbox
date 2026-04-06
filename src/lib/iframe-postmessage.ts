import { useCallback, useEffect, useRef } from 'react';

/**
 * Wraps postMessage to parent: injects `sessionId` into JSON-RPC `params` and `result` objects
 * so the platform can bind iframe traffic to the active app session.
 */
export function useIframeSessionPostMessage() {
  const iframeSessionIdRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    iframeSessionIdRef.current = new URLSearchParams(window.location.search).get('sessionId') ?? '';
  }, []);

  return useCallback((msg: Record<string, unknown>) => {
    if (typeof window === 'undefined' || window.parent === window) return;
    const sid = iframeSessionIdRef.current;
    let out = msg;
    if (msg.params && typeof msg.params === 'object' && !Array.isArray(msg.params)) {
      out = { ...msg, params: { sessionId: sid, ...(msg.params as Record<string, unknown>) } };
    } else if ('result' in msg && msg.result && typeof msg.result === 'object' && !Array.isArray(msg.result)) {
      out = {
        ...msg,
        result: { sessionId: sid, ...(msg.result as Record<string, unknown>) },
      };
    }
    window.parent.postMessage(JSON.stringify(out), '*');
  }, []);
}
