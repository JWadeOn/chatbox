'use client';

import { useEffect, useState } from 'react';
import { useIframeSessionPostMessage } from '@/lib/iframe-postmessage';

type StudySession = {
  id: string;
  title: string;
  start: string;
  end: string;
  link?: string;
};

export default function StudyPlannerApp() {
  const sendToParent = useIframeSessionPostMessage();
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [status, setStatus] = useState('Waiting for planner data...');

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (data.method !== 'tool_invoke') {
        return;
      }

      const params = data.params as { tool: string; arguments: Record<string, unknown>; invocationId?: string };
      const id = data.id as number;
      const invocationId = params.invocationId;
      const args = params.arguments ?? {};

      if (args.needsAuth) {
        setNeedsAuth(true);
        setAuthUrl(typeof args.authUrl === 'string' ? args.authUrl : null);
        setStatus(typeof args.message === 'string' ? args.message : 'Connect Google Calendar to continue.');
      } else {
        setNeedsAuth(false);
        setAuthUrl(null);
        if (Array.isArray(args.sessions)) {
          setSessions(args.sessions as StudySession[]);
        } else if (args.session && typeof args.session === 'object') {
          const created = args.session as StudySession;
          setSessions((prev) => [created, ...prev]);
        }
        if (typeof args.status === 'string') {
          setStatus(`Planner status: ${args.status}`);
        } else {
          setStatus('Planner synced.');
        }
      }

      sendToParent({
        jsonrpc: '2.0',
        result: { invocationId, acknowledged: true },
        id,
      });
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToParent]);

  useEffect(() => {
    const signal = () => sendToParent({ jsonrpc: '2.0', method: 'iframe_ready', params: {} });
    signal();
    const interval = setInterval(signal, 500);
    const timeout = setTimeout(() => clearInterval(interval), 15000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [sendToParent]);

  return (
    <div style={{ minHeight: '100vh', padding: '16px', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>Study Planner</div>
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{status}</div>

        {needsAuth ? (
          <div
            style={{
              marginTop: '14px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '12px',
            }}
          >
            <div style={{ fontSize: '13px', color: '#1e3a8a', marginBottom: '8px' }}>
              Google Calendar connection required.
            </div>
            {authUrl ? (
              <a
                href={authUrl}
                target="_top"
                rel="noreferrer"
                style={{
                  display: 'inline-block',
                  fontSize: '13px',
                  background: '#1d4ed8',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  textDecoration: 'none',
                }}
              >
                Connect Google Calendar
              </a>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: '14px' }}>
            {sessions.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#64748b' }}>No upcoming sessions yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {sessions.map((session) => (
                  <div
                    key={session.id || `${session.title}-${session.start}`}
                    style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{session.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {new Date(session.start).toLocaleString()} - {new Date(session.end).toLocaleTimeString()}
                    </div>
                    {session.link ? (
                      <a
                        href={session.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '12px', color: '#2563eb', marginTop: '4px', display: 'inline-block' }}
                      >
                        Open in Google Calendar
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
