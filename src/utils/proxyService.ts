/**
 * Centralized proxy service for handling CORS-enabled API requests
 * This file provides utilities for making API requests through various CORS proxies
 */

import { config } from '@/config/env';

// Helper to sanitize any string containing the TMDB API key or general api_key parameters
export const sanitizeLog = (message: any): any => {
  if (typeof message !== 'string') return message;

  let sanitized = message;
  const tmdbApiKey = config.tmdb.apiKey;
  if (tmdbApiKey) {
    const escapedKey = tmdbApiKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(escapedKey, 'g'), '****');
  }
  sanitized = sanitized.replace(/api_key=[a-zA-Z0-9]+/gi, 'api_key=****');
  return sanitized;
};

// Helper to sanitize arguments array (including error stack traces)
const sanitizeArgs = (args: any[]): any[] => {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return sanitizeLog(arg);
    }
    if (arg instanceof Error) {
      const sanitizedMessage = sanitizeLog(arg.message);
      const newError = new Error(sanitizedMessage);
      newError.name = arg.name;
      if (arg.stack) {
        newError.stack = sanitizeLog(arg.stack);
      }
      return newError;
    }
    return arg;
  });
};

// Safe logging wrappers to prevent API key leakage in the developer console
const log = (...args: any[]) => console.log(...sanitizeArgs(args));
const error = (...args: any[]) => console.error(...sanitizeArgs(args));
const warn = (...args: any[]) => console.warn(...sanitizeArgs(args));

// Define the options interface for fetch requests
interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Define multiple proxies with fallback options
export const PROXY_URLS = config.proxy.urls;

// Default timeout for fetch requests (ms) - increased for better reliability
export const DEFAULT_TIMEOUT = 10000;

// Cache duration in milliseconds (30 minutes)
export const CACHE_DURATION = 30 * 60 * 1000;

// Cache item interface
interface CacheItem {
  data: any;
  timestamp: number;
}

// In-memory cache for API responses
const apiCache = new Map<string, CacheItem>();

/**
 * Validates if a cached response is still valid
 */
export const isCacheValid = (cachedData?: CacheItem): boolean => {
  if (!cachedData) return false;
  return Date.now() - cachedData.timestamp < CACHE_DURATION;
};

/**
 * Correctly formats the proxy URL based on the proxy service
 * Different proxy services require different URL formats
 */
