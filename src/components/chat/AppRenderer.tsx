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
        const resolvedUrl = iframeUrl.startsWith('/') ? `${window.location.origin}${iframeUrl}` : iframeUrl;
        iframeRef.current.contentWindow.postMessage(JSON.stringify(msg), new URL(resolvedUrl).origin);
      }
    },
    [iframeUrl]
  );

  useEffect(() => {
    const resolvedUrl = iframeUrl.startsWith('/') ? `${window.location.origin}${iframeUrl}` : iframeUrl;
    const origin = new URL(resolvedUrl).origin;

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

    const listener = createPostMessageListener(origin, handlers);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;

      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
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
  }, [iframeUrl, onToolResult, onAppComplete, onAppError, sendToIframe]);

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
        src={`${iframeUrl.startsWith('/') ? `${typeof window !== 'undefined' ? window.location.origin : ''}${iframeUrl}` : iframeUrl}?sessionId=${sessionId}`}
        /* All apps use the same restricted sandbox — allow-same-origin is
           deliberately omitted per the security model in CLAUDE.md. */
        sandbox="allow-scripts allow-forms allow-popups"
        referrerPolicy="no-referrer"
        loading="lazy"
        title={`${appSlug} app`}
        className="w-full border-none"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
