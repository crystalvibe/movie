import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Shield, Gauge, Wifi, MonitorPlay, CheckCircle2, Play, ChevronDown, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { streamingService } from '@/services/streamingService';
import { useWatchHistory } from '@/contexts/WatchHistoryContext';
import { cn } from '@/lib/utils';
import { fetchWithParallelProxy } from '@/utils/proxyService';

// ─── Provider status types ────────────────────────────────────────────────────
type ProviderStatus = 'idle' | 'loading' | 'working' | 'failed';

interface EpisodeCache {
  working: string;       // provider group name that last succeeded
  failed: string[];      // provider group names that failed
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PROVIDER_TIMEOUT_MS = 25000;         // 25 seconds — wait generously for slow servers
const PLAYBACK_CONFIRM_ADVANCE_S = 0.5;   // currentTime must advance at least 0.5s to confirm working

/** Build localStorage key for a given piece of content */
const getCacheKey = (id: number, type: string, season?: number, episode?: number): string =>
  type === 'tv'
    ? `fluid_ep_${id}_tv_${season}_${episode}`
    : `fluid_ep_${id}_movie`;

/** Read cached provider result (null if missing/expired) */
const readCache = (key: string): EpisodeCache | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data: EpisodeCache = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

/** Write cache entry after a provider succeeds */
const writeCache = (key: string, working: string, failed: string[]) => {
  try {
    const entry: EpisodeCache = { working, failed, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage quota exceeded — ignore
  }
};

export const StreamingPage = () => {
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [showServers, setShowServers] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // Runtime provider detection state
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatus>>({});
  const [currentProviderIndex, setCurrentProviderIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const { addToWatchHistory, updateWatchProgress } = useWatchHistory();

  // Get content from query params if not in location state
  const contentId = searchParams.get('id');
  const contentType = searchParams.get('type');
  const seasonParam = searchParams.get('season');
  const episodeParam = searchParams.get('episode');
  
  // Use location state if available, otherwise create from query params
  const content = useMemo(() => {
    return location.state?.content || {
      id: contentId ? parseInt(contentId) : 0,
      media_type: contentType || 'movie',
      season_number: seasonParam ? parseInt(seasonParam) : 1,
      episode_number: episodeParam ? parseInt(episodeParam) : 1
    };
  }, [location.state?.content, contentId, contentType, seasonParam, episodeParam]);

  const [seriesInfo, setSeriesInfo] = useState<any>(null);
  
  // Derive current season and episode from query parameters or content
  const currentSeason = useMemo(() => {
    const s = seasonParam ? parseInt(seasonParam) : (content.season_number || 1);
    return s;
  }, [seasonParam, content.season_number]);

  const currentEpisode = useMemo(() => {
    const e = episodeParam ? parseInt(episodeParam) : (content.episode_number || 1);
    return e;
  }, [episodeParam, content.episode_number]);

  // Derive next/prev episode availability
  const { hasNextEpisode, hasPrevEpisode } = useMemo(() => {
    if (!seriesInfo || content.media_type !== 'tv') {
      return { hasNextEpisode: false, hasPrevEpisode: false };
    }
    const currentSeasonData = seriesInfo.seasons?.find((s: any) => s.season_number === currentSeason);
    const hasNext = !!((currentSeasonData && currentEpisode < currentSeasonData.episode_count) || 
                    (currentSeason < seriesInfo.number_of_seasons));
    const hasPrev = (currentEpisode > 1) || (currentSeason > 1);
    return { hasNextEpisode: hasNext, hasPrevEpisode: hasPrev };
  }, [seriesInfo, content.media_type, currentSeason, currentEpisode]);

  const progressInterval = useRef<NodeJS.Timeout>();
  const lastUpdateTime = useRef<number>(0);
  const hasAddedToHistory = useRef<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const isSearchingRef = useRef(false);
  const currentProviderIndexRef = useRef(0);
  const failedProvidersRef = useRef<string[]>([]);
  // Track currentTime baseline for the provider under test
  const providerBaselineTimeRef = useRef<number | null>(null);
  const providerBaselineSetRef = useRef(false);

  // References to track latest state for progress updates without triggering hook re-subscriptions
  const videoProgressRef = useRef(0);
  const videoDurationRef = useRef(0);
  const isPlayingRef = useRef(false);
  const currentSeasonRef = useRef(1);
  const currentEpisodeRef = useRef(1);
  const selectedServerRef = useRef<string | null>(null);
  const groupedSourcesRef = useRef<any>({});

  // Extract server info from location state if available
  const serverInfo = location.state?.server_info;

  // Reset selected server when season or episode changes
  const prevSeasonRef = useRef<number>(currentSeason);
  const prevEpisodeRef = useRef<number>(currentEpisode);

  useEffect(() => {
    if (prevSeasonRef.current !== currentSeason || prevEpisodeRef.current !== currentEpisode) {
      setSelectedServer(null);
      setLoading(true);
      setIsSearching(false);
      setProviderStatuses({});
      setCurrentProviderIndex(0);
      isSearchingRef.current = false;
      currentProviderIndexRef.current = 0;
      failedProvidersRef.current = [];
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      prevSeasonRef.current = currentSeason;
      prevEpisodeRef.current = currentEpisode;
    }
  }, [currentSeason, currentEpisode]);

  // Reset history flag when content changes
  useEffect(() => {
    hasAddedToHistory.current = false;
  }, [content]);

  // Fetch series information if TV show
  useEffect(() => {
    const fetchSeriesInfo = async () => {
      if (content.media_type === 'tv' && content.id) {
        try {
          const endpoint = `/tv/${content.id}?language=en-US`;
          const data = await fetchWithParallelProxy(endpoint);
          setSeriesInfo(data);
          
          // Add title to content if not present
          if (!content.title) {
            content.title = data.name;
          }
        } catch (error) {
          console.error('Error fetching series info:', error);
        }
      }
    };
    
    fetchSeriesInfo();
  }, [content]);

  // Redirect if no content
  useEffect(() => {
    if (!contentId) {
      navigate('/');
    }
  }, [contentId, navigate]);

  const saveCurrentProgress = useCallback(() => {
    const progress = videoProgressRef.current;
    const duration = videoDurationRef.current;
    
    if (progress > 0 && duration > 0) {
      const progressPercentage = (progress / duration) * 100;
      
      if (!content.id) {
        return;
      }
      
      const mediaType = content.media_type === 'tv' || content.media_type === 'movie' 
        ? content.media_type 
        : 'movie';

      // 1. Add to watch history if not added yet (above 5% progress)
      if (progressPercentage > 5 && !hasAddedToHistory.current) {
        const historyItem = {
          id: content.id,
          title: content.title || content.name || 'Unknown',
          media_type: mediaType,
          poster_path: content.poster_path,
          progress: progressPercentage,
          season: mediaType === 'tv' ? currentSeasonRef.current : undefined,
          episode: mediaType === 'tv' ? currentEpisodeRef.current : undefined,
          server: selectedServerRef.current ? Object.entries(groupedSourcesRef.current)
            .find(([_, servers]: any) => servers.some((s: any) => s.url === selectedServerRef.current))?.[0] || 'Unknown' : 'Unknown',
          server_url: selectedServerRef.current || undefined
        };
        addToWatchHistory(historyItem);
        hasAddedToHistory.current = true;
      }
      
      // 2. Update progress in watch history
      if (mediaType === 'tv') {
        updateWatchProgress(
          content.id, 
          mediaType, 
          progressPercentage, 
          currentSeasonRef.current, 
          currentEpisodeRef.current, 
          selectedServerRef.current ? Object.entries(groupedSourcesRef.current)
            .find(([_, servers]: any) => servers.some((s: any) => s.url === selectedServerRef.current))?.[0] || undefined : undefined,
          selectedServerRef.current || undefined
        );
      } else {
        updateWatchProgress(
          content.id, 
          mediaType, 
          progressPercentage,
          undefined,
          undefined,
          selectedServerRef.current ? Object.entries(groupedSourcesRef.current)
            .find(([_, servers]: any) => servers.some((s: any) => s.url === selectedServerRef.current))?.[0] || undefined : undefined,
          selectedServerRef.current || undefined
        );
      }
      lastUpdateTime.current = Date.now();
    }
  }, [content, addToWatchHistory, updateWatchProgress]);

  // Keep saveCurrentProgress in a mutable ref so useEffect dependencies can be completely static/empty
  const saveProgressRef = useRef(saveCurrentProgress);
  useEffect(() => {
    saveProgressRef.current = saveCurrentProgress;
  }, [saveCurrentProgress]);

  // Periodic auto-save every 15 seconds while playing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        saveProgressRef.current();
      }, 15000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying]);

