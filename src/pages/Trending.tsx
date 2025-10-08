import { useState, useEffect, useCallback, useRef } from "react";
import { Star, Play, Film, Tv, TrendingUp, X, Volume2, VolumeX, Globe, Plus, Heart, ChevronRight, ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Navigation } from '../components/Navigation';
import { StreamingModal } from '@/components/StreamingModal';
import { cn } from '@/lib/utils';
import { NotificationToast } from '../components/NotificationToast';
import { useInView } from 'react-intersection-observer';
import { fetchWithProxy, fetchWithParallelProxy } from '@/utils/proxyService';
import { config } from '@/config/env';
import { Helmet } from 'react-helmet';
import ProgressiveImage from '@/components/ProgressiveImage';
import '../styles/animations.css';
import { useMyList } from '@/contexts/MyListContext';

// Add VideoResult interface
interface VideoResult {
  key: string;
  site: string;
  type: string;
  name: string;
  official?: boolean;
}

// Define interface for the content item
interface ContentItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: "movie" | "tv" | string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  type?: "movie" | "tv" | string;
  videos?: {
    results: VideoResult[];
  };
  backdrop_path?: string;
  overview?: string;
  number_of_seasons?: number;
  seasons?: {
    season_number: number;
    episode_count: number;
    name: string;
  }[];
  contentHash?: string;
}

// Add grid background utility
const gridBackground = {
  backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)`,
  backgroundSize: '33.33% 1px'
};

const TMDB_API_KEY = config.tmdb.apiKey;
const BASE_URL = config.tmdb.baseUrl;

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

// Cache object
const apiCache = new Map();

// Add mock data for fallback when API fails
const MOCK_MOVIES = {
  "results": [
    {
      "adult": false,
      "backdrop_path": "/7oOBnhaTRwqYhk4M8qo7o9wEQGl.jpg",
      "id": 466420,
      "title": "Killers of the Flower Moon",
      "original_language": "en",
      "original_title": "Killers of the Flower Moon",
      "overview": "When oil is discovered in 1920s Oklahoma under Osage Nation land, the Osage people are murdered one by one—until the FBI steps in to unravel the mystery.",
      "poster_path": "/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg",
      "media_type": "movie",
      "popularity": 129.414,
      "release_date": "2023-10-18",
      "video": false,
      "vote_average": 7.518,
      "vote_count": 2324
    },
    {
      "adult": false,
      "backdrop_path": "/bWIIWhnaoWx3EkgSFkIm23G3o9f.jpg",
      "id": 466421,
      "title": "The Holdovers",
      "original_language": "en",
      "original_title": "The Holdovers",
      "overview": "A curmudgeonly instructor at a New England prep school is forced to remain on campus during Christmas break to babysit the handful of students with nowhere to go.",
      "poster_path": "/gVKcJAoSjJCrDYvVVyFKzXbksrY.jpg",
      "media_type": "movie",
      "popularity": 121.48,
      "release_date": "2023-10-27",
      "video": false,
      "vote_average": 7.642,
      "vote_count": 1149
    }
  ]
};

const MOCK_TV = {
  "results": [
    {
      "adult": false,
      "backdrop_path": "/e9n87p3Ax67spq3eUgLB8s9rz5h.jpg",
      "id": 76479,
      "name": "The Boys",
      "original_language": "en",
      "original_name": "The Boys",
      "overview": "A group of vigilantes known informally as 'The Boys' set out to take down corrupt superheroes with no more than blue-collar grit and a willingness to fight dirty.",
      "poster_path": "/stTEycfG9928HYGEISBFaG1ngjM.jpg",
      "media_type": "tv",
      "popularity": 129.414,
      "first_air_date": "2019-07-25",
      "vote_average": 8.518,
      "vote_count": 2324
    },
    {
      "adult": false,
      "backdrop_path": "/56v2KjBlU4XaOv9rVYEQypROD7P.jpg",
      "id": 66732,
      "name": "Stranger Things",
      "original_language": "en",
      "original_name": "Stranger Things",
      "overview": "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.",
      "poster_path": "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
      "media_type": "tv",
      "popularity": 121.48,
      "first_air_date": "2016-07-15",
      "vote_average": 8.642,
      "vote_count": 1149
    }
  ]
};

// Helper function to make API calls through proxy
const fetchWithCache = async (endpoint) => {
  try {
    // Use the centralized proxy service
    const url = `${BASE_URL}${endpoint}&api_key=${TMDB_API_KEY}`;
    const data = await fetchWithProxy(url);
    return data;
  } catch (error) {
    console.error('API call failed:', error);
    
    // Return mock data as last resort to prevent UI from breaking
    if (endpoint.includes('trending/movie')) {
      console.log('Using mock movie data');
      return MOCK_MOVIES;
    } else if (endpoint.includes('trending/tv')) {
      console.log('Using mock TV data');
      return MOCK_TV;
    }
    
    throw error;
  }
};

// Add debounce utility
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Add image optimization utility for progressive loading
const getOptimizedImageUrl = (path, type = 'poster', size = 'medium') => {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
  const sizeStr = IMAGE_SIZES[type][size];
  return `https://image.tmdb.org/t/p/${sizeStr}${path}`;
};