const formatProxyUrl = (proxyUrl: string, targetUrl: string): string => {
  // For TMDB API, add the base URL and API key if not present and path is relative
  if (targetUrl.startsWith('/') && !targetUrl.includes('api.themoviedb.org')) {
    const tmdbBaseUrl = config.tmdb.baseUrl;
    const tmdbApiKey = config.tmdb.apiKey;

    // Make sure we're not adding API key if already present
    if (!targetUrl.includes('api_key=')) {
      // Add api_key parameter to the URL
      targetUrl = `${tmdbBaseUrl}${targetUrl}${targetUrl.includes('?') ? '&' : '?'}api_key=${tmdbApiKey}`;
    } else {
      targetUrl = `${tmdbBaseUrl}${targetUrl}`;
    }
    log("Formatted TMDB URL:", targetUrl.replace(tmdbApiKey, '****'));
  } else if (targetUrl.includes('api.themoviedb.org') && !targetUrl.includes('api_key=')) {
    const tmdbApiKey = config.tmdb.apiKey;
    targetUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}api_key=${tmdbApiKey}`;
    log("Added TMDB API key:", targetUrl.replace(tmdbApiKey, '****'));
  }

  // ThingProxy needs direct concatenation (no encoding needed)
  if (proxyUrl === 'https://thingproxy.freeboard.io/fetch/') {
    return `${proxyUrl}${targetUrl}`;
  }

  // YaCDN proxy needs direct concatenation
  if (proxyUrl === 'https://yacdn.org/proxy/') {
    return `${proxyUrl}${targetUrl}`;
  }

  // CORS.sh needs direct concatenation
  if (proxyUrl === 'https://proxy.cors.sh/') {
    return `${proxyUrl}${targetUrl}`;
  }

  // CORS.eu.org needs direct concatenation
  if (proxyUrl === 'https://cors.eu.org/') {
    return `${proxyUrl}${targetUrl}`;
  }

  // Default for other proxies that need URL encoding
  return `${proxyUrl}${encodeURIComponent(targetUrl)}`;
};

/**
 * Handles specific error types in a more user-friendly way
 */
const handleFetchError = (error: any, proxyUrl: string): Error => {
  // Check if the error is an AbortError (timeout or manual abort)
  if (error.name === 'AbortError') {
    return new Error(`Request timeout with proxy ${proxyUrl}: The request took too long to complete`);
  }

  // Check if the error is a TypeError with "Failed to fetch" message (common CORS error)
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return new Error(`CORS error with proxy ${proxyUrl}: The request was blocked by the browser`);
  }

  // Check if there's a network error
  if (!navigator.onLine) {
    return new Error('Network error: You appear to be offline');
  }

  // Check for specific HTTP status codes
  if (error.status === 429) {
    return new Error(`Rate limit exceeded with proxy ${proxyUrl}: Too many requests`);
  }

  if (error.status === 503) {
    return new Error(`Service unavailable with proxy ${proxyUrl}: The proxy is temporarily down`);
  }

  if (error.status === 403) {
    return new Error(`Access forbidden with proxy ${proxyUrl}: The proxy blocked this request`);
  }

  // If the error already has a message from the API, pass it through
  if (error instanceof Error) {
    return error;
  }

  return new Error(`Unknown error with proxy ${proxyUrl}: ${error.message || 'No details available'}`);
};

/**
 * Fallback method using JSONP (for APIs that support it)
 * This bypasses CORS by using script tags
 * 
 * @param url The API URL to fetch
 * @param callbackParam The callback parameter name (default: 'callback')
 * @returns Promise with the JSON response
 */
export const fetchWithJSONP = (url: string, callbackParam = 'callback'): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Create a unique callback name
    const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());

    // Create script element
    const script = document.createElement('script');

    // Set timeout to clean up if request fails
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP request timed out'));
    }, DEFAULT_TIMEOUT);

    // Clean up function to remove script and global callback
    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete (window as any)[callbackName];
      clearTimeout(timeout);
    };

    // Add callback to window object
    (window as any)[callbackName] = (data: any) => {
      cleanup();
      resolve(data);
    };

    // Add callback parameter to URL
    const separator = url.includes('?') ? '&' : '?';
    const jsonpUrl = `${url}${separator}${callbackParam}=${callbackName}`;

    // Set script source and append to document
    script.src = jsonpUrl;
    document.body.appendChild(script);

    // Handle script error
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP request failed'));
    };
  });
};

/**
 * Makes an API request through multiple proxies with fallback support
 * 
 * @param url The target URL to fetch through a proxy
 * @param options Optional fetch options
 * @returns Promise with the JSON response
 */
export const fetchWithProxy = async (url: string, options: FetchOptions = {}): Promise<any> => {
  const cacheKey = url;
  const cachedData = apiCache.get(cacheKey);

  // Return cached data if valid
  if (isCacheValid(cachedData)) {
    return cachedData?.data;
  }

  // Resolve relative paths if baseUrl is absolute (production)
  let resolvedUrl = url;
  if (!url.startsWith('http')) {
    if (url.startsWith('/api/tmdb')) {
      const baseUrl = config.tmdb.baseUrl || 'https://api.themoviedb.org/3';
      resolvedUrl = url.replace('/api/tmdb', baseUrl);
    } else if (!url.startsWith('/api/')) {
      const baseUrl = config.tmdb.baseUrl || 'https://api.themoviedb.org/3';
      resolvedUrl = `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    }
  }

  // Intercept relative paths / self-hosted proxy calls (e.g. /api/tmdb)
  if (resolvedUrl.startsWith('/api/') || !resolvedUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      let targetUrl = resolvedUrl;
      if (targetUrl.startsWith('/api/tmdb') && !targetUrl.includes('api_key=')) {
        const tmdbApiKey = config.tmdb.apiKey;
        targetUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}api_key=${tmdbApiKey}`;
      }

      log(`Fetching natively through self-hosted proxy: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.headers || {}),
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=3600'
        }
      });

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
      const data = await response.json();

      apiCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (err) {
      error(`Native self-hosted proxy call failed for ${url}:`, err);
      throw err;
    }
  }

  let lastError;

  // Try each proxy in sequence until one works
  for (let i = 0; i < PROXY_URLS.length; i++) {
    // Create a new AbortController for each proxy attempt
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      log(`Timeout reached for proxy ${i + 1}: ${PROXY_URLS[i]}`);
      controller.abort();
    }, DEFAULT_TIMEOUT);

    try {
      const proxyUrl = formatProxyUrl(PROXY_URLS[i], url);
      log(`Trying proxy ${i + 1}: ${PROXY_URLS[i]} with URL: ${proxyUrl}`);

      const response = await fetch(proxyUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.headers || {}),
          'Cache-Control': 'max-age=3600', // Cache for 1 hour in browser
          'Origin': window.location.origin,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

      clearTimeout(timeoutId);
      const data = await response.json();

      // Cache the result
      apiCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      log(`Successful response from proxy ${i + 1}: ${PROXY_URLS[i]}`);
      return data;
    } catch (errorVal) {
      clearTimeout(timeoutId);
      const formattedError = handleFetchError(errorVal, PROXY_URLS[i]);
      error(`Proxy ${i + 1} (${PROXY_URLS[i]}) failed:`, formattedError.message);
      lastError = formattedError;

      // Add a small delay between proxy attempts to avoid overwhelming them
      if (i < PROXY_URLS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // Try direct call as next resort
  try {
    const directController = new AbortController();
    const directTimeoutId = setTimeout(() => {
      log('Direct API call timeout reached');
      directController.abort();
    }, DEFAULT_TIMEOUT);

    log(`Trying direct API call to: ${resolvedUrl}`);

    const response = await fetch(resolvedUrl, {
      ...options,
      signal: directController.signal,
      headers: {
        ...(options.headers || {}),
        'Content-Type': 'application/json',
        'Origin': window.location.origin,
        'Cache-Control': 'max-age=3600',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error(`Direct API request failed with status ${response.status}`);

    clearTimeout(directTimeoutId);
    const data = await response.json();

    // Cache the result
    apiCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    log('Direct API call successful');
    return data;
  } catch (errorVal) {
    const formattedError = handleFetchError(errorVal, 'direct call');
    error('Direct API call failed:', formattedError.message);

    // Try JSONP as a last resort (only works for APIs that support it)
    if (resolvedUrl.includes('api.themoviedb.org')) {
      try {
        log('Trying JSONP as last resort');
        const data = await fetchWithJSONP(resolvedUrl);

        // Cache the result
        apiCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });

        log('JSONP call successful');
        return data;
      } catch (jsonpError) {
        error('JSONP fallback failed:', jsonpError);
      }
    }

    // If all methods fail, try to return mock data for TMDB API calls
    if (url.includes('api.themoviedb.org') && url.includes('/discover/movie')) {
      log('All proxies failed, returning mock data for TMDB discover endpoint');
      return getMockTMDBResponse(url);
    }

    throw lastError || formattedError;
  }
};

/**
 * Returns mock TMDB response when all proxies fail
 * This ensures the app doesn't break completely
 */
const getMockTMDBResponse = (url: string) => {
  // Parse URL to determine what kind of response to return
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  if (pathname.includes('/discover/movie')) {
    // Return mock movie data based on language
    const language = urlObj.searchParams.get('with_original_language') || 'en';

    const mockMovies = {
      en: [
        {
          id: 550,
          title: "Fight Club",
          overview: "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.",
          poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
          backdrop_path: "/87hTDiay2N2qWyX4Dx7dLkfvh7p.jpg",
          release_date: "1999-10-15",
          vote_average: 8.4,
          vote_count: 26280,
          genre_ids: [18],
          popularity: 61.916,
          original_language: "en",
          original_title: "Fight Club",
          video: false,
          adult: false
        }
      ],
      hi: [
        {
          id: 313369,
          title: "Laal Kaptaan",
          overview: "Set in the 18th century, the film follows a Naga Sadhu (Red Saffron) bounty hunter in his quest for revenge.",
          poster_path: "/8V2m4JqR3Lg9Gx8bq2n4j5w7s9t1u3v.jpg",
          backdrop_path: "/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p.jpg",
          release_date: "2019-10-18",
          vote_average: 6.8,
          vote_count: 145,
          genre_ids: [28, 36, 18],
          popularity: 12.345,
          original_language: "hi",
          original_title: "लाल कप्तान",
          video: false,
          adult: false
        }
      ],
      ko: [
        {
          id: 496243,
          title: "Parasite",
          overview: "All unemployed, Ki-taek's family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.",
          poster_path: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
          backdrop_path: "/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
          release_date: "2019-05-30",
          vote_average: 8.5,
          vote_count: 15680,
          genre_ids: [35, 53, 18],
          popularity: 85.123,
          original_language: "ko",
          original_title: "기생충",
          video: false,
          adult: false
        }
      ]
    };

    const movies = mockMovies[language] || mockMovies.en;

    return {
      page: 1,
      results: movies,
      total_pages: 1,
      total_results: movies.length
    };
  }

  if (pathname.includes('/trending/movie/day')) {
    return {
      page: 1,
      results: [
        {
          id: 550,
          title: "Fight Club",
          overview: "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.",
          poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
          backdrop_path: "/87hTDiay2N2qWyX4Dx7dLkfvh7p.jpg",
          release_date: "1999-10-15",
          vote_average: 8.4,
          vote_count: 26280,
          genre_ids: [18],
          popularity: 61.916,
          original_language: "en",
          original_title: "Fight Club",
          video: false,
          adult: false
        }
      ],
      total_pages: 1,
      total_results: 1
    };
  }

  // Default fallback
  return {
    page: 1,
    results: [],
    total_pages: 0,
    total_results: 0
  };
};

/**
 * Fetches data from multiple proxies in parallel and returns the first successful response
 * 
 * @param url The target URL to fetch through proxies
 * @param options Optional fetch options
 * @returns Promise with the JSON response from the first successful proxy
 */
export const fetchWithParallelProxy = async (url: string, options: FetchOptions = {}): Promise<any> => {
  const cacheKey = url;
  const cachedData = apiCache.get(cacheKey);

  // Return cached data if valid
  if (isCacheValid(cachedData)) {
    return cachedData?.data;
  }

  // Resolve relative paths if baseUrl is absolute (production)
  let resolvedUrl = url;
  if (!url.startsWith('http')) {
    if (url.startsWith('/api/tmdb')) {
      const baseUrl = config.tmdb.baseUrl || 'https://api.themoviedb.org/3';
      resolvedUrl = url.replace('/api/tmdb', baseUrl);
    } else if (!url.startsWith('/api/')) {
      const baseUrl = config.tmdb.baseUrl || 'https://api.themoviedb.org/3';
      resolvedUrl = `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    }
  }

  // Intercept relative paths / self-hosted proxy calls (e.g. /api/tmdb)
  if (resolvedUrl.startsWith('/api/') || !resolvedUrl.startsWith('http')) {
    return fetchWithProxy(resolvedUrl, options);
  }

  // Set timeout for fetch requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  // Try all proxies in parallel for faster response
  const proxyPromises = PROXY_URLS.map(async (proxyUrl, index) => {
    try {
      const fullUrl = formatProxyUrl(proxyUrl, url);
      log(`Trying parallel proxy ${index + 1}: ${proxyUrl} with URL: ${fullUrl}`);

      const response = await fetch(fullUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.headers || {}),
          'Cache-Control': 'max-age=3600', // Cache for 1 hour in browser
          'Origin': window.location.origin
        }
      });

      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

      const data = await response.json();
      log(`Successful parallel response from proxy ${index + 1}: ${proxyUrl}`);
      return data;
    } catch (errorVal) {
      const formattedError = handleFetchError(errorVal, proxyUrl);
      error(`Parallel proxy ${index + 1} failed:`, formattedError.message);
      return Promise.reject(formattedError);
    }
  });

  // Use Promise.race to get the first successful response
  try {
    // Store completed promises to avoid race condition issues
    const completedPromises: boolean[] = [];

    // Create a race of promises that rejects only when all promises reject
    const data = await Promise.race(
      proxyPromises.map(async (promise) => {
        try {
          return await promise;
        } catch (errorVal) {
          // Store failed attempt
          completedPromises.push(false);
          // Only reject this promise when all have failed
          if (completedPromises.length === proxyPromises.length) {
            throw new Error('All proxies failed');
          }
          // Block this promise until one succeeds or all fail
          return new Promise((_, reject) => {
            setTimeout(() => reject('Waiting for other proxies'), 10000);
          });
        }
      })
    );

    clearTimeout(timeoutId);

    // Store in memory cache
    apiCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  } catch (errors) {
    // Try direct call as next resort
    try {
      clearTimeout(timeoutId);
      log(`Trying direct API call to: ${resolvedUrl}`);

      const response = await fetch(resolvedUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.headers || {}),
          'Content-Type': 'application/json',
          'Origin': window.location.origin,
          'Cache-Control': 'max-age=3600'
        }
      });

      if (!response.ok) throw new Error(`Direct API request failed with status ${response.status}`);

      const data = await response.json();

      // Cache the result
      apiCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      log('Direct API call successful');
      return data;
    } catch (errorVal) {
      const formattedError = handleFetchError(errorVal, 'direct call');
      error('All proxies and direct call failed:', formattedError.message);

      // Try JSONP as a last resort (only works for APIs that support it)
      if (resolvedUrl.includes('api.themoviedb.org')) {
        try {
          log('Trying JSONP as last resort');
          const data = await fetchWithJSONP(resolvedUrl);

          // Cache the result
          apiCache.set(cacheKey, {
            data,
            timestamp: Date.now()
          });

          log('JSONP call successful');
          return data;
        } catch (jsonpError) {
          error('JSONP fallback failed:', jsonpError);
        }
      }

      throw formattedError;
    }
  }
};

// Delay utility for retry logic
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches with built-in retry logic and smart error handling
 * 
 * @param url The URL to fetch
 * @param options Fetch options
 * @param maxRetries Maximum number of retries (default: 3)
 * @returns Promise with the JSON response
 */
export const fetchWithRetry = async (url: string, options: FetchOptions = {}, maxRetries = 3): Promise<any> => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      log(`Fetch attempt ${i + 1}/${maxRetries} for: ${url}`);
      const response = await fetchWithProxy(url, options);
      log(`Success on attempt ${i + 1}`);
      return response;
    } catch (errorVal) {
      error(`Attempt ${i + 1}/${maxRetries} failed:`, errorVal);
      lastError = errorVal;

      // Don't retry on certain types of errors
      if (errorVal.message && (
        errorVal.message.includes('offline') ||
        errorVal.message.includes('forbidden') ||
        errorVal.message.includes('not found')
      )) {
        log('Non-retryable error detected, stopping retries');
        break;
      }

      // Exponential backoff delay with jitter
      if (i < maxRetries - 1) {
        const baseDelay = Math.min(1000 * Math.pow(2, i), 5000);
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        const delayTime = baseDelay + jitter;
        log(`Waiting ${Math.round(delayTime)}ms before retry...`);
        await delay(delayTime);
      }
    }
  }

  error(`All ${maxRetries} attempts failed for: ${url}`);
  throw lastError;
}; 