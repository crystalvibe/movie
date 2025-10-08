import { useState, useEffect, useCallback, useRef } from "react";
import { Star, Play, Film, X, Volume2, VolumeX, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Navigation } from '../components/Navigation';
import { StreamingModal } from '@/components/StreamingModal';
import { cn } from '@/lib/utils';
import { NotificationToast } from '../components/NotificationToast';
// Removed react-intersection-observer to reduce bundle size
import { fetchWithProxy, fetchWithParallelProxy } from '@/utils/proxyService';
import { config } from '@/config/env';
import { Helmet } from 'react-helmet';
import '../styles/animations.css';
import ProgressiveImage from '@/components/ProgressiveImage';
import { useMyList } from '@/contexts/MyListContext';

// Add grid background utility
const gridBackground = {
  backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)`,
  backgroundSize: '33.33% 1px'
};

// Using TMDB API with proxy for faster access
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
      "genre_ids": [80, 18, 36],
      "popularity": 129.414,
      "release_date": "2023-10-18",
      "video": false,
      "vote_average": 7.518,
      "vote_count": 2324
    },
    {
      "adult": false,
      "backdrop_path": "/rMvPXy8PUjj1o8o1pzgQbdNCsvj.jpg",
      "id": 299054,
      "title": "Expend4bles",
      "original_language": "en",
      "original_title": "Expend4bles",
      "overview": "Armed with every weapon they can get their hands on and the skills to use them, The Expendables are the world's last line of defense and the team that gets called when all other options are off the table.",
      "poster_path": "/iwsMu0ehRPbtaSxqiaUDQB9qMWT.jpg",
      "media_type": "movie",
      "genre_ids": [28, 12, 53],
      "popularity": 70.04,
      "release_date": "2023-09-15",
      "video": false,
      "vote_average": 6.361,
      "vote_count": 941
    },
    {
      "adult": false,
      "backdrop_path": "/f1AQhx6ZfGhPZFTVKgxG91PhEYc.jpg",
      "id": 753342,
      "title": "Napoleon",
      "original_language": "en",
      "original_title": "Napoleon",
      "overview": "An epic that details the checkered rise and fall of French Emperor Napoleon Bonaparte and his relentless journey to power through the prism of his addictive, volatile relationship with his wife, Josephine.",
      "poster_path": "/jE5o7y9K6pZtWNNMEw3IdpHuncR.jpg",
      "media_type": "movie",
      "genre_ids": [18, 36, 10752],
      "popularity": 133.625,
      "release_date": "2023-11-16",
      "video": false,
      "vote_average": 6.519,
      "vote_count": 1848
    },
    {
      "adult": false,
      "backdrop_path": "/tj7mp7uWjVw5N73G5Hwm1bkMOcD.jpg",
      "id": 832502,
      "title": "The Beekeeper",
      "original_language": "en",
      "original_title": "The Beekeeper",
      "overview": "One man's brutal campaign for vengeance takes on national stakes after he is revealed to be a former operative of a powerful and clandestine organization known as Beekeepers.",
      "poster_path": "/A7EByudX0eOzlkQ2FIbogzyazm2.jpg",
      "media_type": "movie",
      "genre_ids": [28, 53],
      "popularity": 241.237,
      "release_date": "2024-01-08",
      "video": false,
      "vote_average": 7.317,
      "vote_count": 1600
    },
    {
      "adult": false,
      "backdrop_path": "/bWIIWhnaoWx3EkgSFkIm23G3o9f.jpg",
      "id": 466420,
      "title": "The Holdovers",
      "original_language": "en",
      "original_title": "The Holdovers",
      "overview": "A curmudgeonly instructor at a New England prep school is forced to remain on campus during Christmas break to babysit the handful of students with nowhere to go. Eventually, he forms an unlikely bond with one of them, a damaged but wise young man, and with the school's cook, who has just lost a son in Vietnam.",
      "poster_path": "/gVKcJAoSjJCrDYvVVyFKzXbksrY.jpg",
      "media_type": "movie",
      "genre_ids": [18, 35],
      "popularity": 121.48,
      "release_date": "2023-10-27",
      "video": false,
      "vote_average": 7.642,
      "vote_count": 1149
    }
  ]
};

// Define Movie interface
interface Movie {
  id: number;
  title: string;
  desc: string;
  preview: string;
  color: {
    primary: string;
    secondary: string;
    accent: string;
  };
  rating: string;
  year: string;
  duration: string;
  poster: string;
  genres: string[];
  isYoutubeTrailer: boolean;
  videos?: {
    results: Array<{
      key: string;
      site: string;
      type: string;
      name: string;
      official?: boolean;
    }>;
  };
  backdrop_path?: string;
  poster_path?: string;
  release_date?: string;
  vote_average?: number;
  overview?: string;
  contentHash?: string;
  socialScore: number;
  region: string;
  original_language: string;
  media_type: 'movie'; // Add this line
}

// Add VideoResult type for better type safety
interface VideoResult {
  key: string;
  site: string;
  type: string;
  name: string;
  official?: boolean;
}

export const Index = () => {
  // Core state - only essential state variables
  const [activeMovie, setActiveMovie] = useState(0);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [movieDetailOpen, setMovieDetailOpen] = useState(false);
  const [playingTrailer, setPlayingTrailer] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Movie | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [isWatchLoading, setIsWatchLoading] = useState(false);
  
  // Optional state - can be disabled for better performance
  const [retryCount, setRetryCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isStreamingModalOpen, setIsStreamingModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { addToList, removeFromList, isInList, animatingItems } = useMyList();
  
  // Banner state - simplified
  const [showBanner, setShowBanner] = useState(false); // Disabled by default for performance
  const [showAdBlockBanner, setShowAdBlockBanner] = useState(false); // Disabled by default
  const [showOwnerBanner, setShowOwnerBanner] = useState(false); // Disabled by default
  const [showFeedback, setShowFeedback] = useState(false);
  const [adBlockCheckStatus, setAdBlockCheckStatus] = useState<'checking' | 'found' | 'not-found'>('not-found');
  const [showUblockBanner, setShowUblockBanner] = useState(false); // Disabled by default
  const navigate = useNavigate();

  // Helper function to generate a content hash for security verification
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

  // Banner effects disabled for performance
  // All banner-related useEffects removed

  // Fetch trending movies with retries
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        // Only show loading state if we don't have any movies yet, prevents flickering
        if (movies.length === 0) {
          setLoading(true);
        }
        setLoadingError(null);

        // Fetch movies with optimized approach - only essential data first
        let trendingHollywood, trendingBollywood, trendingKorean, viralMovies;
        
        try {
          // Fetch only 2-3 categories initially to reduce load time
          [
            trendingHollywood,
            viralMovies
          ] = await Promise.all([
            fetchWithRetry(`${BASE_URL}/discover/movie?language=en-US&with_original_language=en&sort_by=popularity.desc&vote_count.gte=1000&page=1&api_key=${TMDB_API_KEY}`),
            fetchWithRetry(`${BASE_URL}/trending/movie/day?page=1&api_key=${TMDB_API_KEY}`)
          ]);
          
          // Set default empty data for other categories to prevent errors
          trendingBollywood = { results: [] };
          trendingKorean = { results: [] };
        } catch (error) {
          console.error('Failed to fetch movies:', error);
          // If we already have movies, keep showing them instead of error
          if (movies.length > 0) {
            // Use existing movies but try fetching social trends
            trendingHollywood = trendingBollywood = trendingKorean = viralMovies = { results: [] };
          } else {
            throw new Error('Failed to load movies. Please check your internet connection.');
          }
        }

        // Verify we have enough movies
        const totalMovies = [
          ...(trendingHollywood?.results || []),
          ...(trendingBollywood?.results || []),
          ...(trendingKorean?.results || []),
          ...(viralMovies?.results || [])
        ];

        // If we don't have any movies and already have some loaded, keep the existing ones
        if (totalMovies.length === 0 && movies.length > 0) {
          setLoading(false);
          return; // Keep existing movies
        } else if (totalMovies.length === 0) {
          throw new Error('No movies available. Please try again later.');
        }

        // Skip social trends fetching initially to reduce load time
        const socialTrends = [];
        
        // Combine and filter movies with enhanced viral detection
        const combinedMovies = [
          ...(trendingHollywood?.results || []).map(m => ({ ...m, region: 'Hollywood', viralScore: 0 })),
          ...(trendingBollywood?.results || []).map(m => ({ ...m, region: 'Bollywood', viralScore: 0 })),
          ...(trendingKorean?.results || []).map(m => ({ ...m, region: 'Korean', viralScore: 0 })),
          ...(viralMovies?.results || []).map(m => ({ ...m, region: 'Viral', viralScore: 100 }))
        ]
          .filter((movie, index, self) => 
            movie.original_language !== 'zh' &&
            movie.poster_path && // Ensure movie has a poster
            movie.backdrop_path && // Ensure movie has a backdrop
            index === self.findIndex((m) => m.id === movie.id)
          )
          .map(movie => ({
            ...movie,
            score: calculateMovieScore(movie, socialTrends)
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (combinedMovies.length === 0) {
          throw new Error('No suitable movies found. Please try again later.');
        }

        // Get basic movie information only (no videos/keywords to reduce load time)
        const moviePromises = combinedMovies.map(async (movie) => {
          try {
            // Only fetch basic details, skip videos and keywords for faster loading
            const details = await fetchWithRetry(`${BASE_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}`);
            return { 
              ...movie, 
              ...details,
              tmdb_id: movie.id,
              originalLanguage: movie.original_language
            };
          } catch (error) {
            console.error(`Error fetching details for movie ${movie.id}:`, error);
            // Return basic movie info if details fetch fails
            return { ...movie, tmdb_id: movie.id };
          }
        });

        const moviesWithDetails = await Promise.all(moviePromises);
        
        // Transform the data with enhanced security and validation
        const transformedMovies = await Promise.all(moviesWithDetails.map(async (movie, index) => {
          try {
            const trailer = movie.videos?.results?.find(v => 
              v.type === "Trailer" && v.site === "YouTube" && v.official === true
            ) || movie.videos?.results?.find(v => 
              v.type === "Trailer" && v.site === "YouTube"
            ) || movie.videos?.results?.[0];

            const previewUrl = trailer 
              ? `https://www.youtube.com/embed/${trailer.key}?autoplay=1&controls=1&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&version=3&playerapiid=ytplayer&mute=0&loop=1&playlist=${trailer.key}&origin=${window.location.origin}`
              : `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;

            const movieData: Movie = {
              id: movie.tmdb_id,
              title: movie.title || 'Untitled Movie',
              desc: movie.overview || 'No description available.',
              preview: previewUrl,
              color: getColorSchemeForMovie(index),
              rating: (movie.vote_average / 2).toFixed(1),
              year: movie.release_date ? new Date(movie.release_date).getFullYear().toString() : "2024",
              duration: movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : "2h 0m",
              poster: movie.poster_path 
                ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
                : "",
              genres: movie.genres?.map(g => g.name) || [],
              isYoutubeTrailer: !!trailer,
              videos: movie.videos || { results: [] },
              backdrop_path: movie.backdrop_path,
              release_date: movie.release_date,
              vote_average: movie.vote_average,
              socialScore: movie.score,
              region: movie.region,
              original_language: movie.originalLanguage,
              media_type: 'movie' // Always set as 'movie' for this page
            };

            const contentHash = await generateContentHash(movie.tmdb_id.toString());
            movieData.contentHash = contentHash;
            
            return movieData;
          } catch (error) {
            console.error('Error transforming movie data:', error);
            throw error;
          }
        }));

        // Validate final movie list
        if (transformedMovies.length === 0) {
          throw new Error('Failed to process movies. Please try again.');
        }

        setMovies(transformedMovies);
        setLoadingError(null);
        setIsInitialLoad(false);
        
        // Skip preloading initially to reduce load time
        // preloadTopContent(transformedMovies);
      } catch (error) {
        console.error('Error in fetchMovies:', error);
        setLoadingError(error.message || 'Failed to load movies. Please try again.');
        // Retry logic for initial load
        if (isInitialLoad && retryCount < 3) {
          setRetryCount(prev => prev + 1);
          await delay(2000); // Wait 2 seconds before retrying
          fetchMovies(); // Retry
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper function to fetch social media trends
  const fetchSocialTrends = async () => {
    try {
      // Use the improved fetchWithProxy function instead of direct API call
      const data = await fetchWithProxy(`${BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}`);
      
      // Extract keywords and hashtags from trending movies
      const trends = data.results.flatMap(movie => {
        const words = movie.title.toLowerCase().split(' ');
        const hashtags = words.map(word => `#${word.replace(/[^a-z0-9]/g, '')}`);
        return [...hashtags, `#${movie.title.replace(/[^a-zA-Z0-9]/g, '')}`];
      });

      return trends;
    } catch (error) {
      console.error('Error fetching social trends:', error);
      // Return mock trends to ensure UI doesn't break
      return [
        "#movies", "#trending", "#hollywood", "#bollywood", "#korean", 
        "#film", "#cinema", "#netflix", "#streaming", "#action", 
        "#drama", "#comedy", "#thriller", "#scifi", "#horror"
      ];
    }
  };

  // Update verifyContentIntegrity function
  const verifyContentIntegrity = async (movie: Movie | undefined) => {
    if (!movie?.id) return false; // Return false if no movie to prevent playback
    try {
      // Skip origin check for YouTube previews
      if (movie.isYoutubeTrailer) return true;

      // Only verify origin for non-YouTube content
      if (movie.preview && !movie.preview.includes('youtube') && window.location.origin !== new URL(movie.preview).origin) {
        console.error('Origin mismatch detected');
        return false;
      }

      // Skip hash verification if no hash exists
      if (!movie.contentHash) return true;

      // Verify content hash
      const expectedHash = await generateContentHash(movie.id.toString());
      const hashMatches = expectedHash === movie.contentHash;
      
      if (!hashMatches) {
        console.error('Content hash verification failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Content verification failed:', error);
      return false; // Return false on error to prevent playback
    }
  };

  // Update getTrailerUrl function to match SearchBar.tsx
  const getTrailerUrl = (content: Movie) => {
    if (!content?.videos?.results?.length) return null;

    const videos = content.videos.results;
    let video = null;

    // 1. Try to find official trailer in content's original language
    video = videos.find(v => 
      v.type?.toLowerCase() === "trailer" && 
      v.site === "YouTube" && 
      v.official === true &&
      v.name?.toLowerCase().includes('official') &&
      (!v.name?.toLowerCase().includes('teaser'))
    );

    // 2. Try to find any official trailer
    if (!video) {
      video = videos.find(v => 
        v.type?.toLowerCase() === "trailer" && 
      v.site === "YouTube" && 
      v.official === true
    );
    }

    // 3. Try to find any trailer with "official" in the name
    if (!video) {
      video = videos.find(v => 
        v.type?.toLowerCase() === "trailer" && 
        v.site === "YouTube" &&
        v.name?.toLowerCase().includes('official')
      );
    }

    // 4. Try to find any trailer
    if (!video) {
      video = videos.find(v => 
        v.type?.toLowerCase() === "trailer" && 
        v.site === "YouTube"
      );
    }

    // 5. Try to find any teaser
    if (!video) {
      video = videos.find(v => 
        v.type?.toLowerCase() === "teaser" && 
        v.site === "YouTube"
      );
    }

    // 6. Just use any YouTube video available
    if (!video) {
      video = videos.find(v => v.site === "YouTube");
    }

    if (!video || !video.key) return null;

    return `https://www.youtube.com/embed/${video.key}?autoplay=1&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&version=3&playerapiid=ytplayer&mute=0&loop=1&playlist=${video.key}&disablekb=1&fs=0&origin=${window.location.origin}&widget_referrer=${window.location.origin}&cc_load_policy=0&cc_lang_pref=en&hl=en&color=white&theme=dark&autohide=1&hd=1&vq=hd1080`;
  };

  // Update scoring algorithm to heavily favor viral and trending content
  const calculateMovieScore = (movie, socialTrends) => {
    let score = 0;

    // Viral popularity score (0-35 points) - Increased weight for viral content
    score += (movie.popularity / 1000) * 35;

    // Vote average impact score (0-25 points) - More weight on audience reception
    score += (movie.vote_average / 10) * 25;

    // Super recent content bonus (0-30 points) - Heavy focus on recent trending content
    const releaseDate = new Date(movie.release_date);
    const daysSinceRelease = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, (90 - daysSinceRelease) / 90) * 30; // Extra points for movies from last 3 months

    // Language/Region bonus (0-20 points) - Adjusted weights for preferred content
    const language = movie.original_language;
    if (language === 'en') score += 20; // English viral content
    if (language === 'hi') score += 20; // Hindi viral content
    if (language === 'ko') score += 20; // Korean viral content

    // Enhanced social media trend score (0-40 points) - Much higher weight for social trends
    const movieWords = movie.title.toLowerCase().split(' ');
    const socialScore = socialTrends.reduce((acc, trend) => {
      const trendWord = trend.replace('#', '').toLowerCase();
      if (movieWords.some(word => trendWord.includes(word.replace(/[^a-z0-9]/g, '')))) {
        acc += 8; // Increased points for social media matches
      }
      return acc;
    }, 0);
    score += Math.min(40, socialScore); // Higher cap for social score

    // Viral bonus for extremely popular movies
    if (movie.vote_count > 1000 && movie.vote_average > 7.5) {
      score += 25; // Bonus for highly-rated viral hits
    }

    // Add viral score impact if available
    if (movie.viralScore) {
      score += movie.viralScore * 0.5; // Impact of viral trending status
    }

    return score;
  };

  // Update color schemes for movies
  const getColorSchemeForMovie = (id) => {
    const schemes = [
      {
        primary: "from-rose-600",
        secondary: "via-rose-900",
        accent: "rose-400"
      },
      {
        primary: "from-violet-600",
        secondary: "via-violet-900",
        accent: "violet-400"
      },
      {
        primary: "from-cyan-600",
        secondary: "via-cyan-900",
        accent: "cyan-400"
      },
      {
        primary: "from-amber-600",
        secondary: "via-amber-900",
        accent: "amber-400"
      },
      {
        primary: "from-emerald-600",
        secondary: "via-emerald-900",
        accent: "emerald-400"
      }
    ];
    return schemes[id % schemes.length];
  };

  // Helper function to get genre names
  const getGenreName = (id) => {
    const genres = {
      28: 'Action',
      12: 'Adventure',
      16: 'Animation',
      35: 'Comedy',
      80: 'Crime',
      99: 'Documentary',
      18: 'Drama',
      10751: 'Family',
      14: 'Fantasy',
      36: 'History',
      27: 'Horror',
      10402: 'Music',
      9648: 'Mystery',
      10749: 'Romance',
      878: 'Science Fiction',
      10770: 'TV Movie',
      53: 'Thriller',
      10752: 'War',
      37: 'Western'
    };
    return genres[id] || 'Unknown';
  };

  // Categories with their movies
  const categories = {
    'Featured': movies
  };

  const currentMovies = loading ? [] : categories['Featured'];
  const currentMovie = currentMovies[activeMovie];

  // Update function to handle watch click from movie card with better error handling
  const handleWatchClick = async (movie?: Movie) => {
    // Prevent multiple rapid clicks
    if (isWatchLoading) {
      return;
    }

    if (!movie) {
      console.error('No movie data provided');
      return;
    }

    try {
      setIsWatchLoading(true);
      setWatchError(null);
      setSelectedContent(movie);

      // Validate required movie data
      if (!movie.id || !movie.title) {
        throw new Error('Movie information is incomplete');
      }

      // Find the index of the selected movie
      const movieIndex = currentMovies.findIndex(m => m.id === movie.id);
      if (movieIndex !== -1) {
        setActiveMovie(movieIndex);
      }

      // Set state immediately to show loading UI feedback
      setMovieDetailOpen(true);
      setPlayingTrailer(true);

      // Skip background fetching for better performance - use existing data only
      // if (!movie.videos?.results?.length || !movie.overview) {
      //   // Background fetching disabled for performance
      // }

      // Check content integrity in background
      verifyContentIntegrity(movie).catch(error => {
        console.error('Content integrity check failed:', error);
        setWatchError('🎬 This movie is temporarily unavailable. Please try again later or choose another movie.');
        setTimeout(() => setWatchError(null), 4000);
      });

    } catch (error) {
      console.error('Error starting movie:', error);
      setWatchError(error instanceof Error ? error.message : 'Unable to play this movie right now');
      setTimeout(() => setWatchError(null), 4000);
    } finally {
      setIsWatchLoading(false);
    }
  };

  // Update handleWatchNowClick to use mutable URL construction and close modal after navigation
  const handleWatchNowClick = async () => {
    if (!selectedContent) {
      console.error('No movie selected');
      return;
    }

    try {
      // First close all modals
      setMovieDetailOpen(false);
      setPlayingTrailer(false);
      // setWatchingMovie removed for performance
      
      // Verify content integrity before navigating
      const isValid = await verifyContentIntegrity(selectedContent);
      if (!isValid) {
        throw new Error('🎬 This movie is temporarily unavailable. Please try again later or choose another movie.');
      }

      // Build the URL parameters
      const params = new URLSearchParams({
        id: selectedContent.id.toString(),
        type: selectedContent.media_type || 'movie',
        title: selectedContent.title || ''
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
      if (selectedContent.vote_average) {
        params.append('rating', selectedContent.vote_average.toString());
      }

      // Navigate to watch page with state
      navigate(`/watch?${params.toString()}`, {
        state: {
          content: selectedContent,
          from: 'index'
        }
      });

      // Close streaming modal last to ensure smooth transition
      setIsStreamingModalOpen(false);
    } catch (error) {
      console.error('Error starting movie:', error);
      setWatchError(error instanceof Error ? error.message : 'Unable to play this movie right now');
      setTimeout(() => setWatchError(null), 4000);
    }
  };

  // Add function to handle close
  const handleCloseDetail = () => {
    setPlayingTrailer(false);
    setMovieDetailOpen(false);
    // setWatchingMovie removed for performance
    setActiveMovie(0); // Reset to first movie when closing
  };

  // Add function to handle streaming modal close
  const handleCloseStreamingModal = () => {
    setIsStreamingModalOpen(false);
    // Don't clear selectedContent here to maintain state
  };

  const handleListAction = (movie: Movie) => {
    const listItem = {
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster.includes('tmdb.org') ? movie.poster.split('/w780')[1] : null,
      backdrop_path: movie.backdrop_path,
      media_type: 'movie',
      vote_average: movie.vote_average,
      release_date: movie.release_date,
      overview: movie.desc,
      videos: movie.videos // Use the complete videos object from the API
    };

    if (isInList(listItem.id)) {
      removeFromList(listItem.id);
    } else {
      addToList(listItem);
    }
  };

  const handleSuggestionSubmit = (suggestion: string) => {
    // Here you can implement the logic to handle the suggestion
    console.log('New suggestion:', suggestion);
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 3000);
  };

  // Add browser detection function
  const getBrowserName = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('firefox')) return 'Firefox';
    if (userAgent.includes('edg')) return 'Edge';
    if (userAgent.includes('opr')) return 'Opera';
    if (userAgent.includes('chrome')) return 'Chrome';
    return 'your browser';
  };

  // Check for ad blockers - DISABLED for performance
  useEffect(() => {
    // Skip ad blocker detection for better performance
    setAdBlockCheckStatus('not-found');
    return;
    
    const checkForAdBlockers = async () => {
      // Only check if we don't already know an ad blocker exists
      const alreadyDetected = localStorage.getItem('adblocker-detected') === 'true';
      if (alreadyDetected) {
        setAdBlockCheckStatus('found');
        return;
      }
      
      setAdBlockCheckStatus('checking');
      try {
        // Enhanced detection methods for multiple ad blockers
        const detectionMethods = [
          // Method 1: Check for common ad blocker elements and shadow DOM
          () => {
            const adBlockElements = [
              // uBlock Origin
              document.getElementById('ublock-origin-anchor'),
              document.querySelector('.ublock-origin-icon'),
              document.querySelector('[title*="uBlock Origin"]'),
              document.getElementById('ublock-origin-button'),
              document.querySelector('[data-ublock-origin]'),
              document.querySelector('html[data-ublock]'),
              document.querySelector('#ublock0-button'),
              document.querySelector('#ublock0_icon'),
              // AdBlock Plus
              document.getElementById('abp-anchor'),
              document.querySelector('[title*="Adblock Plus"]'),
              // AdBlock
              document.getElementById('adblock-button'),
              document.querySelector('[title*="AdBlock"]'),
              // AdGuard
              document.getElementById('adguard-button'),
              document.querySelector('[title*="AdGuard"]'),
              // Check in shadow DOM
              document.querySelector('::shadow #ublock0-button'),
              document.querySelector('::shadow .ublock0-icon'),
              document.querySelector('::shadow .adblock-button'),
              document.querySelector('::shadow .adguard-button')
            ];
            return adBlockElements.some(el => el !== null);
          },
          
          // Method 2: Enhanced ad blocking detection
          () => {
            // Create multiple test elements with different ad-related classes
            const testElements = [
              { class: 'adsbox', html: '&nbsp;' },
              { class: 'adsbygoogle', html: '&nbsp;' },
              { class: 'ad-unit', html: '&nbsp;' },
              { class: 'pub_300x250', html: '&nbsp;' },
              { class: 'ad-placement', html: '&nbsp;' },
              { class: 'banner_ad', html: '&nbsp;' },
              { class: 'sponsored-content', html: '&nbsp;' },
              { class: 'advertisement', html: '&nbsp;' }
            ];

            const results = testElements.map(test => {
              const el = document.createElement('div');
              el.className = test.class;
              el.innerHTML = test.html;
              el.style.position = 'absolute';
              el.style.left = '-999px';
              document.body.appendChild(el);
              const isBlocked = window.getComputedStyle(el).display === 'none' || !el.offsetHeight;
              document.body.removeChild(el);
              return isBlocked;
            });

            return results.some(result => result);
          },
          
          // Method 3: Check for common ad blocker properties and behaviors
          () => {
            return (
              typeof (window as any).uBlock !== 'undefined' ||
              typeof (window as any).uBlock0 !== 'undefined' ||
              typeof (window as any).AdblockPlus !== 'undefined' ||
              typeof (window as any).adblock !== 'undefined' ||
              typeof (window as any).AdGuard !== 'undefined' ||
              document.documentElement.getAttribute('data-adblockkey') !== null ||
              document.documentElement.getAttribute('data-adblock') !== null ||
              // Check if specific ad blocker functions exist
              typeof (window as any).µBlock !== 'undefined' ||
              // Check if ad blocker's content script is injected
              document.querySelector('script[src*="ublock"]') !== null ||
              document.querySelector('script[src*="adblock"]') !== null ||
              document.querySelector('script[src*="adguard"]') !== null
            );
          }
          // Network check method removed to avoid unnecessary blocked requests
        ];

        // Run all detection methods
        const results = await Promise.all(detectionMethods.map(method => {
          try {
            return method();
          } catch {
            return false;
          }
        }));

        // Ad blocker is detected if any method returns true
        const isAdBlockerDetected = results.some(result => result === true);
        
        // Update status based on detection
        setAdBlockCheckStatus(isAdBlockerDetected ? 'found' : 'not-found');
        // Only show banner when no ad blocker is found
        if (!isAdBlockerDetected) {
          setShowAdBlockBanner(true);
        }
        
        // Store the detection result with browser info
        localStorage.setItem('adblocker-detected', String(isAdBlockerDetected));
        if (isAdBlockerDetected) {
          localStorage.setItem('adblocker-browser', getBrowserName());
        }

      } catch (error) {
        console.error('Error checking for ad blockers:', error);
        // If detection fails, check localStorage for previous detection
        const previouslyDetected = localStorage.getItem('adblocker-detected') === 'true';
        setAdBlockCheckStatus(previouslyDetected ? 'found' : 'not-found');
        setShowAdBlockBanner(!previouslyDetected);
      }
    };

    // Run the check immediately and set up periodic checks - reduced frequency
    checkForAdBlockers();
    
    // Check much less frequently (every 5 minutes) to reduce console errors
    const checkInterval = setInterval(checkForAdBlockers, 300000);

    return () => clearInterval(checkInterval);
  }, []);

  // Update the banner to include a link to recommended ad blockers with browser detection
  const handleInstallAdBlocker = () => {
    const browserInfo = {
      isFirefox: navigator.userAgent.toLowerCase().includes('firefox'),
      isChrome: navigator.userAgent.toLowerCase().includes('chrome'),
      isEdge: navigator.userAgent.toLowerCase().includes('edg'),
      isOpera: navigator.userAgent.toLowerCase().includes('opr'),
    };

    let storeUrl = '';
    let adBlockerName = '';
    
    if (browserInfo.isFirefox) {
      storeUrl = "https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/";
      adBlockerName = "uBlock Origin";
    } else if (browserInfo.isOpera) {
      storeUrl = "https://addons.opera.com/en/extensions/details/ublock/";
      adBlockerName = "uBlock Origin";
    } else if (browserInfo.isEdge) {
      storeUrl = "https://microsoftedge.microsoft.com/addons/detail/ublock-origin/odfafepnkmbhccpbejgmiehpchacaeak";
      adBlockerName = "uBlock Origin";
    } else {
      // Default to Chrome Web Store
      storeUrl = "https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm";
      adBlockerName = "uBlock Origin";
    }
    
    window.open(storeUrl, '_blank');
  };

  // Helper function to get language display name (updated to remove Chinese)
  const getLanguageDisplay = (languageCode) => {
    const languages = {
      'en': 'English',
      'hi': 'Hindi',
      'ko': 'Korean',
      'te': 'Telugu',
      'ta': 'Tamil',
      'ml': 'Malayalam',
      'bn': 'Bengali',
      'ja': 'Japanese'
    };
    return languages[languageCode] || languageCode;
  };

  // Update loading state component with transition effects
  const LoadingState = () => (
    <div className="flex gap-6 justify-center items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div 
          key={i} 
          className="relative w-[200px] aspect-[2/3] rounded-xl overflow-hidden"
          style={{
            animation: `pulse 2s infinite ease-in-out ${i * 0.1}s`
          }}
        >
          <div className="absolute inset-0 bg-white/5 animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      ))}
    </div>
  );

  // Add error state component
  const ErrorState = ({ message, onRetry }) => (
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

  // Optimized content card for better performance
  const ContentCard = ({ movie, onClickHandler, handleListAction, isInList, animatingItems }) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const cardRef = useRef(null);
    
    useEffect(() => {
      const currentRef = cardRef.current;
      if (!currentRef) return;
      
      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsIntersecting(entry.isIntersecting);
        },
        { threshold: 0.1, rootMargin: '50px' } // Reduced margin for faster loading
      );
      
      observer.observe(currentRef);
      return () => {
        if (currentRef) observer.unobserve(currentRef);
      };
    }, []);
    
    return (
      <div 
        ref={cardRef}
        className="group relative w-[180px] aspect-[2/3] rounded-lg overflow-hidden transition-transform duration-200 ease-out hover:scale-105 transform-gpu glass-card border border-border/30 hover:border-purple-600/30"
        onClick={() => onClickHandler(movie)}
        style={{ cursor: 'pointer' }}
      >
        {/* Movie Poster - simplified loading */}
        <ProgressiveImage 
          path={movie.poster.includes('tmdb.org') ? movie.poster.split('/w780')[1] : movie.poster_path}
          alt={movie.title}
          type="poster"
          priority={currentMovies.indexOf(movie) < 1} // Only first movie gets priority
        />

        {/* Simplified hover content */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-0 flex flex-col justify-end p-3">
            <div className="space-y-1 mb-2">
              <h2 className="text-sm font-semibold leading-tight text-white line-clamp-2">{movie.title}</h2>
            </div>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClickHandler(movie);
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

  // Improved preload function with browser optimization
  const preloadTopContent = (movies) => {
    if (!movies || movies.length === 0) return;
    
    // Only preload when browser is idle, visible, and not on slow connections
    if ('connection' in navigator && (navigator.connection as any).saveData) {
      console.log('Save data mode is enabled, skipping preloads');
      return; // Skip preloading in data-saving mode
    }
    
    // Use requestIdleCallback to avoid blocking the main thread
    const performPreload = () => {
      // Only preload the first movie's backdrop (hero) and first two movie posters
      if (movies[0]?.backdrop_path) {
        const backdropUrl = getOptimizedImageUrl(movies[0].backdrop_path, 'backdrop', 'medium');
        // Use modern link preload for critical images
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = backdropUrl;
        document.head.appendChild(link);
      }
      
      // Preload with lower priority using favicon trick for browser cache
      if (document.visibilityState === 'visible') {
        // Only preload visible movie posters (first 2)
        movies.slice(0, 2).forEach((movie) => {
          if (movie?.poster_path) {
            const path = movie.poster.includes('tmdb.org') ? movie.poster.split('/w780')[1] : movie.poster_path;
            if (path) {
              const posterUrl = getOptimizedImageUrl(path, 'poster', 'small');
              const img = new Image();
              img.fetchPriority = 'low';
              img.src = posterUrl;
            }
          }
        });
        
        // Preload trailer for hero movie with lowest priority and only when idle
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            if (movies[0]?.videos?.results?.length) {
              const video = movies[0].videos.results.find(v => v.type === "Trailer" && v.site === "YouTube");
              if (video?.key) {
                const img = new Image();
                img.fetchPriority = 'low';
                img.src = `https://img.youtube.com/vi/${video.key}/default.jpg`;
              }
            }
          }, { timeout: 5000 });
        }
      }
    };
    
    // Use requestIdleCallback if available, otherwise use setTimeout
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(performPreload, { timeout: 2000 });
    } else {
      setTimeout(performPreload, 1000);
    }
  };

  // Add handleBackdropClick function
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop, not the content
    if (e.target === e.currentTarget) {
      handleCloseDetail();
    }
  };

  // Add missing utility functions
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchWithRetry = async (url: string, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetchWithProxy(url);
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  };

  // Add cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      setPlayingTrailer(false);
      setMovieDetailOpen(false);
      setSelectedContent(null);
      // setWatchingMovie removed for performance
      
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
      <Navigation 
        onSearchStateChange={setIsSearchOpen}
        isTrailerPlaying={playingTrailer}
      />

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
        
        {/* Movie Detail Overlay */}
        <div 
          onClick={handleBackdropClick}
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
                        {selectedContent?.title}
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
                            : ""}
                        </span>
                      </div>

                      {/* Description with Fade */}
                      <p className="text-xl text-white/70 max-w-3xl mb-12 leading-relaxed animate-fade-in delay-100">
                        {selectedContent?.overview || selectedContent?.desc}
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
                    alt={selectedContent?.title || "Movie backdrop"}
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
                    alt={selectedContent?.title || "Movie poster"}
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
                      {selectedContent?.title}
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
                          : ""}
                      </span>
                    </div>

                    {/* Description with Fade */}
                    <p className="text-xl text-white/70 max-w-3xl mb-12 leading-relaxed animate-fade-in delay-100">
                      {selectedContent?.overview || selectedContent?.desc}
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

        {/* Main Content - Movies */}
        <div className="relative min-h-screen flex items-center justify-center px-8">
          <div className="max-w-[1400px] w-full mx-auto">
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
            ) : (
              <div className="flex justify-center items-center">
                  {currentMovies.map((movie) => (
                    <ContentCard
                      key={movie.title}
                      movie={movie}
                      onClickHandler={handleWatchClick}
                      handleListAction={handleListAction}
                      isInList={isInList}
                      animatingItems={animatingItems}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals and Notifications */}
      {currentMovie && (
        <StreamingModal
          isOpen={isStreamingModalOpen}
          onClose={handleCloseStreamingModal}
          content={{
            id: currentMovie.id,
            title: currentMovie.title,
            media_type: currentMovie.media_type || 'movie',
            release_date: currentMovie.release_date
          }}
        />
      )}

      {showFeedback && (
        <div className="fixed bottom-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg animate-fade-in-out flex items-center gap-2">
          <span className="text-xl">✨</span>
          <span>Thank you for your magical feedback!</span>
        </div>
      )}

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

export default Index;
