'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { InvocationBuffer } from '@/lib/invocation-buffer';
import { createPostMessageListener, type createToolInvokeMessage, type PostMessageHandler } from '@/lib/postmessage';

type AppRendererProps = {
  appSlug: string;
  iframeUrl: string;
  sessionId: string;
  onToolResult: (invocationId: string, result: unknown) => void;
  onAppComplete: (summary: string, data: Record<string, unknown>) => void;
  onAppError: (message: string, recoverable: boolean) => void;
  onClose: () => void;
};

export function AppRenderer({
  appSlug,
  iframeUrl,
  sessionId,
  onToolResult,
  onAppComplete,
  onAppError,
  onClose,
}: AppRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bufferRef = useRef<InvocationBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sendToIframe = useCallback(
    (
      msg: Parameters<
        typeof createToolInvokeMessage extends (...a: infer P) => infer R ? (...a: P) => R : never
      >[0] extends string
        ? ReturnType<typeof createToolInvokeMessage>
        : never
    ) => {
      if (iframeRef.current?.contentWindow) {
        // Use '*' as target origin — works for both internal (same-origin) and external (null-origin) sandboxed iframes.
        iframeRef.current.contentWindow.postMessage(JSON.stringify(msg), '*');
      }
    },
    []
  );

  // Internal apps served from /apps/* run on the platform's own origin and need allow-same-origin
  // to load their JS/CSS bundles (Next.js SSR pages). External third-party apps must NOT get it.
  const isInternalApp = iframeUrl.startsWith('/');

  useEffect(() => {
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

    // Internal apps report the platform's origin; external apps (null-origin sandbox) report "null".
    const expectedOrigin = isInternalApp ? window.location.origin : 'null';
    const listener = createPostMessageListener(expectedOrigin, handlers, !isInternalApp);

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
      30000
    );

    return () => {
      window.removeEventListener('message', handleMessage);
      bufferRef.current?.destroy();
    };
  }, [onToolResult, onAppComplete, onAppError, sendToIframe, isInternalApp]);

  if (error) {
    return <ErrorMessage message={error} onRetry={onClose} />;
  }

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
        src={`${iframeUrl.startsWith('/') ? `${typeof window !== 'undefined' ? window.location.origin : ''}${iframeUrl}` : iframeUrl}${iframeUrl.includes('?') ? '&' : '?'}sessionId=${sessionId}`}
        sandbox={
          isInternalApp
            ? 'allow-scripts allow-forms allow-popups allow-same-origin'
            : 'allow-scripts allow-forms allow-popups'
        }
        referrerPolicy="no-referrer"
        loading="eager"
        title={`${appSlug} app`}
        className="w-full border-none"
        style={{ minHeight: appSlug === 'chess' ? '620px' : '400px' }}
      />
    </div>
  );
}
