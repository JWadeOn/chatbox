import { OAuthService } from '../services/oauth.service';

const oauthService = new OAuthService();

// Mock track data for MVP (no real Spotify API calls)
const MOCK_TRACKS_BY_MOOD: Record<string, Array<{ title: string; artist: string }>> = {
  relaxed: [
    { title: 'Weightless', artist: 'Marconi Union' },
    { title: 'Sunset Lover', artist: 'Petit Biscuit' },
    { title: 'Intro', artist: 'The xx' },
    { title: 'Gymnop\u00e9die No.1', artist: 'Erik Satie' },
    { title: 'Clair de Lune', artist: 'Debussy' },
    { title: 'River Flows in You', artist: 'Yiruma' },
    { title: 'Breathe Me', artist: 'Sia' },
    { title: 'Holocene', artist: 'Bon Iver' },
    { title: 'Re: Stacks', artist: 'Bon Iver' },
    { title: 'Skinny Love', artist: 'Bon Iver' },
  ],
  energetic: [
    { title: 'Blinding Lights', artist: 'The Weeknd' },
    { title: 'Levitating', artist: 'Dua Lipa' },
    { title: 'Uptown Funk', artist: 'Bruno Mars' },
    { title: 'Shake It Off', artist: 'Taylor Swift' },
    { title: 'Happy', artist: 'Pharrell Williams' },
    { title: "Can't Stop the Feeling", artist: 'Justin Timberlake' },
    { title: 'Dance Monkey', artist: 'Tones and I' },
    { title: 'Dynamite', artist: 'BTS' },
    { title: 'Physical', artist: 'Dua Lipa' },
    { title: "Don't Start Now", artist: 'Dua Lipa' },
  ],
  focused: [
    { title: 'Experience', artist: 'Ludovico Einaudi' },
    { title: 'Nuvole Bianche', artist: 'Ludovico Einaudi' },
    { title: 'Time', artist: 'Hans Zimmer' },
    { title: 'Cornfield Chase', artist: 'Hans Zimmer' },
    { title: 'Arrival of the Birds', artist: 'The Cinematic Orchestra' },
    { title: 'Divenire', artist: 'Ludovico Einaudi' },
    { title: 'On the Nature of Daylight', artist: 'Max Richter' },
    { title: 'The Departure', artist: 'Max Richter' },
    { title: 'Written on the Sky', artist: 'Max Richter' },
    { title: 'Dream', artist: 'Max Richter' },
  ],
};

const DEFAULT_TRACKS: Array<{ title: string; artist: string }> = [
  { title: 'Bohemian Rhapsody', artist: 'Queen' },
  { title: 'Imagine', artist: 'John Lennon' },
  { title: 'Hotel California', artist: 'Eagles' },
  { title: 'Stairway to Heaven', artist: 'Led Zeppelin' },
  { title: 'Smells Like Teen Spirit', artist: 'Nirvana' },
  { title: 'Hey Jude', artist: 'The Beatles' },
  { title: 'Let It Be', artist: 'The Beatles' },
  { title: 'Yesterday', artist: 'The Beatles' },
  { title: 'Come Together', artist: 'The Beatles' },
  { title: 'Here Comes the Sun', artist: 'The Beatles' },
];

function generateMockTrackId(): string {
  return `track_${Math.random().toString(36).slice(2, 10)}`;
}

function getMockTracks(mood: string, count: number): Array<{ id: string; title: string; artist: string }> {
  const pool = MOCK_TRACKS_BY_MOOD[mood.toLowerCase()] ?? DEFAULT_TRACKS;
  const tracks: Array<{ id: string; title: string; artist: string }> = [];
  for (let i = 0; i < count; i++) {
    const track = pool[i % pool.length];
    tracks.push({
      id: generateMockTrackId(),
      title: track.title,
      artist: track.artist,
    });
  }
  return tracks;
}

export class SpotifyToolHandler {
  // biome-ignore lint/suspicious/noExplicitAny: tool params are dynamic
  async handleToolInvoke(toolName: string, params: Record<string, any>, userId: string): Promise<any> {
    switch (toolName) {
      case 'get_auth_status':
        return this.getAuthStatus(userId, params.conversationId);

      case 'create_playlist':
        return this.createPlaylist(userId, params);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  private async getAuthStatus(
    userId: string,
    conversationId?: string
  ): Promise<{ authenticated: boolean; auth_url?: string }> {
    const status = await oauthService.getTokenStatus(userId, 'spotify');

    if (status.authenticated) {
      return { authenticated: true };
    }

    const { url } = oauthService.generateAuthUrl('spotify', userId, conversationId ?? '');
    return { authenticated: false, auth_url: url };
  }

  // biome-ignore lint/suspicious/noExplicitAny: tool params are dynamic
  private async createPlaylist(userId: string, params: Record<string, any>) {
    // Check authentication first
    const status = await oauthService.getTokenStatus(userId, 'spotify');
    if (!status.authenticated) {
      return { error: 'Spotify auth required. Please authenticate first.' };
    }

    // Validate required params
    if (!params.name) {
      return { error: 'Missing required parameter: name' };
    }
    if (!params.mood) {
      return { error: 'Missing required parameter: mood' };
    }

    const trackCount = params.track_count ?? 10;
    const tracks = getMockTracks(params.mood, trackCount);
    const playlistId = `playlist_${Math.random().toString(36).slice(2, 10)}`;

    return {
      playlist_id: playlistId,
      playlist_url: `https://open.spotify.com/playlist/${playlistId}`,
      tracks,
    };
  }
}
