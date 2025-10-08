// Environment variables configuration
export const config = {
  tmdb: {
    apiKey: import.meta.env.VITE_TMDB_API_KEY as string,
    baseUrl: import.meta.env.VITE_TMDB_BASE_URL as string,
  },
  streaming: {
    vidsrcUrl: import.meta.env.VITE_VIDSRC_BASE_URL as string,
    moviesApiUrl: import.meta.env.VITE_MOVIESAPI_BASE_URL as string,
    rgshowsUrl: import.meta.env.VITE_RGSHOWS_BASE_URL as string,
    embedApiUrl: import.meta.env.VITE_EMBED_API_BASE_URL as string,
  },
  proxy: {
    urls: JSON.parse(import.meta.env.VITE_PROXY_URLS || '[]') as string[],
  },
}; 