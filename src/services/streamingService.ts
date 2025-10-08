import { config } from '@/config/env';

interface StreamingSource {
  name: string;
  baseUrl: string;
  apiVersion?: string;
  priority: number;
  quality?: string;
  urlFormat?: 'standard' | 'query';  // New property to handle different URL formats
}

// Updated streaming sources with MoviesAPI servers
const streamingSources: StreamingSource[] = [
  // Primary VidSrc Server (Original)
  { name: 'VidSrc Server', baseUrl: config.streaming.vidsrcUrl, priority: 1, quality: '4K', urlFormat: 'standard' },
  
  // VidSrc XYZone Server (New)
  { name: 'VidSrc XYZone', baseUrl: config.streaming.vidsrcUrl, priority: 2, quality: '4K', urlFormat: 'query' },
  
  // MoviesAPI Servers
  { name: 'MoviesAPI Server 1', baseUrl: config.streaming.moviesApiUrl, priority: 3, quality: '4K' },
  { name: 'MoviesAPI Server 2', baseUrl: config.streaming.moviesApiUrl, priority: 4, quality: '4K' },
  
  // RGShows Servers
  { name: 'RGShows Server 1', baseUrl: config.streaming.rgshowsUrl, apiVersion: '1', priority: 5, quality: '4K' },
  { name: 'RGShows Server 2', baseUrl: config.streaming.rgshowsUrl, apiVersion: '2', priority: 6, quality: '1080P' },
  { name: 'RGShows Server 3', baseUrl: config.streaming.rgshowsUrl, apiVersion: '3', priority: 7, quality: '720P' },

  // Embed-API Server
  { name: 'Embed-API Server', baseUrl: config.streaming.embedApiUrl, priority: 8, quality: '1080P' }
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
      // Check if URL is empty or invalid
      if (!url || url.trim() === '') {
        throw new Error('Empty URL');
      }

      const parsedUrl = new URL(url);
      
      // Ensure protocol is https
      if (parsedUrl.protocol !== 'https:') {
        parsedUrl.protocol = 'https:';
      }

      // Validate URL format
      if (!parsedUrl.hostname || parsedUrl.hostname.trim() === '') {
        throw new Error('Invalid hostname');
      }

      // Log validated URL for debugging
      console.log('Validated URL:', parsedUrl.toString());

      return parsedUrl.toString();
    } catch (error) {
      console.error('Invalid URL:', error);
      return '';
    }
  }

  private getStreamingUrl(source: StreamingSource, options: StreamingOptions): string {
    try {
      // Validate input parameters
      if (!source.baseUrl || !options.tmdbId) {
        console.error('Invalid source or options:', { source, options });
        return '';
      }

      // Ensure season and episode are numbers for TV shows
      const season = options.type === 'tv' ? Number(options.season) || 1 : undefined;
      const episode = options.type === 'tv' ? Number(options.episode) || 1 : undefined;

      let url = '';
      
      // Handle MoviesAPI URLs
      if (source.baseUrl.includes('moviesapi.club')) {
        if (options.type === 'tv' && season && episode) {
          url = `${source.baseUrl}/tv/${options.tmdbId}-${season}-${episode}`;
        } else if (options.type === 'movie') {
          url = `${source.baseUrl}/movie/${options.tmdbId}`;
        }
      }
      // Handle Embed-API URLs
      else if (source.baseUrl.includes('embed-api.stream')) {
        if (options.type === 'tv' && season && episode) {
          url = `${source.baseUrl}/?id=${options.tmdbId}&s=${season}&e=${episode}`;
        } else if (options.type === 'movie') {
          url = `${source.baseUrl}/?id=${options.tmdbId}`;
        }
      }
      // Handle RGShows URLs
      else if (source.baseUrl.includes('rgshows')) {
        if (!source.apiVersion) {
          console.error('Missing API version for RGShows');
          return '';
        }
        if (options.type === 'tv' && season && episode) {
          url = `${source.baseUrl}/api/${source.apiVersion}/tv/?id=${options.tmdbId}&s=${season}&e=${episode}`;
        } else if (options.type === 'movie') {
          url = `${source.baseUrl}/api/${source.apiVersion}/movie/?id=${options.tmdbId}`;
        }
      }
      // Handle VidSrc URLs
      else if (source.baseUrl.includes('vidsrc.xyz')) {
        if (source.urlFormat === 'query') {
          // New VidSrc XYZone format using query parameters
          if (options.type === 'tv' && season && episode) {
            url = `${source.baseUrl}/embed/tv?tmdb=${options.tmdbId}&season=${season}&episode=${episode}`;
          } else if (options.type === 'movie') {
            url = `${source.baseUrl}/embed/movie?tmdb=${options.tmdbId}`;
          }
        } else {
          // Original VidSrc format using path parameters
          if (options.type === 'tv' && season && episode) {
            url = `${source.baseUrl}/embed/tv/${options.tmdbId}/${season}-${episode}`;
          } else if (options.type === 'movie') {
            url = `${source.baseUrl}/embed/movie/${options.tmdbId}`;
          }
        }
      }

      // If no URL was constructed, return empty string
      if (!url) {
        console.error('Failed to construct URL for source:', source.name);
        return '';
      }

      // Log generated URL for debugging
      console.log('Generated URL:', url);

      // Validate and normalize URL
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