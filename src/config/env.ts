// Environment variables configuration
export const config = {
  tmdb: {
    apiKey: (import.meta.env.VITE_TMDB_API_KEY as string || '').trim(),
    baseUrl: '/api/tmdb',
  },
  streaming: {
    vidlinkUrl: ((import.meta.env.VITE_VIDLINK_URL as string) || 'https://vidlink.pro').trim(),
    vidkingUrl: ((import.meta.env.VITE_VIDKING_URL as string) || 'https://www.vidking.net').trim(),
    videasyUrl: ((import.meta.env.VITE_VIDEASY_URL as string) || 'https://player.videasy.net').trim(),
    twoEmbedUrl: ((import.meta.env.VITE_2EMBED_URL as string) || 'https://www.2embed.skin').trim(),
    peachifyUrl: ((import.meta.env.VITE_PEACHIFY_URL as string) || 'https://peachify.pro').trim(),
    embedApiUrl: ((import.meta.env.VITE_EMBED_API_BASE_URL as string) || 'https://player.embed-api.stream').trim(),
  },
  proxy: {
    urls: (JSON.parse((import.meta.env.VITE_PROXY_URLS || '[]').trim()) as string[]).map(url => url.trim()),
  },
}; 