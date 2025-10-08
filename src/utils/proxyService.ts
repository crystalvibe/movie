/**
 * Centralized proxy service for handling CORS-enabled API requests
 * This file provides utilities for making API requests through various CORS proxies
 */

import { config } from '@/config/env';

// Define the options interface for fetch requests
interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Define multiple proxies with fallback options
export const PROXY_URLS = config.proxy.urls;

// Default timeout for fetch requests (ms)
export const DEFAULT_TIMEOUT = 5000;

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
    console.log("Formatted TMDB URL:", targetUrl.replace(tmdbApiKey, '****'));
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
  
  // Default for other proxies that need URL encoding
  return `${proxyUrl}${encodeURIComponent(targetUrl)}`;
};

/**
 * Handles specific error types in a more user-friendly way
 */
const handleFetchError = (error: any, proxyUrl: string): Error => {
  // Check if the error is a TypeError with "Failed to fetch" message (common CORS error)
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return new Error(`CORS error with proxy ${proxyUrl}: The request was blocked by the browser`);
  }
  
  // Check if there's a network error
  if (!navigator.onLine) {
    return new Error('Network error: You appear to be offline');
  }
  
  // If the error already has a message from the API, pass it through
  if (error instanceof Error) {
    return error;
  }
  
  return new Error(`Unknown error with proxy ${proxyUrl}`);
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

  // Set timeout for fetch requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  
  let lastError;
  
  // Try each proxy in sequence until one works
  for (let i = 0; i < PROXY_URLS.length; i++) {
    try {
      const proxyUrl = formatProxyUrl(PROXY_URLS[i], url);
      console.log(`Trying proxy ${i + 1}: ${PROXY_URLS[i]} with URL: ${proxyUrl}`);
      
      const response = await fetch(proxyUrl, { 
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.headers || {}),
          'Cache-Control': 'max-age=3600', // Cache for 1 hour in browser
          'Origin': window.location.origin
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
      
      console.log(`Successful response from proxy ${i + 1}: ${PROXY_URLS[i]}`);
      return data;
    } catch (error) {
      const formattedError = handleFetchError(error, PROXY_URLS[i]);
      console.error(`Proxy ${i + 1} (${PROXY_URLS[i]}) failed:`, formattedError.message);
      lastError = formattedError;
      // Continue to next proxy
    }
  }
  
  // Try direct call as next resort
  try {
    clearTimeout(timeoutId);
    console.log(`Trying direct API call to: ${url}`);
    
    const response = await fetch(url, {
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
    
    console.log('Direct API call successful');
    return data;
  } catch (error) {
    const formattedError = handleFetchError(error, 'direct call');
    console.error('Direct API call failed:', formattedError.message);
    
    // Try JSONP as a last resort (only works for APIs that support it)
    if (url.includes('api.themoviedb.org')) {
      try {
        console.log('Trying JSONP as last resort');
        const data = await fetchWithJSONP(url);
        
        // Cache the result
        apiCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
        
        console.log('JSONP call successful');
        return data;
      } catch (jsonpError) {
        console.error('JSONP fallback failed:', jsonpError);
      }
    }
    
    throw lastError || formattedError;
  }
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

  // Set timeout for fetch requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  
  // Try all proxies in parallel for faster response
  const proxyPromises = PROXY_URLS.map(async (proxyUrl, index) => {
    try {
      const fullUrl = formatProxyUrl(proxyUrl, url);
      console.log(`Trying parallel proxy ${index + 1}: ${proxyUrl} with URL: ${fullUrl}`);
      
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
      console.log(`Successful parallel response from proxy ${index + 1}: ${proxyUrl}`);
      return data;
    } catch (error) {
      const formattedError = handleFetchError(error, proxyUrl);
      console.error(`Parallel proxy ${index + 1} failed:`, formattedError.message);
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
        } catch (error) {
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
      console.log(`Trying direct API call to: ${url}`);
      
      const response = await fetch(url, {
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
      
      console.log('Direct API call successful');
      return data;
    } catch (error) {
      const formattedError = handleFetchError(error, 'direct call');
      console.error('All proxies and direct call failed:', formattedError.message);
      
      // Try JSONP as a last resort (only works for APIs that support it)
      if (url.includes('api.themoviedb.org')) {
        try {
          console.log('Trying JSONP as last resort');
          const data = await fetchWithJSONP(url);
          
          // Cache the result
          apiCache.set(cacheKey, {
            data,
            timestamp: Date.now()
          });
          
          console.log('JSONP call successful');
          return data;
        } catch (jsonpError) {
          console.error('JSONP fallback failed:', jsonpError);
        }
      }
      
      throw formattedError;
    }
  }
};

// Delay utility for retry logic
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches with built-in retry logic
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
      const response = await fetchWithProxy(url, options);
      return response;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      lastError = error;
      // Exponential backoff delay
      await delay(Math.min(1000 * Math.pow(2, i), 5000));
    }
  }
  
  throw lastError;
}; 