  // Save progress on page unload or unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveProgressRef.current();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      saveProgressRef.current(); // Save on unmount
    };
  }, []);

  // ─── Runtime provider confirmation ───────────────────────────────────────────
  // Called when currentTime has actually advanced — proves real playback is happening
  const confirmCurrentProviderWorking = useCallback(() => {
    if (!isSearchingRef.current) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    isSearchingRef.current = false;
    setIsSearching(false);
    setLoading(false);

    // Find which provider group owns the currently selected URL
    const currentUrl = selectedServerRef.current;
    const groupEntry = Object.entries(groupedSourcesRef.current)
      .find(([, servers]: any) => servers.some((s: any) => s.url === currentUrl));
    const providerName = groupEntry?.[0] ?? 'Unknown';

    setProviderStatuses(prev => ({ ...prev, [providerName]: 'working' }));
    console.log(`[AutoDetect] ✅ Confirmed working: ${providerName}`);

    // Save to localStorage cache
    const cacheKey = getCacheKey(
      content.id,
      content.media_type,
      currentSeasonRef.current,
      currentEpisodeRef.current
    );
    writeCache(cacheKey, providerName, failedProvidersRef.current);
  }, [content.id, content.media_type]);

  // Called with the latest currentTime from the iframe message
  // Only confirms the provider once time has actually moved forward
  const checkTimeAdvanceRef = useRef((currentTime: number) => {
    if (!isSearchingRef.current) return;
    if (!providerBaselineSetRef.current) {
      // First time reading — record baseline
      providerBaselineTimeRef.current = currentTime;
      providerBaselineSetRef.current = true;
      console.log(`[AutoDetect] 📍 Baseline set: ${currentTime.toFixed(2)}s`);
      return;
    }
    const baseline = providerBaselineTimeRef.current ?? 0;
    if (currentTime - baseline >= PLAYBACK_CONFIRM_ADVANCE_S) {
      console.log(`[AutoDetect] ▶ Time advanced ${(currentTime - baseline).toFixed(2)}s → confirming`);
      confirmCurrentProviderWorkingRef.current();
    }
  });

  // Keep checkTimeAdvanceRef in sync with latest confirmCurrentProviderWorking
  useEffect(() => {
    checkTimeAdvanceRef.current = (currentTime: number) => {
      if (!isSearchingRef.current) return;
      if (!providerBaselineSetRef.current) {
        providerBaselineTimeRef.current = currentTime;
        providerBaselineSetRef.current = true;
        console.log(`[AutoDetect] 📍 Baseline set: ${currentTime.toFixed(2)}s`);
        return;
      }
      const baseline = providerBaselineTimeRef.current ?? 0;
      if (currentTime - baseline >= PLAYBACK_CONFIRM_ADVANCE_S) {
        console.log(`[AutoDetect] ▶ Time advanced ${(currentTime - baseline).toFixed(2)}s → confirming`);
        confirmCurrentProviderWorkingRef.current();
      }
    };
  }, []);

  const confirmCurrentProviderWorkingRef = useRef(confirmCurrentProviderWorking);
  useEffect(() => { confirmCurrentProviderWorkingRef.current = confirmCurrentProviderWorking; }, [confirmCurrentProviderWorking]);

  // Handle iframe messages for video state
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        let video = event.data;
        if (typeof video === 'string') {
          try { video = JSON.parse(video); } catch { /* not JSON */ }
        }

        if (video && typeof video === 'object') {
          const videoData = video.type === 'PLAYER_EVENT' && video.data ? video.data : video;

          if (progressInterval.current) {
            clearInterval(progressInterval.current);
            progressInterval.current = undefined;
          }

          // ── Playback-signal: only confirm when currentTime is actually advancing ──
          if (typeof videoData.currentTime === 'number' && videoData.currentTime > 0) {
            checkTimeAdvanceRef.current(videoData.currentTime);
          }

          if (videoData.duration && typeof videoData.duration === 'number' && videoData.duration > 0) {
            setVideoDuration(videoData.duration);
          }

          if (videoData.currentTime && typeof videoData.currentTime === 'number') {
            const timeDiff = Math.abs(videoData.currentTime - videoProgressRef.current);
            videoProgressRef.current = videoData.currentTime;
            setVideoProgress(videoData.currentTime);
            if (timeDiff > 3) saveProgressRef.current();
          }

          if (videoData.paused !== undefined) {
            const wasPlaying = isPlayingRef.current;
            setIsPlaying(!videoData.paused);
            if (videoData.paused && wasPlaying) saveProgressRef.current();
          } else if (videoData.event === 'timeupdate') {
            setIsPlaying(true);
          } else if (videoData.event === 'pause') {
            setIsPlaying(false);
            saveProgressRef.current();
          } else if (videoData.event === 'seeked') {
            saveProgressRef.current();
          } else if (videoData.event === 'ended') {
            setIsPlaying(false);
            saveProgressRef.current();
          }
        }

        // Simulate progress fallback when providers don't emit events
        const hasRealDuration = video && typeof video === 'object' &&
          (video.duration || (video.type === 'PLAYER_EVENT' && video.data?.duration));
        if (!hasRealDuration && !progressInterval.current && videoDurationRef.current === 0) {
          setVideoDuration(120);
          progressInterval.current = setInterval(() => {
            setVideoProgress(prev => {
              const next = prev + 1;
              if (next >= 120) {
                clearInterval(progressInterval.current!);
                progressInterval.current = undefined;
                saveProgressRef.current();
                return 120;
              }
              return next;
            });
          }, 1000);
        }
      } catch (err) {
        console.error('Error handling iframe message:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);


  const navigateToEpisode = (season: number, episode: number) => {
    // Reset history flag
    hasAddedToHistory.current = false;
    
    // Navigate to the new episode
    navigate(`/watch?id=${content.id}&type=tv&season=${season}&episode=${episode}`, {
      replace: true // Replace current history entry to avoid back button issues
    });
    
    // Update URL content with season and episode
    content.season_number = season;
    content.episode_number = episode;
    
    // Reset selected server to first available for new episode
    setSelectedServer(null);
    setLoading(true);
  };

  const handleNextEpisode = () => {
    if (!seriesInfo || !currentSeason || !currentEpisode) return;
    
    const currentSeasonData = seriesInfo.seasons?.find((s: any) => s.season_number === currentSeason);
    if (!currentSeasonData) return;
    
    if (currentEpisode < currentSeasonData.episode_count) {
      // Next episode in same season
      navigateToEpisode(currentSeason, currentEpisode + 1);
    } else if (currentSeason < seriesInfo.number_of_seasons) {
      // First episode of next season
      const nextSeason = seriesInfo.seasons?.find((s: any) => s.season_number === currentSeason + 1);
      if (nextSeason) {
        navigateToEpisode(currentSeason + 1, 1);
      }
    }
  };

  const handlePrevEpisode = () => {
    if (!seriesInfo || !currentSeason || !currentEpisode) return;
    
    if (currentEpisode > 1) {
      // Previous episode in same season
      navigateToEpisode(currentSeason, currentEpisode - 1);
    } else if (currentSeason > 1) {
      // Last episode of previous season
      const prevSeason = seriesInfo.seasons?.find((s: any) => s.season_number === currentSeason - 1);
      if (prevSeason) {
        navigateToEpisode(currentSeason - 1, prevSeason.episode_count);
      }
    }
  };

  // No periodic server check — HEAD requests to embed URLs often fail (CORS) even when stream works

  // Update the sources to use the current season and episode
  const sources = useMemo(() => {
    return streamingService.getAllStreamingSources({
      type: content.media_type,
      tmdbId: content.id.toString(),
      season: currentSeason || 1,
      episode: currentEpisode || 1
    });
  }, [content.media_type, content.id, currentSeason, currentEpisode]);

  // Group servers by provider and ensure we have valid URLs
  const groupedSources = useMemo(() => {
    return sources.reduce((acc, source) => {
      if (!source.url) return acc;  // Skip invalid URLs
      
      let groupName = 'Other';
      if (source.name.includes('VidLink')) {
        groupName = 'VidLink';
      } else if (source.name.includes('VidKing')) {
        groupName = 'VidKing';
      } else if (source.name.includes('Videasy')) {
        groupName = 'Videasy';
      } else if (source.name.includes('2Embed')) {
        groupName = '2Embed';
      } else if (source.name.includes('Peachify')) {
        groupName = 'Peachify';
      } else if (source.name.includes('Embed-API')) {
        groupName = 'Embed-API';
      }
      
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(source);
      return acc;
    }, {} as Record<string, typeof sources>);
  }, [sources]);

  // Sync state values to references on every render (safe after all derived variables are initialized)
  videoProgressRef.current = videoProgress;
  videoDurationRef.current = videoDuration;
  isPlayingRef.current = isPlaying;
  currentSeasonRef.current = currentSeason;
  currentEpisodeRef.current = currentEpisode;
  selectedServerRef.current = selectedServer;
  groupedSourcesRef.current = groupedSources;

  // ─── Runtime sequential provider detection ───────────────────────────────────
  useEffect(() => {
    if (sources.length === 0) return;
    // Only kick off detection when no server is selected yet
    if (selectedServer) { setLoading(false); return; }

    const providerNames = Object.keys(groupedSources);
    if (providerNames.length === 0) return;

    // Init all statuses to idle
    const initStatuses: Record<string, ProviderStatus> = {};
    providerNames.forEach(n => { initStatuses[n] = 'idle'; });
    setProviderStatuses(initStatuses);
    failedProvidersRef.current = [];

    // ── Determine start index, honouring cache and watch-history hint ─────
    const cacheKey = getCacheKey(
      content.id, content.media_type,
      currentSeason, currentEpisode
    );
    const cached = readCache(cacheKey);

    let startIdx = 0;

    // Check watch-history hint first
    const historyUrl = serverInfo?.server_url;
    if (historyUrl) {
      const historyGroup = Object.entries(groupedSources)
        .find(([, servers]: any) => servers.some((s: any) => s.url === historyUrl))?.[0];
      if (historyGroup) {
        const idx = providerNames.indexOf(historyGroup);
        if (idx !== -1) startIdx = idx;
      }
    }

    // Cache overrides history hint
    if (cached?.working) {
      const cachedIdx = providerNames.indexOf(cached.working);
      if (cachedIdx !== -1) {
        startIdx = cachedIdx;
        // Pre-mark known failed providers from cache
        cached.failed.forEach(name => {
          if (providerNames.includes(name)) {
            initStatuses[name] = 'failed';
            failedProvidersRef.current.push(name);
          }
        });
        setProviderStatuses({ ...initStatuses });
        console.log(`[AutoDetect] Cache hit → starting with ${cached.working}`);
      }
    }

    currentProviderIndexRef.current = startIdx;
    isSearchingRef.current = true;
    setCurrentProviderIndex(startIdx);
    setIsSearching(true);
    setLoading(true);

    // ── tryProvider: load a provider, wait for play signal or timeout ─────
    const tryProvider = (idx: number) => {
      if (!isSearchingRef.current) return;
      if (idx >= providerNames.length) {
        // Exhausted all providers — fall back to first source
        console.log('[AutoDetect] All providers exhausted, using first source as fallback');
        isSearchingRef.current = false;
        setIsSearching(false);
        setSelectedServer(sources[0].url);
        setLoading(false);
        return;
      }

      const name = providerNames[idx];
      const providerSources = (groupedSources as any)[name];
      if (!providerSources?.length) { tryProvider(idx + 1); return; }
      const url = providerSources[0].url;

      console.log(`[AutoDetect] Trying ${name} (${idx + 1}/${providerNames.length})`);
      currentProviderIndexRef.current = idx;
      setCurrentProviderIndex(idx);
      setProviderStatuses(prev => ({ ...prev, [name]: 'loading' }));
      // Reset baseline tracking for each new provider attempt
      providerBaselineTimeRef.current = null;
      providerBaselineSetRef.current = false;
      setSelectedServer(url);

      // Timeout: if currentTime never advances, mark failed and try next
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        if (!isSearchingRef.current) return;
        console.log(`[AutoDetect] ⏱ Timeout on ${name} (time never advanced), trying next`);
        failedProvidersRef.current = [...failedProvidersRef.current, name];
        setProviderStatuses(prev => ({ ...prev, [name]: 'failed' }));
        // Invalidate any stale cache entry that pointed to this server
        const cacheKey = getCacheKey(
          content.id, content.media_type,
          currentSeasonRef.current, currentEpisodeRef.current
        );
        const cached = readCache(cacheKey);
        if (cached?.working === name) {
          localStorage.removeItem(cacheKey);
          console.log(`[AutoDetect] 🗑 Cache invalidated for ${name}`);
        }
        tryProvider(idx + 1);
      }, PROVIDER_TIMEOUT_MS);
    };

    tryProvider(startIdx);

    return () => {
      isSearchingRef.current = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Video Section - Full Screen */}
      <div className="fixed inset-0 bg-black">
        {/* Loading Screen */}
        {loading && (
          <div className="absolute inset-0 bg-black z-30 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-6" />
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <MonitorPlay className="w-5 h-5" />
              <span className="text-base font-semibold">
                {isSearching
                  ? `Finding best server\u2026 (${currentProviderIndex + 1} of ${Object.keys(groupedSources).length})`
                  : 'Loading Stream'}
              </span>
            </div>
            {isSearching && Object.keys(providerStatuses).length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap justify-center max-w-xs">
                {Object.entries(providerStatuses).map(([name, status]) => (
                  <div key={name} className="flex items-center gap-1 text-[11px]">
                    {status === 'loading' && <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />}
                    {status === 'working' && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                    {status === 'failed'  && <AlertCircle className="w-3 h-3 text-red-400" />}
                    {status === 'idle'    && <div className="w-2 h-2 rounded-full bg-white/20" />}
                    <span className={cn(
                      status === 'working' ? 'text-green-400' :
                      status === 'failed'  ? 'text-red-400/60' :
                      status === 'loading' ? 'text-yellow-400' : 'text-white/30'
                    )}>{name}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex items-center gap-4 text-white/30">
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                <span className="text-xs">Secure Stream</span>
              </div>
              <div className="flex items-center gap-1">
                <Gauge className="w-4 h-4" />
                <span className="text-xs">High Quality</span>
              </div>
              <div className="flex items-center gap-1">
                <Wifi className="w-4 h-4" />
                <span className="text-xs">Auto-Adjust</span>
              </div>
            </div>
          </div>
        )}

        {/* Video Player */}
        <iframe
          key={selectedServer}
          src={selectedServer || ''}
          className="w-full h-full"
          allowFullScreen
          scrolling="no"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          style={{ border: 'none' }}
          onLoad={() => {
            const iframe = document.querySelector('iframe');
            if (iframe?.contentWindow) {
              // Initialize player and auto-play
              setTimeout(() => {
                iframe.contentWindow?.postMessage({ type: 'play' }, '*');
                setIsPlaying(true);
              }, 1000);
            }
          }}
        />

        {/* TV Show Episode Navigation */}
        {content.media_type === 'tv' && (
          <div className="fixed top-1/2 left-0 right-0 flex justify-between items-center px-4 pointer-events-none z-10">
            <button
              onClick={handlePrevEpisode}
              disabled={!hasPrevEpisode}
              className={`p-3 bg-black/50 backdrop-blur-sm rounded-full pointer-events-auto ${
                hasPrevEpisode ? 'opacity-60 hover:opacity-100' : 'opacity-20 cursor-not-allowed'
              } transition-opacity`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <button
              onClick={handleNextEpisode}
              disabled={!hasNextEpisode}
              className={`p-3 bg-black/50 backdrop-blur-sm rounded-full pointer-events-auto ${
                hasNextEpisode ? 'opacity-60 hover:opacity-100' : 'opacity-20 cursor-not-allowed'
              } transition-opacity`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Right Side Controls */}
        <div className="fixed top-4 right-4 z-20 flex flex-col gap-2 w-48">
        {/* Episode Title Banner */}
        {content.media_type === 'tv' && seriesInfo && (
            <div className="relative group w-full">
              <button
                onClick={() => setShowEpisodeSelector(!showEpisodeSelector)}
                className="bg-black/70 backdrop-blur-md px-3 py-2 rounded-lg w-full hover:bg-black/80 transition-all duration-200 
                           border border-transparent hover:border-purple-500/20 flex items-center justify-between"
              >
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-purple-400 font-medium truncate max-w-[5.5rem]">{seriesInfo.name}</span>
              <span className="text-white/60">•</span>
                  <span className="text-white/90">S{currentSeason} E{currentEpisode}</span>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-white/60 transition-transform duration-200",
                  showEpisodeSelector && "transform rotate-180"
                )} />
              </button>

              {/* Episode Selector Dropdown */}
              {showEpisodeSelector && (
                <div className="absolute top-full left-0 mt-2 bg-black/95 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden w-full z-50
                                shadow-lg shadow-purple-500/10 animate-in fade-in duration-200">
                  <div className="p-2 border-b border-white/10">
                    <h3 className="font-medium text-xs text-white/90">Select Episode</h3>
                  </div>
                  <div className="max-h-[35vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {seriesInfo.seasons?.map((season: any) => (
                      <div key={season.season_number} className="border-b border-white/10 last:border-b-0">
                        <button
                          onClick={() => setExpandedSeason(expandedSeason === season.season_number ? null : season.season_number)}
                          className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
                        >
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-xs font-medium text-white/90">Season {season.season_number}</span>
                            <span className="text-[10px] text-white/40">{season.episode_count} Ep</span>
                          </div>
                          <ChevronDown className={cn(
                            "w-4 h-4 text-white/60 transition-transform duration-200",
                            expandedSeason === season.season_number && "transform rotate-180"
                          )} />
                        </button>
                        
                        {expandedSeason === season.season_number && (
                          <div className="bg-white/[0.02] py-1">
                            {Array.from({ length: season.episode_count }, (_, i) => i + 1).map((episodeNum) => (
                              <button
                                key={episodeNum}
                                onClick={() => {
                                  navigateToEpisode(season.season_number, episodeNum);
                                  setShowEpisodeSelector(false);
                                }}
                                className={cn(
                                  "w-full px-5 py-1.5 flex items-center justify-between group/episode hover:bg-white/5 transition-colors duration-200 text-xs",
                                  currentSeason === season.season_number && currentEpisode === episodeNum 
                                    ? "bg-purple-500/20 text-purple-400" 
                                    : "text-white/75"
                                )}
                              >
                                <span>Ep {episodeNum}</span>
                                {currentSeason === season.season_number && currentEpisode === episodeNum ? (
                                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                                ) : (
                                  <Play className="w-4 h-4 opacity-0 group-hover/episode:opacity-100 transition-opacity duration-200" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
            </div>
                </div>
              )}
          </div>
        )}

          {/* Servers Section */}
          <div className="relative group w-full">
            <button
              onClick={() => setShowServers(!showServers)}
              className="px-3 py-2 bg-black/70 backdrop-blur-md text-white rounded-lg
                         hover:bg-black/80 transition-all duration-200 border border-transparent hover:border-purple-500/20
                         flex items-center justify-between w-full text-xs"
            >
              <div className="flex items-center gap-1">
                <MonitorPlay className="w-4 h-4 text-purple-400" />
                <span>Servers</span>
                {isSearching && <Loader2 className="w-3 h-3 text-yellow-400 animate-spin ml-1" />}
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-white/60 transition-transform duration-200",
                showServers && "transform rotate-180"
              )} />
            </button>

            {/* Servers Menu */}
            {showServers && (
              <div className="absolute top-full left-0 mt-2 bg-black/95 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden w-full z-40
                              shadow-lg shadow-purple-500/10 animate-in fade-in duration-200">
                <div className="p-2 border-b border-white/10">
                  <h3 className="font-medium text-xs text-white/90">
                    {isSearching ? 'Auto-detecting\u2026' : 'Available Servers'}
                  </h3>
                </div>
                <div className="max-h-[35vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {Object.entries(groupedSources)
                    .sort(([a], [b]) => {
                      // Working first, then idle/loading, then failed
                      const order = { working: 0, loading: 1, idle: 2, failed: 3 };
                      return (order[providerStatuses[a] ?? 'idle'] ?? 2) - (order[providerStatuses[b] ?? 'idle'] ?? 2);
                    })
                    .map(([provider, servers]) => {
                      const status = providerStatuses[provider] ?? 'idle';
                      const isFailed = status === 'failed';
                      return (
                        <div key={provider} className={cn("border-b border-white/10 last:border-b-0", isFailed && 'opacity-50')}>
                          <button
                            onClick={() => setExpandedServer(expandedServer === provider ? null : provider)}
                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
                          >
                            <div className="flex flex-col items-start gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {status === 'loading' && <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />}
                                {status === 'working' && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                                {status === 'failed'  && <AlertCircle className="w-3 h-3 text-red-400" />}
                                {status === 'idle'    && <div className="w-2 h-2 rounded-full bg-white/20" />}
                                <span className={cn(
                                  "text-xs font-medium",
                                  status === 'working' ? 'text-green-400' :
                                  status === 'loading' ? 'text-yellow-400' :
                                  status === 'failed'  ? 'text-red-400/70' : 'text-white/90'
                                )}>{provider}</span>
                              </div>
                              <span className="text-[10px] text-white/30">{servers.length} Src</span>
                            </div>
                            <ChevronDown className={cn(
                              "w-4 h-4 text-white/60 transition-transform duration-200",
                              expandedServer === provider && "transform rotate-180"
                            )} />
                          </button>

                          {expandedServer === provider && (
                            <div className="bg-white/[0.02] py-1">
                              {servers.map((server, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    // Manual override — stop auto-search and lock this server
                                    isSearchingRef.current = false;
                                    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                                    setIsSearching(false);
                                    setSelectedServer(server.url);
                                    setLoading(false);
                                    setShowServers(false);
                                  }}
                                  className={cn(
                                    "w-full px-5 py-1.5 flex items-center justify-between group/server hover:bg-white/5 transition-colors duration-200 text-xs",
                                    selectedServer === server.url
                                      ? "bg-purple-500/20 text-purple-400"
                                      : "text-white/75"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <span>{server.quality}</span>
                                    {server.quality.includes('HD') && (
                                      <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">HD</span>
                                    )}
                                  </div>
                                  {selectedServer === server.url ? (
                                    <CheckCircle2 className="w-4 h-4 text-purple-400" />
                                  ) : (
                                    <Play className="w-4 h-4 opacity-0 group-hover/server:opacity-100 transition-opacity duration-200" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            )}
          </div>

        {/* History Button */}
        <button
          onClick={() => {
            if (!content.id) return;
            const mediaType = content.media_type === 'tv' || content.media_type === 'movie'
              ? content.media_type : 'movie';
            const currentServerName = selectedServer
              ? Object.entries(groupedSources).find(([_, servers]) => servers.some(s => s.url === selectedServer))?.[0]
              : 'Unknown';
            const historyItem = {
              id: content.id,
              title: content.title || content.name || 'Unknown',
              media_type: mediaType,
              poster_path: content.poster_path || '',
              progress: Math.round((videoProgress / videoDuration) * 100) || 0,
              season: mediaType === 'tv' ? currentSeason : undefined,
              episode: mediaType === 'tv' ? currentEpisode : undefined,
              server: currentServerName,
              server_url: selectedServer || undefined
            };
            addToWatchHistory(historyItem);
            hasAddedToHistory.current = true;
          }}
            className="px-3 py-2 bg-black/70 backdrop-blur-md text-white rounded-lg 
                       hover:bg-black/80 transition-all duration-200 border border-transparent hover:border-purple-500/20
                       flex items-center justify-between w-full text-xs"
        >
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
          <span>Add to History</span>
            </div>
                        </button>
          </div>

        {/* Close Button */}
        <button
          onClick={() => navigate('/')}
          className="fixed top-4 left-4 z-20 p-2 bg-black/20 backdrop-blur-sm text-white rounded-full 
                   hover:bg-black/40 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}; 