import { config } from '@/config/env';

interface StreamingSource {
  name: string;
  baseUrl: string;
  priority: number;
  quality?: string;
}

const streamingSources: StreamingSource[] = [
  { name: 'VidLink.pro',        baseUrl: config.streaming.vidlinkUrl,  priority: 1, quality: '1080P' },
  { name: 'VidKing.net',        baseUrl: config.streaming.vidkingUrl,  priority: 2, quality: '1080P' },
  { name: 'Videasy.net',        baseUrl: config.streaming.videasyUrl,  priority: 3, quality: '1080P' },
  { name: '2Embed',             baseUrl: config.streaming.twoEmbedUrl, priority: 4, quality: '1080P' },
  { name: 'Peachify.pro',       baseUrl: config.streaming.peachifyUrl, priority: 5, quality: '1080P' },
  { name: 'Embed-API Server',   baseUrl: config.streaming.embedApiUrl, priority: 6, quality: '720P'  },
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
      if (!url || url.trim() === '') return '';
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') parsed.protocol = 'https:';
      if (!parsed.hostname) return '';
      return parsed.toString();
    } catch {
      return '';
    }
  }

  private getStreamingUrl(source: StreamingSource, options: StreamingOptions): string {
    try {
      if (!source.baseUrl || !options.tmdbId) return '';

      const season  = options.type === 'tv' ? Number(options.season)  || 1 : undefined;
      const episode = options.type === 'tv' ? Number(options.episode) || 1 : undefined;
      const base    = source.baseUrl;
      const host    = base.toLowerCase();
      const id      = options.tmdbId;
      let url = '';

      if (host.includes('vidlink.pro')) {
        url = options.type === 'tv' && season && episode
          ? `${base}/tv/${id}/${season}/${episode}`
          : options.type === 'movie' ? `${base}/movie/${id}` : '';
      } else if (host.includes('vidking.net')) {
        url = options.type === 'tv' && season && episode
          ? `${base}/embed/tv/${id}/${season}/${episode}`
          : options.type === 'movie' ? `${base}/embed/movie/${id}` : '';
      } else if (host.includes('videasy.net')) {
        url = options.type === 'tv' && season && episode
          ? `${base}/tv/${id}/${season}/${episode}`
          : options.type === 'movie' ? `${base}/movie/${id}` : '';
      } else if (host.includes('2embed')) {
        url = options.type === 'tv' && season && episode
          ? `${base}/embedtv/${id}&s=${season}&e=${episode}`
          : options.type === 'movie' ? `${base}/embed/${id}` : '';
      } else if (host.includes('peachify.pro')) {
        url = options.type === 'tv' && season && episode
          ? `${base}/embed/tv/${id}/${season}/${episode}`
          : options.type === 'movie' ? `${base}/embed/movie/${id}` : '';
      } else if (host.includes('embed-api.stream')) {
        url = options.type === 'tv' && season && episode
          ? `${base}/?id=${id}&s=${season}&e=${episode}`
          : options.type === 'movie' ? `${base}/?id=${id}` : '';
      }

      return url ? this.validateUrl(url) : '';
    } catch {
      return '';
    }
  }

  public getAllStreamingSources(options: StreamingOptions): { name: string; url: string; quality: string }[] {
    if (options.type === 'tv') {
      options.season  = Number(options.season)  || 1;
      options.episode = Number(options.episode) || 1;
    }

    return this.sources
      .map(source => {
        const url = this.getStreamingUrl(source, options);
        return url ? { name: source.name, url, quality: source.quality || 'HD' } : null;
      })
      .filter((s): s is { name: string; url: string; quality: string } => s !== null);
  }
}

export const streamingService = new StreamingService();