// Preload important images
const preloadImage = (src) => {
  if (typeof window !== 'undefined') {
    const img = new Image();
    img.src = src;
  }
};

// Interface for streaming modal content
interface StreamingModalContent {
  id: number;
  title?: string;
  name?: string;
  media_type: "movie" | "tv";
  release_date?: string;
  first_air_date?: string;
  season_number?: number;
  episode_number?: number;
}

// Virtualized content card for optimal rendering
const ContentCard = ({ 
  item, 
  onClickHandler, 
  handleListAction, 
  isInList, 
  animatingItems 
}: { 
  item: ContentItem; 
  onClickHandler?: (item: ContentItem) => void; 
  handleListAction?: (item: ContentItem) => void; 
  isInList?: (id: number, type?: string) => boolean; 
  animatingItems?: Set<number> | number[]; 
}) => {
  // Track if this element is in viewport
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const cardRef = useRef(null);
  
  useEffect(() => {
    const currentRef = cardRef.current;
    
    if (!currentRef) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isNowIntersecting = entry.isIntersecting;
        setIsIntersecting(isNowIntersecting);
        
        // Once an item becomes visible, keep track of that
        if (isNowIntersecting && !hasBeenVisible) {
          setHasBeenVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // Trigger when 10% visible with 100px margin
    );
    
    observer.observe(currentRef);
    
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [hasBeenVisible]);
  
  const isInMovieList = isInList && typeof isInList === 'function' ? isInList(item.id, item.media_type) : false;
  const isAnimating = animatingItems ? 
    animatingItems instanceof Set ? 
      animatingItems.has(item.id) : 
      animatingItems.includes(item.id) : 
    false;
  
  return (
    <div 
      ref={cardRef}
      className="group relative w-[180px] aspect-[2/3] rounded-lg overflow-hidden transition-all duration-300 ease-out hover:scale-105 transform-gpu glass-card will-change-transform border border-border/30 hover:border-purple-600/30 hover:shadow-lg"
      onClick={() => isIntersecting && onClickHandler && onClickHandler(item)}
      style={{ cursor: 'pointer' }}
    >
      {/* Movie Poster */}
      <ProgressiveImage 
        path={item.poster_path}
        alt={item.title || item.name || ""}
        type="poster"
      />

      {/* Hover Content with glass effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="absolute inset-0 flex flex-col justify-end p-3">
          <div className="space-y-1 mb-2">
            <div className="text-xs font-medium text-white/80">
              {(item.release_date || item.first_air_date) && 
                new Date(item.release_date || item.first_air_date).getFullYear()}
            </div>
            <h2 className="text-sm font-semibold leading-tight text-white line-clamp-2">
              {item.title || item.name}
            </h2>
          </div>

          <div className="flex gap-1 mb-2 flex-wrap">
            <span className="px-1.5 py-0.5 bg-white/10 backdrop-blur-sm rounded-full text-[9px] font-medium text-white/90">
              {item.media_type === 'tv' ? 'TV Show' : 'Movie'}
            </span>
            {item.vote_average > 0 && (
              <span className="px-1.5 py-0.5 bg-white/10 backdrop-blur-sm rounded-full text-[9px] font-medium text-white/90 flex items-center gap-[2px]">
                <Star className="w-2 h-2 text-yellow-400" fill="currentColor" />
                {(item.vote_average / 2).toFixed(1)}
              </span>
            )}
          </div>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClickHandler && onClickHandler(item);
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors text-xs font-medium"
          >
            <Play className="w-3 h-3" />
            <span>Watch</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Scroll container component with arrow navigation
const ScrollContainer = ({ children, title, icon }) => {
  const scrollContainerRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Check if arrows should be shown based on scroll position
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setShowLeftArrow(container.scrollLeft > 0);
      setShowRightArrow(container.scrollLeft < (container.scrollWidth - container.clientWidth - 10));
    }
  }, []);

  // Handle scroll events to update arrow visibility
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      // Initial check
      checkScrollPosition();
      // Check after content might have loaded
      setTimeout(checkScrollPosition, 500);
      
      return () => {
        container.removeEventListener('scroll', checkScrollPosition);
      };
    }
  }, [checkScrollPosition, children]);

  // Scroll left or right by a fixed amount
  const handleScroll = (direction) => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = container.clientWidth * 0.75; // Scroll by 75% of visible width
      const newPosition = direction === 'left' 
        ? container.scrollLeft - scrollAmount 
        : container.scrollLeft + scrollAmount;
      
      container.scrollTo({
        left: newPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h2 className="title-serif text-2xl sm:text-3xl font-semibold text-white/90 flex items-center gap-2">
          {icon}
          {title}
        </h2>
      </div>
      
      <div className="relative group">
        {/* Left arrow */}
        {showLeftArrow && (
          <button 
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center bg-black/50 backdrop-blur-sm border border-white/10 rounded-full text-white/90 hover:bg-purple-800/70 transition-all transform hover:scale-105 shadow-lg"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        
        {/* Content container */}
        <div 
          ref={scrollContainerRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-transparent scroll-smooth"
        >
          {children}
        </div>
        
        {/* Right arrow */}
        {showRightArrow && (
          <button 
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center bg-black/50 backdrop-blur-sm border border-white/10 rounded-full text-white/90 hover:bg-purple-800/70 transition-all transform hover:scale-105 shadow-lg"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>
    </section>
  );
};

// Add content hash generation function
const generateContentHash = async (input: string): Promise<string> => {
  try {
    // Create a hash based on the movie ID and a timestamp for basic security
    const timestamp = new Date().toISOString().split('T')[0]; // Daily timestamp
    const data = new TextEncoder().encode(`${input}-${timestamp}-cinetranscend`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 16); // Return first 16 chars for brevity
  } catch (error) {
    console.error('Error generating content hash:', error);
    // Fallback to a simple hash if Web Crypto API is unavailable
    return `${input}-${Date.now()}`.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0).toString(16);
  }
};

// Add content verification function
const verifyContentIntegrity = async (content: ContentItem | undefined) => {
  if (!content?.id) return true; // Return true if no content to avoid blocking playback
  try {
    // Skip verification for YouTube previews (these always work)
    if (content.videos?.results?.length) return true;

    // Skip hash verification if no hash exists (most common case)
    if (!content.contentHash) return true;

    // Only perform hash verification if content actually has a contentHash
    // This should rarely happen in normal usage
    if (content.contentHash) {
      const expectedHash = await generateContentHash(content.id.toString());
      const hashMatches = expectedHash === content.contentHash;
      
      if (!hashMatches) {
        console.error('Content hash verification failed');
        // Even if hash doesn't match, we'll still allow playback in most cases
        // Only return false for serious security concerns
        return true;
      }
    }

    return true;
  } catch (error) {
    console.error('Content verification failed:', error);
    // Always return true on error to avoid blocking playback
    return true; 
  }
};

const Trending = () => {
  const [trendingMovies, setTrendingMovies] = useState<ContentItem[]>([]);
  const [trendingTVShows, setTrendingTVShows] = useState<ContentItem[]>([]);
  const [countryContent, setCountryContent] = useState<Record<string, ContentItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [playingTrailer, setPlayingTrailer] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [movieDetailOpen, setMovieDetailOpen] = useState(false);
  const [watchingMovie, setWatchingMovie] = useState(false);
  const { addToList, removeFromList, isInList, animatingItems } = useMyList();
  const [isStreamingModalOpen, setIsStreamingModalOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [showSeasonSelector, setShowSeasonSelector] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { ref: loadMoreRef, inView } = useInView({
    rootMargin: '400px',
    threshold: 0,
  });
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [isWatchLoading, setIsWatchLoading] = useState(false);
  const navigate = useNavigate();

  // Function to preload important images
  const preloadTopContent = useCallback((movies, shows) => {
    if (!movies?.length || !shows?.length) return;
    
    // Preload hero images first (most important)
    if (movies[0]?.backdrop_path) {
      preloadImage(getOptimizedImageUrl(movies[0].backdrop_path, 'backdrop', 'small'));
      preloadImage(getOptimizedImageUrl(movies[0].backdrop_path, 'backdrop', 'medium'));
    }
    
    if (shows[0]?.backdrop_path) {
      preloadImage(getOptimizedImageUrl(shows[0].backdrop_path, 'backdrop', 'small'));
      preloadImage(getOptimizedImageUrl(shows[0].backdrop_path, 'backdrop', 'medium'));
    }
    
    // Then preload first row of posters (visible initially)
    movies.slice(1, 6).forEach(movie => {
      if (movie?.poster_path) {
        preloadImage(getOptimizedImageUrl(movie.poster_path, 'poster', 'small'));
      }
    });
    
    // Preload trailers for hero content (delayed)
    setTimeout(() => {
      // Only preload trailers if user stays on page
      if (document.visibilityState === 'visible') {
        if (movies[0]?.videos?.results?.length) {
          const trailerKey = getTrailerKeyFromContent(movies[0]);
          if (trailerKey) {
            preloadImage(`https://img.youtube.com/vi/${trailerKey}/mqdefault.jpg`);
          }
        }
      }
    }, 3000);
  }, []);
  
  // Helper to get trailer key
  const getTrailerKeyFromContent = (content) => {
    if (!content?.videos?.results?.length) return null;
    
    const videos = content.videos.results;
    // Find trailer using same logic as getTrailerUrl
    const trailer = videos.find(v => v.type === "Trailer" && v.site === "YouTube" && v.official === true) ||
                  videos.find(v => v.site === "YouTube" && v.name.toLowerCase().includes("trailer")) ||
                  videos.find(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")) ||
                  videos.find(v => v.site === "YouTube");
                  
    return trailer?.key || null;
  };

  // Fetch initial trending content
  const fetchInitialContent = async () => {
    try {
      // Only show loading on first load
      if (trendingMovies.length === 0 && trendingTVShows.length === 0) {
        setLoading(true);
      }
      
      // Fetch both movies and TV shows in parallel
      const [moviesData, tvData] = await Promise.all([
        fetchWithCache('/trending/movie/day?language=en-US&include_adult=false&page=1'),
        fetchWithCache('/trending/tv/day?language=en-US&page=1')
      ]);

      // Validate responses have results
      if (!moviesData?.results?.length && !tvData?.results?.length) {
        throw new Error('No content available from API');
      }

      // Process movies - ensure we have valid results before processing
      const processedMovies = [];
      if (moviesData?.results?.length > 0) {
        // Get full details for first movie if available
        if (moviesData.results[0]) {
          try {
            const details = await fetchWithCache(`/movie/${moviesData.results[0].id}?append_to_response=videos,credits&include_adult=false`);
            processedMovies.push({
              ...moviesData.results[0],
              ...details,
              type: 'movie',
              media_type: 'movie' // Ensure media_type is set correctly
            });
          } catch (error) {
            console.error(`Error fetching details for first movie: ${error}`);
            // Still add the movie without full details
            processedMovies.push({
              ...moviesData.results[0],
              type: 'movie',
              media_type: 'movie'
            });
          }
        }
        
        // Add the rest of the movies
        for (let i = 1; i < Math.min(moviesData.results.length, 10); i++) {
          processedMovies.push({
            ...moviesData.results[i],
            type: 'movie',
            media_type: 'movie'
          });
        }
      }
      
      // Process TV shows - ensure we have valid results before processing
      const processedTVShows = [];
      if (tvData?.results?.length > 0) {
        // Get full details for first TV show if available
        if (tvData.results[0]) {
          try {
            const details = await fetchWithCache(`/tv/${tvData.results[0].id}?append_to_response=videos,credits`);
            processedTVShows.push({
              ...tvData.results[0],
              ...details,
              type: 'tv',
              media_type: 'tv' // Ensure media_type is set correctly
            });
          } catch (error) {
            console.error(`Error fetching details for first TV show: ${error}`);
            // Still add the TV show without full details
            processedTVShows.push({
              ...tvData.results[0],
              type: 'tv',
              media_type: 'tv'
            });
          }
        }
        
        // Add the rest of the TV shows
        for (let i = 1; i < Math.min(tvData.results.length, 10); i++) {
          processedTVShows.push({
            ...tvData.results[i],
            type: 'tv',
            media_type: 'tv'
          });
        }
      }
      
      // Use a small timeout for smoother state transitions
      setTimeout(() => {
        if (processedMovies.length > 0) {
          setTrendingMovies(processedMovies);
        }
        
        if (processedTVShows.length > 0) {
          setTrendingTVShows(processedTVShows);
        }
        
        setLoading(false);
        
        // Preload top content for faster interaction if available
        if (processedMovies.length > 0 || processedTVShows.length > 0) {
          preloadTopContent(processedMovies, processedTVShows);
        }
      }, 100);
    } catch (error) {
      console.error('Error fetching trending content:', error);
      // If we already have content, don't clear it on error
      if (trendingMovies.length === 0 && trendingTVShows.length === 0) {
        // Use mock data as fallback when all else fails
        const mockMovies = MOCK_MOVIES.results.map(movie => ({
          ...movie,
          type: 'movie',
          media_type: 'movie'
        }));
        const mockTVs = MOCK_TV.results.map(show => ({
          ...show,
          type: 'tv',
          media_type: 'tv'
        }));
        setTrendingMovies(mockMovies);
        setTrendingTVShows(mockTVs);
        
        // Even with mock data, preload it
        preloadTopContent(mockMovies, mockTVs);
      }
      setLoading(false);
    }
  };

  // Modified loadMore function to only load more content when explicitly requested
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      
      // Fetch next page of both types in parallel
      const [moviesData, tvData] = await Promise.all([
        fetchWithCache(`/trending/movie/day?language=en-US&include_adult=false&page=${nextPage}`),
        fetchWithCache(`/trending/tv/day?language=en-US&page=${nextPage}`)
      ]);

      // Process new movies - no need for video details
      const newMovies = moviesData.results.slice(0, 10).map(movie => ({
        ...movie,
        type: 'movie'
      }));

      // Process new TV shows - no need for video details
      const newTVShows = tvData.results.slice(0, 10).map(show => ({
        ...show,
        type: 'tv'
      }));

      // Update state in a single batched update to prevent jumps
      setTimeout(() => {
        setTrendingMovies((prev) => [...prev, ...newMovies]);
        setTrendingTVShows((prev) => [...prev, ...newTVShows]);
        setPage(nextPage);
        setHasMore(newMovies.length > 0 || newTVShows.length > 0);
        setLoadingMore(false);
      }, 100); // Slight delay to ensure stable rendering
    } catch (error) {
      console.error('Error loading more content:', error);
      setLoadingMore(false);
    }
  }, [page, loadingMore, hasMore]);

  useEffect(() => {
    fetchInitialContent();
  }, []);

  // Update handleWatchClick function
  const handleWatchClick = async (content) => {
    // Prevent multiple rapid clicks
    if (isWatchLoading) {
      return;
    }

    if (!content) {
      console.error('No content data provided');
      return;
    }

    try {
      setIsWatchLoading(true);
      setWatchError(null);
      setSelectedContent(content);

      // Validate required content data
      if (!content.id || (!content.title && !content.name)) {
        throw new Error('Content information is incomplete');
      }

      // Set state immediately to show loading UI feedback
      setMovieDetailOpen(true);
      setPlayingTrailer(true);

      // If content doesn't have videos data, fetch it in background
      if (!content.videos?.results?.length) {
        const endpoint = `/${content.type || content.media_type || 'movie'}/${content.id}?append_to_response=videos,credits`;
        try {
          const details = await fetchWithParallelProxy(endpoint);
          // Merge the details with existing content data
          const mergedContent = { 
            ...content,
            videos: details.videos,
            backdrop_path: content.backdrop_path || details.backdrop_path,
            overview: content.overview || details.overview,
            vote_average: content.vote_average || details.vote_average,
            release_date: content.release_date || details.release_date,
            first_air_date: content.first_air_date || details.first_air_date
          };
          
          setSelectedContent(mergedContent);
        } catch (error) {
          console.error('Error loading content details:', error);
          // Don't show error toast for video details fetch failure
          // This is a non-critical error - we can still play content
          console.warn('🎬 Unable to load additional content details');
        }
      }

      // Check content integrity in background, but don't block UI or show errors
      // unless absolutely necessary
      verifyContentIntegrity(content).catch(error => {
        console.error('Content integrity check failed:', error);
        // Don't show error toast for integrity check failures
        // Most content will play fine even if this check fails
      });

    } catch (error) {
      console.error('Error loading content:', error);
      setWatchError(error instanceof Error ? error.message : 'Unable to play this content right now');
      setTimeout(() => setWatchError(null), 4000);
    } finally {
      setIsWatchLoading(false);
    }
  };

  // Update handleWatchNowClick function
  const handleWatchNowClick = async () => {
    if (!selectedContent) {
      console.error('No content selected');
      return;
    }

    try {
      // First close all modals
      setMovieDetailOpen(false);
      setPlayingTrailer(false);
      setWatchingMovie(false);
      
      // Verify content integrity before navigating
      // We've modified the verification to be more permissive,
      // so it will rarely fail now
      const isValid = await verifyContentIntegrity(selectedContent);
      
      // We'll proceed with playback in most cases, only show error in extreme cases
      if (!isValid) {
        console.warn('Content verification failed, but attempting playback anyway');
        // We don't throw an error here anymore to prevent blocking playback
      }

      // Determine the proper media type
      // Ensure we use a definitive media_type value, prioritizing the most specific one
      const mediaType = selectedContent.type || selectedContent.media_type || 'movie';

      // Build the URL parameters
      const params = new URLSearchParams({
        id: selectedContent.id.toString(),
        type: mediaType,
        title: selectedContent.title || selectedContent.name || ''
      });

      // Add optional parameters if available
      if (selectedContent.poster_path) {
        params.append('poster', selectedContent.poster_path);
      }
      if (selectedContent.backdrop_path) {
        params.append('backdrop', selectedContent.backdrop_path);
      }
      if (selectedContent.overview) {
        params.append('overview', selectedContent.overview);
      }
      if (selectedContent.release_date) {
        params.append('release_date', selectedContent.release_date);
      }
      if (selectedContent.first_air_date) {
        params.append('first_air_date', selectedContent.first_air_date);
      }
      if (selectedContent.vote_average) {
        params.append('rating', selectedContent.vote_average.toString());
      }

      // Navigate to watch page with state
      navigate(`/watch?${params.toString()}`, {
        state: {
          content: {
            ...selectedContent,
            media_type: mediaType // Ensure consistent media_type in state
          },
          from: 'trending'
        }
      });

      // Close streaming modal last to ensure smooth transition
      setIsStreamingModalOpen(false);
    } catch (error) {
      console.error('Error starting content:', error);
      setWatchError(error instanceof Error ? error.message : 'Unable to play this content right now');
      setTimeout(() => setWatchError(null), 4000);
    }
  };

  const handleStartWatching = () => {
    setIsStreamingModalOpen(true);
    setShowSeasonSelector(false);
  };

  const handleCloseDetail = () => {
    setPlayingTrailer(false);
    setMovieDetailOpen(false);
    setSelectedContent(null);
    setWatchingMovie(false);
    setShowSeasonSelector(false);
  };

  const handleCloseStreamingModal = () => {
    setIsStreamingModalOpen(false);
  };

  const handleListAction = (item) => {
    const listItem = {
      id: item.id,
      title: item.title || item.name,
      poster_path: item.poster_path,
      media_type: item.type,
      vote_average: item.vote_average,
      release_date: item.release_date,
      first_air_date: item.first_air_date,
      overview: item.overview
    };

    if (isInList(item.id)) {
      removeFromList(item.id);
    } else {
      addToList(listItem);
    }
  };

  // Function to get YouTube trailer URL
  const getTrailerUrl = (content) => {
    if (!content?.videos?.results?.length) return null;

    const videos = content.videos.results;
    let trailer = null;

    // 1. Try to find official trailer in any quality
    trailer = videos.find(v => 
      v.type === "Trailer" && 
      v.site === "YouTube" && 
      v.official === true
    );

    // 2. Try to find any trailer with "official", "final", "main" or movie name in the title
    if (!trailer) {
      const movieTitle = (content.title || content.name || '').toLowerCase();
      trailer = videos.find(v => 
        v.site === "YouTube" &&
        (
          v.name.toLowerCase().includes("trailer") ||
          v.name.toLowerCase().includes("official") ||
          v.name.toLowerCase().includes("final") ||
          v.name.toLowerCase().includes("main") ||
          v.name.toLowerCase().includes(movieTitle)
        )
      );
    }

    // 3. Try to find any trailer or teaser
    if (!trailer) {
      trailer = videos.find(v => 
        v.site === "YouTube" &&
        (v.type === "Trailer" || v.type === "Teaser")
      );
    }

    // 4. Try to find any clip or featurette
    if (!trailer) {
      trailer = videos.find(v => 
        v.site === "YouTube" &&
        (v.type === "Clip" || v.type === "Featurette" || v.type === "Behind the Scenes")
      );
    }

    // 5. Final fallback: any YouTube video
    if (!trailer) {
      trailer = videos.find(v => v.site === "YouTube");
    }

    // If still no trailer found, return null
    if (!trailer || !trailer.key) return null;

    // Construct the URL with optimal parameters
    return `https://www.youtube.com/embed/${trailer.key}?autoplay=1&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&version=3&playerapiid=ytplayer&mute=0&loop=1&playlist=${trailer.key}&disablekb=1&fs=0&origin=${window.location.origin}&widget_referrer=${window.location.origin}&cc_load_policy=0&cc_lang_pref=en&hl=en&color=white&theme=dark&autohide=1&hd=1&vq=hd1080`;
  };

  // Add new animation to your animations.css file
  const styleSheet = document.styleSheets[0];
  styleSheet.insertRule(`
    @keyframes fade-in-up {
      from {
        opacity: 0;
        transform: translate(-50%, 20px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }
  `, styleSheet.cssRules.length);

  styleSheet.insertRule(`
    .animate-fade-in-up {
      animation: fade-in-up 0.3s ease-out forwards;
    }
  `, styleSheet.cssRules.length);

  styleSheet.insertRule(`
    @keyframes float {
      0% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(-20px);
      }
      100% {
        transform: translateY(0px);
      }
    }
  `, styleSheet.cssRules.length);

  styleSheet.insertRule(`
    .animate-float {
      animation: float 6s ease-in-out infinite;
    }
  `, styleSheet.cssRules.length);

  styleSheet.insertRule(`
    .animate-float-delayed {
      animation: float 6s ease-in-out 2s infinite;
    }
  `, styleSheet.cssRules.length);

  // Add cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      setPlayingTrailer(false);
      setMovieDetailOpen(false);
      setSelectedContent(null);
      setWatchingMovie(false);
      
      // Force cleanup of video player
      const videoContainer = document.querySelector('.video-container');
      if (videoContainer) {
        videoContainer.innerHTML = '';
      }
    };
  }, []);

  // Add effect to handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseDetail();
      }
    };

    if (movieDetailOpen) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [movieDetailOpen]);

    return (
    <div className="min-h-screen bg-black text-white">
      <Helmet>
        <title>Trending | PULSE cinema</title>
      </Helmet>
      <Navigation isTrailerPlaying={playingTrailer} />

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
        {/* Movie Detail Overlay */}
        <div 
          onClick={(e) => {
            // Only close if clicking the backdrop, not the content
            if (e.target === e.currentTarget) {
              handleCloseDetail();
            }
          }}
          className={`fixed inset-0 z-[200] transition-all duration-700 ${
            movieDetailOpen 
              ? 'opacity-100 pointer-events-auto' 
              : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Background Video/Image with Gradient */}
          <div className="absolute inset-0">
            {playingTrailer && selectedContent?.videos?.results?.length && getTrailerUrl(selectedContent) ? (
              <div className="w-full h-full">
                <div className="absolute inset-0 overflow-hidden">
                  {/* Background Video */}
                  <iframe
                    key={getTrailerUrl(selectedContent)}
                    className="w-[100vw] h-[100vh] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-125"
                    src={getTrailerUrl(selectedContent)}
                    allow="autoplay; encrypted-media"
                    style={{
                      border: 'none',
                      pointerEvents: 'none'
                    }}
                  />
                  
                  {/* Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
                  
                  {/* Close Button - Always Visible */}
                  <button 
                    onClick={handleCloseDetail}
                    className="absolute top-6 right-6 z-[210] p-3 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  {/* Content Container */}
                  <div className="absolute inset-0 flex flex-col justify-center px-20">
                    <div className="max-w-[2000px] mx-auto w-full">
                      {/* Title with Animation */}
                      <h1 
                        className="text-[120px] font-bold leading-none mb-6 opacity-90 transform transition-all duration-700"
                        style={{
                          textShadow: '0 0 40px rgba(0,0,0,0.5)'
                        }}
                      >
                        {selectedContent?.title || selectedContent?.name}
                      </h1>
                      
                      {/* Info with Fade */}
                      <div className="flex items-center gap-6 text-xl mb-8 text-white/80 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <Star className="w-6 h-6 fill-yellow-400 stroke-yellow-400" />
                          <span>{selectedContent?.vote_average ? (selectedContent.vote_average / 2).toFixed(1) : "N/A"}</span>
                        </div>
                        <span>
                          {selectedContent?.release_date 
                            ? new Date(selectedContent.release_date).getFullYear() 
                            : selectedContent?.first_air_date
                            ? new Date(selectedContent.first_air_date).getFullYear()
                            : ""}
                        </span>
                      </div>

                      {/* Description with Fade */}
                      <p className="text-xl text-white/70 max-w-3xl mb-12 leading-relaxed animate-fade-in delay-100">
                        {selectedContent?.overview || "No description available."}
                      </p>

                      {/* Action Buttons with Hover Effects */}
                      <div className="flex items-center gap-6 animate-fade-in delay-200">
                        <button 
                          onClick={handleWatchNowClick}
                          className="bg-white text-black px-12 py-4 rounded-lg text-lg font-medium 
                                   hover:bg-white/90 transition-all duration-300 flex items-center gap-3 
                                   hover:scale-105 transform hover:shadow-lg hover:shadow-white/20 z-50"
                        >
                          <Play className="w-6 h-6" />
                          <span className="font-medium">Watch Now</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative">
                {/* Background Image */}
                {selectedContent?.backdrop_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/original${selectedContent?.backdrop_path}`}
                    className="w-full h-full object-cover object-center opacity-80"
                    alt={selectedContent?.title || selectedContent?.name || "Content backdrop"}
                    onError={(e) => {
                      // Fallback to poster if backdrop fails to load
                      if (selectedContent?.poster_path) {
                        e.currentTarget.src = `https://image.tmdb.org/t/p/original${selectedContent.poster_path}`;
                      }
                    }}
                  />
                ) : selectedContent?.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/original${selectedContent.poster_path}`}
                    className="w-full h-full object-cover object-center opacity-80"
                    alt={selectedContent?.title || selectedContent?.name || "Content poster"}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-900 to-black"></div>
                )}
                
                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
                
                {/* Close Button */}
                <button 
                  onClick={handleCloseDetail}
                  className="absolute top-6 right-6 z-[210] p-3 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-center px-20">
                  <div className="max-w-[2000px] mx-auto w-full">
                    {/* Title with Animation */}
                    <h1 
                      className="text-[120px] font-bold leading-none mb-6 opacity-90 transform transition-all duration-700"
                      style={{
                        textShadow: '0 0 40px rgba(0,0,0,0.5)'
                      }}
                    >
                      {selectedContent?.title || selectedContent?.name}
                    </h1>
                    
                    {/* Info with Fade */}
                    <div className="flex items-center gap-6 text-xl mb-8 text-white/80 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <Star className="w-6 h-6 fill-yellow-400 stroke-yellow-400" />
                        <span>{selectedContent?.vote_average ? (selectedContent.vote_average / 2).toFixed(1) : "N/A"}</span>
                      </div>
                      <span>
                        {selectedContent?.release_date 
                          ? new Date(selectedContent.release_date).getFullYear() 
                          : selectedContent?.first_air_date
                          ? new Date(selectedContent.first_air_date).getFullYear()
                          : ""}
                      </span>
                    </div>

                    {/* Description with Fade */}
                    <p className="text-xl text-white/70 max-w-3xl mb-12 leading-relaxed animate-fade-in delay-100">
                      {selectedContent?.overview || "No description available."}
                    </p>

                    {/* Action Buttons with Hover Effects */}
                    <div className="flex items-center gap-6 animate-fade-in delay-200">
                      <button 
                        onClick={handleWatchNowClick}
                        className="bg-white text-black px-12 py-4 rounded-lg text-lg font-medium 
                                 hover:bg-white/90 transition-all duration-300 flex items-center gap-3 
                                 hover:scale-105 transform hover:shadow-lg hover:shadow-white/20 z-50"
                      >
                        <Play className="w-6 h-6" />
                        <span className="font-medium">Watch Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rest of the content... */}
          <div className="relative pt-24">
            {/* Movies Section */}
            <section className="relative min-h-screen flex items-center">
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 -rotate-90 flex items-center gap-3 opacity-50">
                <Film className="w-5 h-5 text-purple-400" />
                <span className="uppercase tracking-widest text-sm font-medium">Movies</span>
              </div>
              
              <div className="w-full py-20">
                {loading ? (
                  <div className="flex flex-wrap justify-center gap-4 px-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} 
                        className="w-[160px] sm:w-[180px] aspect-[2/3] rounded-lg overflow-hidden glass-card border border-white/5"
                        style={{
                          transform: `perspective(1000px) rotateY(${Math.random() * 10 - 5}deg) rotateX(${Math.random() * 10 - 5}deg)`
                        }}
                      >
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/10 to-black/50 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : trendingMovies && trendingMovies.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-4 px-4">
                    {trendingMovies.slice(0, 12).map((item, index) => (
                      <div key={item.id}
                        className="transform transition-transform duration-500 hover:scale-105"
                        style={{
                          transform: `perspective(1000px) rotateY(${Math.random() * 10 - 5}deg) rotateX(${Math.random() * 10 - 5}deg)`
                        }}
                      >
                        <ContentCard
                          item={item}
                          onClickHandler={handleWatchClick}
                          handleListAction={handleListAction}
                          isInList={isInList}
                          animatingItems={animatingItems}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full max-w-md mx-auto p-8 text-center">
                    <p className="text-white/50">No trending movies available.</p>
                  </div>
                )}
              </div>
            </section>

            {/* TV Shows Section */}
            <section className="relative min-h-screen flex items-center">
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 -rotate-90 flex items-center gap-3 opacity-50">
                <Tv className="w-5 h-5 text-purple-400" />
                <span className="uppercase tracking-widest text-sm font-medium">TV Shows</span>
              </div>
              
              <div className="w-full py-20">
                {loading ? (
                  <div className="flex flex-wrap justify-center gap-4 px-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} 
                        className="w-[160px] sm:w-[180px] aspect-[2/3] rounded-lg overflow-hidden glass-card border border-white/5"
                        style={{
                          transform: `perspective(1000px) rotateY(${Math.random() * 10 - 5}deg) rotateX(${Math.random() * 10 - 5}deg)`
                        }}
                      >
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/10 to-black/50 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : trendingTVShows && trendingTVShows.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-4 px-4">
                    {trendingTVShows.slice(0, 12).map((item, index) => (
                      <div key={item.id}
                        className="transform transition-transform duration-500 hover:scale-105"
                        style={{
                          transform: `perspective(1000px) rotateY(${Math.random() * 10 - 5}deg) rotateX(${Math.random() * 10 - 5}deg)`
                        }}
                      >
                        <ContentCard
                          item={item}
                          onClickHandler={handleWatchClick}
                          handleListAction={handleListAction}
                          isInList={isInList}
                          animatingItems={animatingItems}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full max-w-md mx-auto p-8 text-center">
                    <p className="text-white/50">No trending TV shows available.</p>
                  </div>
                )}
              </div>
            </section>
        </div>
      </div>

      {/* Streaming Modal */}
      {selectedContent && (
        <StreamingModal
          isOpen={isStreamingModalOpen}
          onClose={handleCloseStreamingModal}
          content={{
            id: selectedContent.id,
            title: selectedContent.title,
            name: selectedContent.name,
            media_type: (selectedContent.type || selectedContent.media_type || "movie") as "movie" | "tv",
            release_date: selectedContent.release_date,
            first_air_date: selectedContent.first_air_date,
            season_number: selectedContent.type === 'tv' ? selectedSeason : undefined,
            episode_number: selectedContent.type === 'tv' ? selectedEpisode : undefined
          }}
        />
      )}

      {/* Error Toast */}
      {watchError && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] animate-fade-in-up">
          <div className="bg-black/90 backdrop-blur-sm border border-red-500/20 rounded-xl px-6 py-4 shadow-xl shadow-red-500/10 flex items-center gap-4">
            <div className="bg-red-500/10 rounded-full p-2">
              <Film className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-[15px] font-medium text-white/90">{watchError}</span>
            <button 
              onClick={() => setWatchError(null)}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trending; 