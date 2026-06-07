/**
 * Centralized proxy service for CORS-enabled TMDB API requests.
 */

import { config } from '@/config/env';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface CacheItem {
  data: any;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const PROXY_URLS      = config.proxy.urls;
export const DEFAULT_TIMEOUT = 10000;
export const CACHE_DURATION  = 30 * 60 * 1000; // 30 minutes

// ─── In-memory cache ─────────────────────────────────────────────────────────
const apiCache = new Map<string, CacheItem>();

const isCacheValid = (item?: CacheItem): boolean =>
  !!item && Date.now() - item.timestamp < CACHE_DURATION;

const setCache = (key: string, data: any) =>
  apiCache.set(key, { data, timestamp: Date.now() });

// ─── API key sanitiser (keeps keys out of error logs) ────────────────────────
const sanitizeLog = (msg: string): string => {
  const key = config.tmdb.apiKey;
  if (!key) return msg;
  return msg
    .replace(new RegExp(key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '****')
    .replace(/api_key=[a-zA-Z0-9]+/gi, 'api_key=****');
};

// ─── URL helpers ─────────────────────────────────────────────────────────────
/** Resolve a relative TMDB path to a full absolute URL with api_key. */
const resolveTmdbUrl = (url: string): string => {
  const base  = config.tmdb.baseUrl || 'https://api.themoviedb.org/3';
  const key   = config.tmdb.apiKey;
  let resolved = url;

  if (!url.startsWith('http')) {
    if (url.startsWith('/api/tmdb')) {
      resolved = url.replace('/api/tmdb', base);
    } else {
      resolved = `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    }
  }

  if (resolved.includes('api.themoviedb.org') && !resolved.includes('api_key=') && key) {
    resolved += `${resolved.includes('?') ? '&' : '?'}api_key=${key}`;
  }

  return resolved;
};

/** Build the full proxy URL for a given proxy service. */
const formatProxyUrl = (proxyUrl: string, targetUrl: string): string => {
  const noEncode = [
    'https://thingproxy.freeboard.io/fetch/',
    'https://yacdn.org/proxy/',
    'https://proxy.cors.sh/',
    'https://cors.eu.org/',
  ];
  return noEncode.includes(proxyUrl)
    ? `${proxyUrl}${targetUrl}`
    : `${proxyUrl}${encodeURIComponent(targetUrl)}`;
};

// ─── Core: sequential proxy fetch ────────────────────────────────────────────
/**
 * Fetch through multiple CORS proxies in sequence, falling back to a direct
 * call on failure. Results are cached for CACHE_DURATION.
 */
export const fetchWithProxy = async (url: string, options: FetchOptions = {}): Promise<any> => {
  const cacheKey = url;
  if (isCacheValid(apiCache.get(cacheKey))) return apiCache.get(cacheKey)!.data;

  const resolvedUrl = resolveTmdbUrl(url);

  // Self-hosted / relative proxy path → call directly
  if (resolvedUrl.startsWith('/api/') || !resolvedUrl.startsWith('http')) {
    const controller  = new AbortController();
    const timeoutId   = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    try {
      const res = await fetch(resolvedUrl, {
        ...options,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600', ...(options.headers || {}) },
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCache(cacheKey, data);
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // Try each proxy in sequence
  let lastError: any;
  for (let i = 0; i < PROXY_URLS.length; i++) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    try {
      const res = await fetch(formatProxyUrl(PROXY_URLS[i], resolvedUrl), {
        ...options,
        signal: controller.signal,
        headers: { 'Cache-Control': 'max-age=3600', 'Origin': window.location.origin, ...(options.headers || {}) },
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCache(cacheKey, data);
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (i < PROXY_URLS.length - 1) await new Promise(r => setTimeout(r, 500));
    }
  }

  // Final fallback: direct call
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const res = await fetch(resolvedUrl, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin, 'Cache-Control': 'max-age=3600', ...(options.headers || {}) },
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
  } catch (err: any) {
    console.error('[proxy] All proxies + direct call failed:', sanitizeLog(err?.message ?? String(err)));
    throw lastError ?? err;
  }
};

// ─── Parallel proxy fetch ─────────────────────────────────────────────────────
/**
 * Fire all proxies simultaneously and return the first successful response.
 * Falls back to fetchWithProxy (sequential) on total failure.
 */
export const fetchWithParallelProxy = async (url: string, options: FetchOptions = {}): Promise<any> => {
  const cacheKey = url;
  if (isCacheValid(apiCache.get(cacheKey))) return apiCache.get(cacheKey)!.data;

  const resolvedUrl = resolveTmdbUrl(url);

  // Self-hosted / relative path → delegate to sequential
  if (resolvedUrl.startsWith('/api/') || !resolvedUrl.startsWith('http')) {
    return fetchWithProxy(resolvedUrl, options);
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  const proxyPromises = PROXY_URLS.map(async (proxyUrl) => {
    const res = await fetch(formatProxyUrl(proxyUrl, resolvedUrl), {
      ...options,
      signal: controller.signal,
      headers: { 'Cache-Control': 'max-age=3600', 'Origin': window.location.origin, ...(options.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

  try {
    // Promise.any returns the first fulfilled promise
    const data = await (Promise as any).any
      ? (Promise as any).any(proxyPromises)
      : Promise.race(proxyPromises);           // Safari fallback

    clearTimeout(timeoutId);
    setCache(cacheKey, data);
    return data;
  } catch {
    clearTimeout(timeoutId);
    // All parallel proxies failed — try sequential as last resort
    return fetchWithProxy(resolvedUrl, options);
  }
};