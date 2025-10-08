import { useState, useEffect, useRef } from 'react';
import { Search, X, Star, Play, Film, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWithProxy } from '@/utils/proxyService';
import { config } from '@/config/env';
import { cn } from '@/lib/utils';
import ProgressiveImage from './ProgressiveImage';

interface SearchBarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  videos?: {
    results: Array<{
      key: string;
      site: string;
      type: string;
      name: string;
      official?: boolean;
    }>;
  };
}

export const SearchBar = ({ isOpen, setIsOpen }: SearchBarProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<SearchResult | null>(null);
  const [movieDetailOpen, setMovieDetailOpen] = useState(false);
  const [playingTrailer, setPlayingTrailer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const searchMovies = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetchWithProxy(
          `${config.tmdb.baseUrl}/search/multi?api_key=${config.tmdb.apiKey}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
        );

        if (!response.results) {
          throw new Error('Invalid response format');
        }

        const filteredResults = response.results
          .filter((item: any) => 
            (item.media_type === 'movie' || item.media_type === 'tv') && 
            item.poster_path && 
            (item.vote_average || item.release_date || item.first_air_date)
          )
          .slice(0, 12);

        setResults(filteredResults);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(searchMovies, 300);
    return () => clearTimeout(debounceTimeout);
  }, [query]);

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

  const handleResultClick = async (result: SearchResult) => {
    try {
      // Fetch additional details including videos
      const endpoint = `/${result.media_type}/${result.id}?append_to_response=videos,credits&api_key=${config.tmdb.apiKey}`;
      const details = await fetchWithProxy(`${config.tmdb.baseUrl}${endpoint}`);
      
      // Merge the details with the result
      const enrichedResult = {
        ...result,
        videos: details.videos,
        overview: details.overview || result.overview,
        vote_average: details.vote_average || result.vote_average
      };

      setSelectedContent(enrichedResult);
      setMovieDetailOpen(true);
      setPlayingTrailer(true);
    } catch (error) {
      console.error('Error fetching content details:', error);
      // Navigate even if trailer fetch fails
      navigateToWatch(result);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Add navigation function
  const navigateToWatch = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    
    const params = new URLSearchParams({
      id: result.id.toString(),
      type: result.media_type,
      title: result.title || result.name || '',
      ...(result.poster_path && { poster: result.poster_path }),
      ...(result.overview && { overview: result.overview }),
      ...(result.release_date && { release_date: result.release_date }),
      ...(result.first_air_date && { first_air_date: result.first_air_date }),
      ...(result.vote_average && { rating: result.vote_average.toString() })
    });

    navigate(`/watch?${params.toString()}`);
  };

  return (
    <>
      {/* Search Icon/Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/5",
          isOpen && "bg-white/5 text-white"
        )}
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Movie Detail Overlay */}
      {movieDetailOpen && selectedContent && (
        <div 
          className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMovieDetailOpen(false);
              setPlayingTrailer(false);
            }
          }}
        >
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
                  
                  {/* Close Button */}
                  <button 
                    onClick={() => {
                      setMovieDetailOpen(false);
                      setPlayingTrailer(false);
                    }}
                    className="absolute top-6 right-6 z-[310] p-3 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full transition-colors"
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
                      {selectedContent?.overview && (
                        <p className="text-xl text-white/70 max-w-3xl mb-12 leading-relaxed animate-fade-in delay-100">
                          {selectedContent.overview}
                        </p>
                      )}

                      {/* Action Buttons with Hover Effects */}
                      <div className="flex items-center gap-6 animate-fade-in delay-200">
                        <button 
                          onClick={() => navigateToWatch(selectedContent)}
                          className="bg-white text-black px-12 py-4 rounded-lg text-lg font-medium 
                                   hover:bg-white/90 transition-all duration-300 flex items-center gap-3 
                                   hover:scale-105 transform hover:shadow-lg hover:shadow-white/20"
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
                  />
                ) : selectedContent?.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/original${selectedContent.poster_path}`}
                    className="w-full h-full object-cover object-center opacity-80"
                    alt={selectedContent?.title || selectedContent?.name || "Content poster"}
                  />
                ) : null}
                
                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
                
                {/* Close Button */}
                <button 
                  onClick={() => {
                    setMovieDetailOpen(false);
                    setPlayingTrailer(false);
                  }}
                  className="absolute top-6 right-6 z-[310] p-3 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full transition-colors"
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
                    {selectedContent?.overview && (
                      <p className="text-xl text-white/70 max-w-3xl mb-12 leading-relaxed animate-fade-in delay-100">
                        {selectedContent.overview}
                      </p>
                    )}

                    {/* Action Buttons with Hover Effects */}
                    <div className="flex items-center gap-6 animate-fade-in delay-200">
                      <button 
                        onClick={() => navigateToWatch(selectedContent)}
                        className="bg-white text-black px-12 py-4 rounded-lg text-lg font-medium 
                                 hover:bg-white/90 transition-all duration-300 flex items-center gap-3 
                                 hover:scale-105 transform hover:shadow-lg hover:shadow-white/20"
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
      )}

      {/* Full Page Search */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-background">
          {/* Background Layer */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-slate-950 to-slate-950" />
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/30 rounded-full filter blur-[120px] animate-float" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-rose-500/20 rounded-full filter blur-[100px] animate-float-delayed" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent">
              <div className="absolute inset-0 bg-noise opacity-[0.15]" />
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 min-h-screen">
            {/* Search Header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border/30">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center h-20">
                  <button
                    onClick={handleClose}
                    className="mr-4 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/5"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div className="flex-1 relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search movies and TV shows..."
                      className="w-full h-14 pl-12 pr-12 bg-white/5 rounded-full border border-border/30 text-white/90 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 p-1"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Search Results */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500/40" />
                </div>
              ) : error ? (
                <div className="text-center py-20">
                  <p className="text-lg text-white/60">{error}</p>
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
                  {results.map((result) => (
                    <div
                      key={`${result.id}-${result.media_type}`}
                      className="group relative w-[180px] aspect-[2/3] rounded-lg overflow-hidden transition-all duration-300 ease-out hover:scale-105 transform-gpu glass-card will-change-transform border border-border/30 hover:border-purple-600/30 hover:shadow-lg"
                      onClick={() => handleResultClick(result)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Movie Poster */}
                      <ProgressiveImage 
                        path={result.poster_path}
                        alt={result.title || result.name || ""}
                        type="poster"
                      />

                      {/* Hover Content with glass effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out">
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                        <div className="absolute inset-0 flex flex-col justify-end p-3">
                          <div className="space-y-1 mb-2">
                            <div className="text-xs font-medium text-white/80">
                              {(result.release_date || result.first_air_date) && 
                                new Date(result.release_date || result.first_air_date).getFullYear()}
                            </div>
                            <h2 className="text-sm font-semibold leading-tight text-white line-clamp-2">
                              {result.title || result.name}
                            </h2>
                          </div>

                          <div className="flex gap-1 mb-2 flex-wrap">
                            <span className="px-1.5 py-0.5 bg-white/10 backdrop-blur-sm rounded-full text-[9px] font-medium text-white/90">
                              {result.media_type === 'tv' ? 'TV Show' : 'Movie'}
                            </span>
                            {result.vote_average > 0 && (
                              <span className="px-1.5 py-0.5 bg-white/10 backdrop-blur-sm rounded-full text-[9px] font-medium text-white/90 flex items-center gap-[2px]">
                                <Star className="w-2 h-2 text-yellow-400" fill="currentColor" />
                                {(result.vote_average / 2).toFixed(1)}
                              </span>
                            )}
                          </div>

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResultClick(result);
                            }}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors text-xs font-medium"
                          >
                            <Play className="w-3 h-3" />
                            <span>Watch</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : query ? (
                <div className="text-center py-20">
                  <Film className="mx-auto h-12 w-12 text-white/20" />
                  <p className="mt-4 text-lg text-white/60">No results found</p>
                </div>
              ) : (
                <div className="text-center py-20">
                  <Search className="mx-auto h-12 w-12 text-white/20" />
                  <p className="mt-4 text-lg text-white/60">Start typing to search</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 