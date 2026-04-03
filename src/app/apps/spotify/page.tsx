'use client';

/**
 * Spotify app UI — rendered inside a sandboxed iframe.
 *
 * Demonstrates the OAuth-backed app pattern:
 *   1. Checks auth status via tool invocation from parent
 *   2. If not authenticated, shows an auth prompt with redirect link
 *   3. On create_playlist tool invoke, displays the generated playlist
 *   4. Signals app_complete when playlist is created
 *
 * Follows the same iframe lifecycle protocol as the Chess app:
 *   - Signals iframe_ready on mount
 *   - Handles tool_invoke messages via postMessage
 *   - Sends app_state_update and app_complete signals
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type Track = {
  id: string;
  title: string;
  artist: string;
};

type Playlist = {
  playlist_id: string;
  playlist_url: string;
  tracks: Track[];
  name?: string;
  mood?: string;
};

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

export default function SpotifyApp() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [status, setStatus] = useState('Connecting to Spotify...');
  const readyAcknowledged = useRef(false);

  const sendToParent = useCallback((msg: Record<string, unknown>) => {
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(msg), '*');
    }
  }, []);

  // Handle postMessage from parent (tool invocations)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (data.method === 'tool_invoke') {
        const params = data.params as { tool: string; arguments: Record<string, unknown> };
        const id = data.id as number;

        if (params.tool === 'get_auth_status') {
          // Auth status response comes back as a tool result from the server
          // The parent will send us the result — but we also handle it inline
          sendToParent({ jsonrpc: '2.0', result: { received: true }, id });
        } else if (params.tool === 'create_playlist') {
          // This is handled by the server — we'll get the result via a separate message
          sendToParent({ jsonrpc: '2.0', result: { received: true }, id });
        }
      }

      // Handle auth status result
      if (data.method === 'auth_status') {
        const params = data.params as { authenticated: boolean; auth_url?: string };
        if (params.authenticated) {
          setAuthState('authenticated');
          setStatus('Connected to Spotify. Waiting for playlist request...');
        } else {
          setAuthState('unauthenticated');
          setAuthUrl(params.auth_url ?? null);
          setStatus('Spotify authorization required');
        }
      }

      // Handle playlist created result
      if (data.method === 'playlist_created') {
        const params = data.params as Playlist & { name?: string; mood?: string };
        setPlaylist(params);
        setStatus(`Playlist "${params.name || 'My Playlist'}" created!`);

        sendToParent({
          jsonrpc: '2.0',
          method: 'app_complete',
          params: {
            summary: `Created Spotify playlist "${params.name || 'My Playlist'}" with ${params.tracks?.length || 0} tracks (mood: ${params.mood || 'mixed'}).`,
            data: {
              playlist_id: params.playlist_id,
              playlist_url: params.playlist_url,
              track_count: params.tracks?.length || 0,
            },
          },
        });
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToParent]);

  // Signal iframe_ready — retry until acknowledged (same pattern as Chess)
  useEffect(() => {
    const signal = () => {
      if (!readyAcknowledged.current) {
        sendToParent({ jsonrpc: '2.0', method: 'iframe_ready', params: {} });
      }
    };
    signal();
    const interval = setInterval(signal, 500);
    const timeout = setTimeout(() => clearInterval(interval), 15000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [sendToParent]);

  // Default: after 2 seconds of 'checking', assume authenticated (mock flow)
  useEffect(() => {
    if (authState === 'checking') {
      const timer = setTimeout(() => {
        setAuthState('authenticated');
        setStatus('Connected to Spotify. Waiting for playlist request...');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [authState]);

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        background: '#121212',
        color: '#fff',
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#1DB954',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
          }}
        >
          ♫
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Spotify</div>
          <div style={{ fontSize: '12px', color: '#b3b3b3' }}>{status}</div>
        </div>
      </div>

      {/* Auth required state */}
      {authState === 'unauthenticated' && (
        <div
          style={{
            background: '#282828',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Connect Your Spotify Account</h2>
          <p style={{ fontSize: '14px', color: '#b3b3b3', marginBottom: '24px' }}>
            To create playlists, you need to authorize ChatBridge to access your Spotify account.
          </p>
          {authUrl ? (
            <a
              href={authUrl}
              target="_top"
              style={{
                display: 'inline-block',
                background: '#1DB954',
                color: '#fff',
                padding: '12px 32px',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Connect with Spotify
            </a>
          ) : (
            <p style={{ fontSize: '13px', color: '#b3b3b3' }}>
              Ask the assistant to help you connect your Spotify account.
            </p>
          )}
        </div>
      )}

      {/* Checking auth state */}
      {authState === 'checking' && (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid #282828',
              borderTopColor: '#1DB954',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ fontSize: '14px', color: '#b3b3b3' }}>Checking Spotify connection...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Authenticated — waiting for playlist or showing playlist */}
      {authState === 'authenticated' && !playlist && (
        <div
          style={{
            background: '#282828',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Ready to Create a Playlist</h2>
          <p style={{ fontSize: '14px', color: '#b3b3b3' }}>
            Tell the assistant what kind of playlist you want. Try something like:
          </p>
          <div
            style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}
          >
            {[
              '"Make me a relaxed study playlist"',
              '"Create an energetic workout mix"',
              '"I need focus music for homework"',
            ].map((suggestion) => (
              <div
                key={suggestion}
                style={{
                  background: '#333',
                  padding: '8px 16px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  color: '#b3b3b3',
                }}
              >
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playlist display */}
      {playlist && (
        <div>
          <div
            style={{
              background: 'linear-gradient(135deg, #1DB954 0%, #191414 100%)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#b3b3b3' }}>
              Playlist
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 4px' }}>{playlist.name || 'My Playlist'}</h2>
            <div style={{ fontSize: '13px', color: '#b3b3b3' }}>
              {playlist.tracks.length} tracks · {playlist.mood || 'mixed'} mood
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {playlist.tracks.map((track, idx) => (
              <div
                key={track.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: idx % 2 === 0 ? '#181818' : 'transparent',
                }}
              >
                <span style={{ width: '24px', textAlign: 'right', fontSize: '13px', color: '#b3b3b3' }}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {track.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#b3b3b3' }}>{track.artist}</div>
                </div>
              </div>
            ))}
          </div>

          {playlist.playlist_url && (
            <a
              href={playlist.playlist_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                marginTop: '16px',
                textAlign: 'center',
                background: '#1DB954',
                color: '#fff',
                padding: '12px',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Open in Spotify
            </a>
          )}
        </div>
      )}
    </div>
  );
}
