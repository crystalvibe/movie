import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Clock, Film, Tv, Trash2, Filter, Calendar, Server, X, Plus, Star } from 'lucide-react';
import { useWatchHistory } from '@/contexts/WatchHistoryContext';
import { Navigation } from '@/components/Navigation';
import { cn } from '@/lib/utils';
import { fetchWithParallelProxy } from '@/utils/proxyService';
import { Helmet } from 'react-helmet';
import { NotificationToast } from '@/components/NotificationToast';
import ProgressiveImage from '@/components/ProgressiveImage';

type FilterType = 'all' | 'movies' | 'tv';

// Image optimization settings
const IMAGE_SIZES = {
  poster: {
    small: 'w200',
    medium: 'w500',
    large: 'original'
  },
  backdrop: {
    small: 'w300',
    medium: 'w1280',
    large: 'original'
  }
};

// Add image optimization utility for progressive loading
const getOptimizedImageUrl = (path: string, type = 'poster', size = 'medium') => {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
  const sizeStr = IMAGE_SIZES[type][size];
  return `https://image.tmdb.org/t/p/${sizeStr}${path}`;
};

const WatchHistory = () => {
  const { watchHistory, clearWatchHistory, removeFromWatchHistory } = useWatchHistory();
  const [enrichedHistory, setEnrichedHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedContent, setSelectedContent] = useState<any | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const navigate = useNavigate();

  // Direct check of what's in localStorage
  useEffect(() => {
    const rawData = localStorage.getItem('watchHistory');
    console.log('Raw localStorage data:', rawData);
    
    if (rawData) {
      try {
        const parsedData = JSON.parse(rawData);
        console.log('Parsed localStorage data:', parsedData);
        console.log('Number of items in localStorage:', Array.isArray(parsedData) ? parsedData.length : 'Not an array');
      } catch (error) {
        console.error('Error parsing localStorage data:', error);
      }
    } else {
      console.log('No watchHistory found in localStorage');
    }
  }, []);

  // Listen for storage changes from other components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'watchHistory') {
        console.log('Storage event detected - localStorage watchHistory changed');
        
        if (e.newValue) {
          try {
            const newData = JSON.parse(e.newValue);
            console.log('New watchHistory data from storage event:', newData);
            setEnrichedHistory([]); // Clear current history
            setLoading(true); // Trigger a new fetch
          } catch (error) {
            console.error('Error parsing new watchHistory data:', error);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const fetchDetails = async () => {
      if (watchHistory.length === 0) {
        setLoading(false);
        setEnrichedHistory([]);
        console.log("No watch history found");
        return;
      }

      setLoading(true);
      console.log(`Fetching details for ${watchHistory.length} history items...`);

      try {
        const endpoints = watchHistory.map(item => `/${item.media_type}/${item.id}`);
        
        // Function to retry failed requests
        const fetchWithRetry = async (endpoint: string, retries = 3) => {
          for (let i = 0; i < retries; i++) {
            try {
              const data = await fetchWithParallelProxy(endpoint);
              return data;
            } catch (error) {
              console.error(`Attempt ${i + 1} failed for ${endpoint}:`, error);
              if (i === retries - 1) throw error;
              await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, i), 5000)));
            }
          }
        };

        console.log(`Fetching ${endpoints.length} items with retry logic...`);
        const responses = await Promise.allSettled(
          endpoints.map(endpoint => fetchWithRetry(endpoint))
        );

        const detailedItems = responses.map((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            return {
              ...result.value,
              ...watchHistory[index],
              title: result.value.title || result.value.name || watchHistory[index].title || "Unknown"
            };
          } else {
            console.log(`Failed to fetch item at index ${index}:`, result);
            return {
              ...watchHistory[index],
              title: watchHistory[index].title || "Unknown",
              _fetchFailed: true
            };
          }
        });

        console.log(`Processed ${detailedItems.length} items, ${detailedItems.filter(item => !item._fetchFailed).length} successful`);
        setEnrichedHistory(detailedItems);
        setLoadingError(null);
        setIsInitialLoad(false);
      } catch (error) {
        console.error("Error fetching history details:", error);
        setEnrichedHistory(watchHistory.map(item => ({
          ...item,
          title: item.title || "Unknown",
          _fetchFailed: true
        })));
        setLoadingError('Failed to load watch history. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [watchHistory]);

  const handleContinueWatching = (item: any) => {
    if (!item.id) {
      console.error("Cannot continue watching: missing item ID");
      return;
    }
    
    console.log("Continuing to watch:", item);
    
    const stateData = {
      content: {
        id: item.id,
        media_type: item.media_type,
        title: item.title,
        poster_path: item.poster_path,
        name: item.title
      },
      server_info: {
        server: item.server,
        server_url: item.server_url
      }
    };
    
    if (item.media_type === 'tv') {
      console.log(`Navigating to TV show: ID=${item.id}, S${item.season}, E${item.episode}, Server=${item.server}`);
      navigate(`/watch?id=${item.id}&type=tv&season=${item.season || 1}&episode=${item.episode || 1}`, {
        state: stateData
      });
    } else {
      console.log(`Navigating to movie: ID=${item.id}, Server=${item.server}`);
      navigate(`/watch?id=${item.id}&type=movie`, {
        state: stateData
      });
    }
  };

  const handleRemoveItem = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (item.id && item.media_type) {
      removeFromWatchHistory(item.id, item.media_type);
    }
  };

  const handleClearHistory = () => {
    clearWatchHistory();
    setEnrichedHistory([]);
    setIsConfirmClearOpen(false);
  };

  const formatLastWatched = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredHistory = enrichedHistory.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'movies') return item.media_type === 'movie';
    return item.media_type === filter;
  });

  // Update loading state component with transition effects
  const LoadingState = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[...Array(8)].map((_, i) => (
        <div 
          key={i}
          className="glass-card overflow-hidden animate-pulse"
        >
          <div className="aspect-video bg-white/10" />
          <div className="p-5">
            <div className="h-5 bg-white/10 rounded w-3/4 mb-3" />
            <div className="h-4 bg-white/10 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  // Add error state component
  const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <div className="text-xl text-white/90">{message}</div>
      <button 
        onClick={onRetry}
        className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
      >
        Try Again
      </button>
    </div>
  );

  // Content Card Component
  const ContentCard = ({ item }: { item: any }) => (
    <div
      onClick={() => handleContinueWatching(item)}
      className="glass-card overflow-hidden cursor-pointer transition-all duration-300 group hover:border-violet-600/30 hover:shadow-lg hover:shadow-violet-500/10 transform hover:scale-[1.02]"
    >
      <div className="aspect-video relative">
        {(item.backdrop_path || item.poster_path) ? (
          <img
            src={getOptimizedImageUrl(item.backdrop_path || item.poster_path, 'backdrop', 'medium')}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-600/30 to-black/50 flex items-center justify-center">
            <span className="text-lg font-medium">{item.title || "Untitled"}</span>
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/30 backdrop-blur-sm">
          <div 
            className="h-full bg-violet-600"
            style={{ width: `${item.progress || 0}%` }}
          />
        </div>
        
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-violet-600 rounded-full p-3 transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-6 h-6" fill="white" />
          </div>
        </div>
        
        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-2">
          {item.media_type === 'movie' ? (
            <>
              <Film className="w-4 h-4" />
              <span>Movie</span>
            </>
          ) : (
            <>
              <Tv className="w-4 h-4" />
              <span>
                {item.season !== undefined && item.episode !== undefined 
                  ? `S${item.season} E${item.episode}` 
                  : 'TV Show'}
              </span>
            </>
          )}
        </div>
        
        <button
          className="absolute top-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-lg text-white/70 hover:text-white/100 transition-all duration-300 opacity-0 group-hover:opacity-100"
          onClick={(e) => handleRemoveItem(e, item)}
          aria-label="Remove from history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-5">
        <h3 className="text-lg font-semibold leading-tight mb-2 line-clamp-1">
          {item.title}
        </h3>
        
        <div className="flex justify-between items-center text-sm text-white/60">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <time dateTime={new Date(item.watched_at).toISOString()}>
              {new Date(item.watched_at).toLocaleDateString()}
            </time>
          </div>
          
          {item.media_type === 'tv' && item.season !== undefined && (
            <div className="bg-white/10 rounded-lg px-2.5 py-1">
              {`Latest: S${item.season} E${item.episode}`}
            </div>
          )}
        </div>
        
        {item.server && (
          <div className="mt-3 flex items-center gap-2 text-sm text-white/50">
            <Server className="w-4 h-4" />
            <span className="truncate">{item.server}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <Helmet>
        <title>Watch History | PULSE cinema</title>
      </Helmet>
      
      <Navigation onSearchStateChange={setIsSearchOpen} />

      {/* Background Layer */}
      <div className="fixed inset-0 z-0 w-full h-full overflow-hidden">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-slate-950 to-slate-950" />
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/30 rounded-full filter blur-[120px] animate-float" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-rose-500/20 rounded-full filter blur-[100px] animate-float-delayed" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="absolute inset-0 bg-noise opacity-[0.15]" />
        </div>
      </div>
      
      {/* Content Layer */}
      <div className="relative z-10">
        <NotificationToast />
        
        <div className="container mx-auto px-6 pt-32 pb-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-16 gap-6">
            <h1 className="title-serif text-4xl sm:text-5xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Your Watch History
            </h1>
            
            <div className="flex items-center gap-4">
              {/* Filter buttons */}
              <div className="flex items-center bg-white/5 backdrop-blur-sm rounded-lg p-1.5">
                <button
                  onClick={() => setFilter('all')}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300",
                    filter === 'all' ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25" : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('movies')}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2",
                    filter === 'movies' ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25" : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Film className="w-4 h-4" />
                  <span>Movies</span>
                </button>
                <button
                  onClick={() => setFilter('tv')}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2",
                    filter === 'tv' ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25" : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Tv className="w-4 h-4" />
                  <span>TV Shows</span>
                </button>
              </div>
              
              {/* Clear history button */}
              {watchHistory.length > 0 && (
                <button
                  onClick={() => setIsConfirmClearOpen(true)}
                  className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </div>
          
          {loading ? (
            <LoadingState />
          ) : loadingError ? (
            <ErrorState 
              message={loadingError}
              onRetry={() => {
                setIsInitialLoad(true);
                setRetryCount(0);
              }}
            />
          ) : filteredHistory.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredHistory.map((item) => (
                <ContentCard
                  key={`${item.id}-${item.media_type}-${item.season}-${item.episode}`}
                  item={item}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-32">
              <h2 className="title-serif text-2xl font-medium text-white/80 mb-3">
                Start watching to build your history
              </h2>
            </div>
          )}
        </div>
      </div>
      
      {/* Confirm Clear History Modal */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card p-8 max-w-md w-full rounded-xl">
            <h2 className="title-serif text-2xl font-bold mb-4">Clear Watch History?</h2>
            <p className="text-white/70 text-lg mb-8">
              This will permanently remove all items from your watch history. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-6 py-2.5 text-sm font-medium border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="px-6 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchHistory; 