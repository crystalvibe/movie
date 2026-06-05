import { config } from '@/config/env';

interface StreamingSource {
  name: string;
  baseUrl: string;
  apiVersion?: string;
  priority: number;
  quality?: string;
  urlFormat?: 'standard' | 'query';  // New property to handle different URL formats
}

// Updated streaming sources with working and unblocked servers
const streamingSources: StreamingSource[] = [
  { name: 'VidLink.pro', baseUrl: config.streaming.vidlinkUrl, priority: 1, quality: '1080P' },
  { name: 'VidKing.net', baseUrl: config.streaming.vidkingUrl, priority: 2, quality: '1080P' },
  { name: 'Videasy.net', baseUrl: config.streaming.videasyUrl, priority: 3, quality: '1080P' },
  { name: '2Embed', baseUrl: config.streaming.twoEmbedUrl, priority: 4, quality: '1080P' },
  { name: 'Peachify.pro', baseUrl: config.streaming.peachifyUrl, priority: 5, quality: '1080P' },
  { name: 'Embed-API Server', baseUrl: config.streaming.embedApiUrl, priority: 6, quality: '720P' }
];

interface StreamingOptions {
  type: 'movie' | 'tv';
  tmdbId: string;
  season?: number;
  episode?: number;
}

export class StreamingService {
  private sources: StreamingSource[] = streamingSources;

  constructor() {
    this.sources.sort((a, b) => a.priority - b.priority);
  }

  private validateUrl(url: string): string {
    try {
      if (!url || url.trim() === '') {
        throw new Error('Empty URL');
      }

      const parsedUrl = new URL(url);
      
      if (parsedUrl.protocol !== 'https:') {
        parsedUrl.protocol = 'https:';
      }

      if (!parsedUrl.hostname || parsedUrl.hostname.trim() === '') {
        throw new Error('Invalid hostname');
      }

      console.log('Validated URL:', parsedUrl.toString());
      return parsedUrl.toString();
    } catch (error) {
      console.error('Invalid URL:', error);
      return '';
    }
  }

  private getStreamingUrl(source: StreamingSource, options: StreamingOptions): string {
    try {
      if (!source.baseUrl || !options.tmdbId) {
        console.error('Invalid source or options:', { source, options });
        return '';
      }

      const season = options.type === 'tv' ? Number(options.season) || 1 : undefined;
      const episode = options.type === 'tv' ? Number(options.episode) || 1 : undefined;

      let url = '';
      const host = source.baseUrl.toLowerCase();

      // 1. VidLink.pro
      if (host.includes('vidlink.pro')) {
        if (options.type === 'tv' && season && episode) {
          url = `${source.baseUrl}/tv/${options.tmdbId}/${season}/${episode}`;
        } else if (options.type === 'movie') {
          url = `${source.baseUrl}/movie/${options.tmdbId}`;
        }
      }
      // 2. VidKing.net
      else if (host.includes('vidking.net')) {
        if (options.type === 'tv' && season && episode) {
          url = `${source.baseUrl}/embed/tv/${options.tmdbId}/${season}/${episode}`;
        } else if (options.type === 'movie') {
          url = `${source.baseUrl}/embed/movie/${options.tmdbId}`;
        }
      }
      // 3. Videasy.net
      else if (host.includes('videasy.net')) {
        if (options.type === 'tv' && season && episode) {
          url = `${source.baseUrl}/tv/${options.tmdbId}/${season}/${episode}`;
        } else if (options.type === 'movie') {
          url = `${source.baseUrl}/movie/${options.tmdbId}`;
        }
      }
      // 4. 2Embed
      else if (host.includes('2embed')) {
        if (options.type === 'tv' && season && episode) {
          url = `${source.baseUrl}/embedtv/${options.tmdbId}&s=${season}&e=${episode}`;
        } else if (options.type === 'movie') {
          url = `${source.baseUrl}/embed/${options.tmdbId}`;
        }
      }
      // 5. Peachify.pro
      else if (host.includes('peachify.pro')) {
        if (options.type === 'tv' && season && episode) {
          url = `${source.baseUrl}/embed/tv/${options.tmdbId}/${season}/${episode}`;
        } else if (options.type === 'movie') {
          url = `${source.baseUrl}/embed/movie/${options.tmdbId}`;
        }
      }
      // 6. Embed-API
      else if (host.includes('embed-api.stream')) {
        if (options.type === 'tv' && season && episode) {
          url = `${source.baseUrl}/?id=${options.tmdbId}&s=${season}&e=${episode}`;
        } else if (options.type === 'movie') {
          url = `${source.baseUrl}/?id=${options.tmdbId}`;
        }
      }

      if (!url) {
        console.error('Failed to construct URL for source:', source.name);
        return '';
      }

      console.log('Generated URL:', url);
      return this.validateUrl(url);
    } catch (error) {
      console.error('Error generating streaming URL:', error);
      return '';
    }
  }

  public getAllStreamingSources(options: StreamingOptions): { name: string; url: string; quality: string }[] {
    // Log request for debugging
    console.log('Getting all streaming sources:', options);

    // Ensure we have valid season and episode numbers for TV shows
    if (options.type === 'tv') {
      options.season = Number(options.season) || 1;
      options.episode = Number(options.episode) || 1;
    }

    return this.sources
      .map(source => {
        const url = this.getStreamingUrl(source, options);
        if (!url) {
          console.warn('Failed to get URL for source:', source.name);
          return null;
        }
        return {
          name: source.name,
          url,
          quality: source.quality || 'HD'
        };
      })
      .filter((source): source is { name: string; url: string; quality: string } => source !== null);
  }

  public getPrimaryStreamingSource(options: StreamingOptions): { name: string; url: string; quality: string } | null {
    // Log request for debugging
    console.log('Getting primary streaming source:', options);

    const primarySource = this.sources[0];
    const url = this.getStreamingUrl(primarySource, options);
    
    if (!url) {
      console.warn('Failed to get URL for primary source:', primarySource.name);
      return null;
    }

    return {
      name: primarySource.name,
      url,
      quality: primarySource.quality || 'HD'
    };
  }
}

export const streamingService = new StreamingService(); 