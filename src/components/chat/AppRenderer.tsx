'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  buildIframeSrcWithSession,
  getListenerExpectedOrigin,
  getPostMessageTargetForToolInvoke,
  IFRAME_LOAD_TIMEOUT_MS,
  iframeSandboxAttribute,
  isInternalAppIframe,
  isValidToolInvocationId,
} from '@/lib/iframe-bridge';
import { InvocationBuffer } from '@/lib/invocation-buffer';
import { createPostMessageListener, type createToolInvokeMessage, type PostMessageHandler } from '@/lib/postmessage';

type AppRendererProps = {
  appSlug: string;
  iframeUrl: string;
  sessionId: string;
  token: string;
  /** Optional override; default relays UUID `invocationId` to `/api/tool-invocation-result`. */
  onToolResult?: (invocationId: string, result: unknown) => void;
  onAppComplete: (summary: string, data: Record<string, unknown>) => void;
  onAppError: (message: string, recoverable: boolean) => void;
  onClose: () => void;
};

export function AppRenderer({
  appSlug,
  iframeUrl,
  sessionId,
  token,
  onToolResult: onToolResultProp,
  onAppComplete,
  onAppError,
  onClose,
}: AppRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bufferRef = useRef<InvocationBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isInternalApp = isInternalAppIframe(iframeUrl);

  const sendToIframe = useCallback(
    (msg: ReturnType<typeof createToolInvokeMessage>) => {
      if (iframeRef.current?.contentWindow) {
        const target = getPostMessageTargetForToolInvoke(iframeUrl, window.location.origin);
        iframeRef.current.contentWindow.postMessage(JSON.stringify(msg), target);
      }
    },
    [iframeUrl]
  );

  const relayToolResult = useCallback(
    (invocationId: string, result: unknown) => {
      if (!isValidToolInvocationId(invocationId)) {
        return;
      }
      void fetch('/api/tool-invocation-result', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invocationId, result }),
      }).catch(() => {
        console.error('[AppRenderer] Failed to relay tool result to server');
      });
    },
    [token]
  );

  useEffect(() => {
    const onToolResult = onToolResultProp ?? relayToolResult;

    const handlers: PostMessageHandler = {
      onToolResult,
      onAppComplete: (summary, data) => {
        onAppComplete(summary, data);
      },
      onAppStateUpdate: () => {},
      onAppError: (message, recoverable) => {
        onAppError(message, recoverable);
        if (!recoverable) setError(message);
      },
      onHeartbeat: () => {},
    };

    const expectedOrigin = getListenerExpectedOrigin(isInternalApp, window.location.origin);
    const listener = createPostMessageListener(expectedOrigin, handlers, !isInternalApp, sessionId);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;

      let data: Record<string, unknown>;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data.method === 'iframe_ready') {
        setLoading(false);
        bufferRef.current?.markReady();
        return;
      }

      listener(event);
    };

    window.addEventListener('message', handleMessage);

    bufferRef.current = new InvocationBuffer(
      (msg) => sendToIframe(msg as ReturnType<typeof createToolInvokeMessage>),
      () => {
        setError('App failed to load. Click Retry.');
        setLoading(false);
      },
      IFRAME_LOAD_TIMEOUT_MS
    );

    return () => {
      window.removeEventListener('message', handleMessage);
      bufferRef.current?.destroy();
    };
  }, [onToolResultProp, relayToolResult, onAppComplete, onAppError, sendToIframe, isInternalApp, sessionId]);

  if (error) {
    return <ErrorMessage message={error} onRetry={onClose} />;
  }

  const windowOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const iframeSrc = buildIframeSrcWithSession(iframeUrl, sessionId, windowOrigin);

  return (
    <div className="relative my-2 overflow-hidden rounded-lg border border-gray-200 transition-all duration-300">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <LoadingSpinner size="lg" label={`Loading ${appSlug}...`} />
        </div>
      )}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-500">{appSlug}</span>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
          Close
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        sandbox={iframeSandboxAttribute(isInternalApp)}
        referrerPolicy="no-referrer"
        loading="eager"
        title={`${appSlug} app`}
        className="w-full border-none"
        style={{ minHeight: appSlug === 'chess' ? '620px' : '400px' }}
      />
    </div>
  );
}
