import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Shield, Gauge, Wifi, MonitorPlay, CheckCircle2, Play, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { streamingService } from '@/services/streamingService';
import { useWatchHistory } from '@/contexts/WatchHistoryContext';
import { cn } from '@/lib/utils';
import { fetchWithParallelProxy } from '@/utils/proxyService';

export const StreamingPage = () => {
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [showServers, setShowServers] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [showServerError, setShowServerError] = useState(false);
  const [seriesInfo, setSeriesInfo] = useState<any>(null);
  const [currentSeason, setCurrentSeason] = useState<number | undefined>();
  const [currentEpisode, setCurrentEpisode] = useState<number | undefined>();
  const [hasNextEpisode, setHasNextEpisode] = useState(false);
  const [hasPrevEpisode, setHasPrevEpisode] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout>();
  const lastUpdateTime = useRef<number>(0);
  const hasAddedToHistory = useRef<boolean>(false);
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
  const content = location.state?.content || {
    id: contentId ? parseInt(contentId) : 0,
    media_type: contentType || 'movie',
    season_number: seasonParam ? parseInt(seasonParam) : 1,
    episode_number: episodeParam ? parseInt(episodeParam) : 1
  };

  // Extract server info from location state if available
  const serverInfo = location.state?.server_info;
  
  // Initialize season and episode state with defaults
  useEffect(() => {
    if (content.media_type === 'tv') {
      setCurrentSeason(content.season_number || 1);
      setCurrentEpisode(content.episode_number || 1);
    }
  }, [content]);

  // Log server info if available
  useEffect(() => {
    if (serverInfo) {
      console.log("Server info from history:", serverInfo);
    }
  }, [serverInfo]);

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
          
          // Set current season/episode from content or params
          const season = content.season_number || (seasonParam ? parseInt(seasonParam) : 1);
          const episode = content.episode_number || (episodeParam ? parseInt(episodeParam) : 1);
          
          setCurrentSeason(season);
          setCurrentEpisode(episode);
          
          // Calculate if we have next/prev episodes
          const currentSeasonData = data.seasons?.find((s: any) => s.season_number === season);
          setHasNextEpisode(
            (currentSeasonData && episode < currentSeasonData.episode_count) || 
            (season < data.number_of_seasons)
          );
          setHasPrevEpisode(
            (episode > 1) || (season > 1)
          );
          
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
  }, [content, seasonParam, episodeParam]);

  // Redirect if no content
  useEffect(() => {
    if (!contentId) {
      navigate('/');
    }
  }, [contentId, navigate]);

  // Add to watch history when finished
  useEffect(() => {
    // Log what's currently in localStorage for debugging
    const currentStorage = localStorage.getItem('watchHistory');
    console.log('Current localStorage watchHistory:', currentStorage ? JSON.parse(currentStorage) : 'Empty');
    
    if (videoProgress > 0 && videoDuration > 0) {
      const progressPercentage = (videoProgress / videoDuration) * 100;
      
      // Add to watch history after watching 5% of the video
      if (progressPercentage > 5 && !hasAddedToHistory.current) {
        // Ensure we have a valid ID before adding to history
        if (!content.id) {
          console.error("Cannot add to watch history: missing content ID");
          return;
        }
        
        // Ensure we have a valid media_type
        const mediaType = content.media_type === 'tv' || content.media_type === 'movie' 
          ? content.media_type 
          : 'movie'; // Default to movie if invalid
        
        const historyItem = {
          id: content.id,
          title: content.title || content.name || 'Unknown',
          media_type: mediaType,
          poster_path: content.poster_path,
          progress: progressPercentage,
          season: mediaType === 'tv' ? currentSeason : undefined,
          episode: mediaType === 'tv' ? currentEpisode : undefined,
          server: selectedServer ? Object.entries(groupedSources)
            .find(([_, servers]) => servers.some(s => s.url === selectedServer))?.[0] || 'Unknown' : 'Unknown',
          server_url: selectedServer || undefined
        };
        
        addToWatchHistory(historyItem);
        hasAddedToHistory.current = true;
      }
      
      // Update progress periodically when reached significant milestones (10%, 30%, 50%, 70%, 90%)
      const milestones = [10, 30, 50, 70, 90];
      const currentMilestone = milestones.find(m => 
        progressPercentage >= m && progressPercentage < m + 5
      );
      
      if (currentMilestone && Date.now() - lastUpdateTime.current > 10000) {
        // Ensure we have a valid ID before updating history
        if (!content.id) {
          console.error("Cannot update watch history: missing content ID");
          return;
        }
        
        // Ensure we have a valid media_type
        const mediaType = content.media_type === 'tv' || content.media_type === 'movie' 
          ? content.media_type 
          : 'movie'; // Default to movie if invalid
        
        if (mediaType === 'tv') {
          updateWatchProgress(
            content.id, 
            mediaType, 
            progressPercentage, 
            currentSeason, 
            currentEpisode, 
            selectedServer ? Object.entries(groupedSources)
              .find(([_, servers]) => servers.some(s => s.url === selectedServer))?.[0] || undefined : undefined,
            selectedServer
          );
        } else {
          updateWatchProgress(
            content.id, 
            mediaType, 
            progressPercentage,
            undefined,
            undefined,
            selectedServer ? Object.entries(groupedSources)
              .find(([_, servers]) => servers.some(s => s.url === selectedServer))?.[0] || undefined : undefined,
            selectedServer
          );
        }
        lastUpdateTime.current = Date.now();
      }
    }
  }, [videoProgress, videoDuration, content, addToWatchHistory, updateWatchProgress, currentSeason, currentEpisode, selectedServer]);

  // Handle iframe messages for video state
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        console.log("Received message from iframe:", event.data);
        
        // Different video players send different message formats
        const video = event.data;
        
        // Handle standard format (most common)
        if (video && typeof video === 'object') {
          // If duration is provided
          if (video.duration && typeof video.duration === 'number' && video.duration > 0) {
            console.log("Setting video duration:", video.duration);
            setVideoDuration(video.duration);
          }
          
          // If current time is provided
          if (video.currentTime && typeof video.currentTime === 'number') {
            console.log("Setting video progress:", video.currentTime);
            setVideoProgress(video.currentTime);
          }
          
          // If paused state is provided
          if (video.paused !== undefined) {
            setIsPlaying(!video.paused);
          }
        }
        
        // If the video player doesn't send messages in the expected format,
        // let's simulate progress for testing purposes
        if (!video || !video.duration) {
          // Start a timer that simulates progress if none is being reported
          if (!progressInterval.current && videoDuration === 0) {
            console.log("Starting simulated video progress");
            // Simulate a 2-minute video
            setVideoDuration(120);
            
            // Simulate progress updates every second
            progressInterval.current = setInterval(() => {
              setVideoProgress(prev => {
                const newProgress = prev + 1;
                console.log("Simulated progress:", newProgress);
                return newProgress > 120 ? 120 : newProgress;
              });
            }, 1000);
          }
        }
      } catch (error) {
        console.error("Error handling message from iframe:", error);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Cleanup
    return () => {
      window.removeEventListener('message', handleMessage);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const handlePlayPause = () => {
    const iframe = document.querySelector('iframe');
    if (!iframe) return;

    // Send message to iframe to play/pause
    iframe.contentWindow?.postMessage({
      type: isPlaying ? 'pause' : 'play'
    }, '*');
  };

  const navigateToEpisode = (season: number, episode: number) => {
    // Reset history flag
    hasAddedToHistory.current = false;
    
    // Navigate to the new episode
    navigate(`/watch?id=${content.id}&type=tv&season=${season}&episode=${episode}`, {
      replace: true // Replace current history entry to avoid back button issues
    });
    
    // Update current season/episode
    setCurrentSeason(season);
    setCurrentEpisode(episode);
    
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

  // Handle server error
  useEffect(() => {
    let errorTimeout: NodeJS.Timeout;
    
    const checkServerStatus = () => {
      if (selectedServer) {
        fetch(selectedServer, { method: 'HEAD' })
          .then(() => {
            setServerError(false);
            setShowServerError(false);
          })
          .catch(() => {
            setServerError(true);
            setShowServerError(true);
            // Auto-hide the error popup after 10 seconds
            errorTimeout = setTimeout(() => {
              setShowServerError(false);
            }, 10000);
          });
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000); // Check every 30 seconds

    return () => {
      clearInterval(interval);
      clearTimeout(errorTimeout);
    };
  }, [selectedServer]);

  // Update the sources to use the current season and episode
  const sources = streamingService.getAllStreamingSources({
    type: content.media_type,
    tmdbId: content.id.toString(),
    season: currentSeason || 1,
    episode: currentEpisode || 1
  });

  // Group servers by provider and ensure we have valid URLs
  const groupedSources = sources.reduce((acc, source) => {
    if (!source.url) return acc;  // Skip invalid URLs
    
    if (source.name.includes('RGShows')) {
      if (!acc['RGShows']) acc['RGShows'] = [];
      acc['RGShows'].push(source);
    } else if (source.name.includes('VidSrc')) {
      if (!acc['VidSrc']) acc['VidSrc'] = [];
      acc['VidSrc'].push(source);
    } else if (source.name.includes('MoviesAPI')) {
      if (!acc['MoviesAPI']) acc['MoviesAPI'] = [];
      acc['MoviesAPI'].push(source);
    } else if (source.name.includes('Embed-API')) {
      if (!acc['Embed-API']) acc['Embed-API'] = [];
      acc['Embed-API'].push(source);
    }
    return acc;
  }, {} as Record<string, typeof sources>);

  useEffect(() => {
    // Set RGShows Server 3 as default if available, otherwise fallback to first available
    if (sources.length > 0 && !selectedServer) {
      const rgshows3 = sources.find(s => s.name === 'RGShows Server 3');
      if (rgshows3) {
        setSelectedServer(rgshows3.url);
        setServerError(false);
        return;
      }
      // Try each source in order until we find one that works
      const tryServer = async (source: { url: string; name: string }) => {
        try {
          const response = await fetch(source.url, { method: 'HEAD' });
          if (response.ok) {
            console.log(`Server ${source.name} is available`);
            setSelectedServer(source.url);
            setServerError(false);
            return true;
          }
        } catch (error) {
          console.warn(`Server ${source.name} is not available:`, error);
        }
        return false;
      };
      const initializeServer = async () => {
        // First try the saved server if available
        if (serverInfo?.server_url) {
          console.log(`Attempting to use saved server: ${serverInfo.server}`);
          const savedServer = sources.find(s => s.url === serverInfo.server_url);
          if (savedServer && await tryServer(savedServer)) {
            return;
          }
        }
        // Try each server in order until one works
        for (const source of sources) {
          if (await tryServer(source)) {
            break;
          }
        }
      };
      initializeServer();
    }
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [sources, selectedServer, serverInfo]);

  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Server Error Popup */}
      {showServerError && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-2 animate-fade-in text-sm max-w-md">
          <div className="w-4 h-4">⚠️</div>
          <p className="font-medium">Server not responding. Switch server?</p>
          <button 
            onClick={() => setShowServers(true)}
            className="ml-1 bg-white/20 hover:bg-white/30 px-2 py-1 rounded-md transition-colors text-xs"
          >
            Switch
          </button>
          <button 
            onClick={() => setShowServerError(false)}
            className="ml-1 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Video Section - Full Screen */}
      <div className="fixed inset-0 bg-black">
        {/* Loading Screen */}
        {loading && (
          <div className="absolute inset-0 bg-black z-30 flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-8" />
            <div className="flex items-center gap-2 text-purple-500">
              <MonitorPlay className="w-6 h-6" />
              <span className="text-lg font-medium">Loading Stream</span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-white/40">
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                <span className="text-sm">Secure Stream</span>
              </div>
              <div className="flex items-center gap-1">
                <Gauge className="w-4 h-4" />
                <span className="text-sm">High Quality</span>
              </div>
              <div className="flex items-center gap-1">
                <Wifi className="w-4 h-4" />
                <span className="text-sm">Auto-Adjust</span>
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
            {/* Servers Button */}
        <button
          onClick={() => setShowServers(!showServers)}
              className="px-3 py-2 bg-black/70 backdrop-blur-md text-white rounded-lg 
                         hover:bg-black/80 transition-all duration-200 border border-transparent hover:border-purple-500/20
                         flex items-center justify-between w-full text-xs"
        >
              <div className="flex items-center gap-1">
                <MonitorPlay className="w-4 h-4 text-purple-400" />
          <span>Servers</span>
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
                  <h3 className="font-medium text-xs text-white/90">Available Servers</h3>
                </div>
                <div className="max-h-[35vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {Object.entries(groupedSources).map(([provider, servers]) => (
                    <div key={provider} className="border-b border-white/10 last:border-b-0">
                      <button
                        onClick={() => setExpandedServer(expandedServer === provider ? null : provider)}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-xs font-medium text-white/90">{provider}</span>
                          <span className="text-[10px] text-white/40">{servers.length} Src</span>
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
                                setSelectedServer(server.url);
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
                  ))}
                </div>
              </div>
            )}
          </div>

        {/* History Button */}
        <button
          onClick={async () => {
            try {
              if (!content.id) {
                console.error('No content ID available');
                return;
              }

              // Ensure we have a valid media_type
              const mediaType = content.media_type === 'tv' || content.media_type === 'movie' 
                ? content.media_type 
                : 'movie';

              // Get current server name
              const currentServerName = selectedServer ? 
                Object.entries(groupedSources)
                  .find(([_, servers]) => servers.some(s => s.url === selectedServer))?.[0] 
                : 'Unknown';

              // Create history item
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

              // Use the context's addToWatchHistory function
              addToWatchHistory(historyItem);
              
              // Set flag to prevent duplicate additions
              hasAddedToHistory.current = true;

              // Show success message
              alert('Successfully added to watch history!');
            } catch (error) {
              console.error('Error adding to watch history:', error);
              alert('Failed to add to watch history. Please try again.');
            }
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