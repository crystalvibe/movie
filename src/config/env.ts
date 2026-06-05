// Environment variables configuration
export const config = {
  tmdb: {
    apiKey: import.meta.env.VITE_TMDB_API_KEY as string,
    baseUrl: import.meta.env.VITE_TMDB_BASE_URL as string,
  },
  streaming: {
    vidlinkUrl: (import.meta.env.VITE_VIDLINK_URL as string) || 'https://vidlink.pro',
    vidkingUrl: (import.meta.env.VITE_VIDKING_URL as string) || 'https://www.vidking.net',
    videasyUrl: (import.meta.env.VITE_VIDEASY_URL as string) || 'https://player.videasy.net',
    twoEmbedUrl: (import.meta.env.VITE_2EMBED_URL as string) || 'https://www.2embed.skin',
    peachifyUrl: (import.meta.env.VITE_PEACHIFY_URL as string) || 'https://peachify.pro',
    embedApiUrl: (import.meta.env.VITE_EMBED_API_BASE_URL as string) || 'https://player.embed-api.stream',
  },
  proxy: {
    urls: JSON.parse(import.meta.env.VITE_PROXY_URLS || '[]') as string[],
  },
}; 