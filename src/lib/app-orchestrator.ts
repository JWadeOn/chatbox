/**
 * App lifecycle orchestrator — client-side coordination of embedded app sessions.
 *
 * Moved from being mixed into transport/rendering hooks into a dedicated module.
 * Presentation components render state; this module interprets lifecycle events.
 *
 * Responsibilities:
 *   - Manage active app session state
 *   - Handle app_render events from SSE stream
 *   - Handle app_complete / app_error from iframe postMessage
 *   - Enforce single-active-app rule on the client side
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type { AppEmbedState, StreamEventAppRender } from '@/types/chat';

export type AppLifecycleEvent =
  | { type: 'app_rendered'; session: AppEmbedState }
  | { type: 'app_completed'; sessionId: string; summary: string }
  | { type: 'app_errored'; sessionId: string; message: string; recoverable: boolean }
  | { type: 'app_closed' };

export type AppLifecycleListener = (event: AppLifecycleEvent) => void;

export function useAppOrchestrator() {
  const [appEmbed, setAppEmbed] = useState<AppEmbedState | null>(null);
  const listenersRef = useRef<AppLifecycleListener[]>([]);

  const emit = useCallback((event: AppLifecycleEvent) => {
    for (const listener of listenersRef.current) {
      listener(event);
    }
  }, []);

  /** Handle an app_render event from the SSE stream. Enforces single-active-app. */
  const handleAppRender = useCallback(
    (event: StreamEventAppRender) => {
      // Single-active-app: previous session is implicitly terminated
      const session: AppEmbedState = {
        appSlug: event.appSlug,
        iframeUrl: event.iframeUrl,
        sessionId: event.sessionId,
        iframeToolRelay: {
          invocationId: event.invocationId,
          toolName: event.toolName,
          toolArgs: event.toolArgs,
          toolResult: event.toolResult,
        },
      };
      setAppEmbed(session);
      emit({ type: 'app_rendered', session });
    },
    [emit]
  );

  /** Handle app_complete signal from iframe postMessage. */
  const handleAppComplete = useCallback(
    (summary: string, _data: Record<string, unknown>) => {
      if (!appEmbed) return;
      emit({ type: 'app_completed', sessionId: appEmbed.sessionId, summary });
      setAppEmbed(null);
    },
    [appEmbed, emit]
  );

  /** Handle app_error signal from iframe postMessage. */
  const handleAppError = useCallback(
    (message: string, recoverable: boolean) => {
      if (!appEmbed) return;
      emit({ type: 'app_errored', sessionId: appEmbed.sessionId, message, recoverable });
      if (!recoverable) {
        setAppEmbed(null);
      }
    },
    [appEmbed, emit]
  );

  /** User explicitly closes the app. */
  const closeApp = useCallback(() => {
    setAppEmbed(null);
    emit({ type: 'app_closed' });
  }, [emit]);

  /** Reset state (e.g., on conversation switch). */
  const reset = useCallback(() => {
    setAppEmbed(null);
  }, []);

  /** Subscribe to lifecycle events. Returns unsubscribe function. */
  const onLifecycleEvent = useCallback((listener: AppLifecycleListener) => {
    listenersRef.current.push(listener);
    return () => {
      listenersRef.current = listenersRef.current.filter((l) => l !== listener);
    };
  }, []);

  return {
    appEmbed,
    handleAppRender,
    handleAppComplete,
    handleAppError,
    closeApp,
    reset,
    onLifecycleEvent,
  };
}
