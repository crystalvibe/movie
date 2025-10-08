
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Play, Volume2, VolumeX, Maximize, ChevronLeft } from "lucide-react";
import { MoviePoster3D } from "@/components/MoviePoster3D";
import { MoviePlayer } from "@/components/MoviePlayer";
import { Navigation } from "@/components/Navigation";

const MovieDetail = () => {
  const { id } = useParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Sample movie data (replace with API call)
  const movie = {
    title: "Eternal Echoes",
    image: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7",
    trailer: "https://cdn.coverr.co/videos/coverr-an-aerial-view-of-a-city-at-night-2124/1080p.mp4",
    synopsis: "In a world where dreams and reality intertwine, a young artist discovers a portal that allows her to step into her paintings, unleashing a journey of self-discovery and artistic transformation.",
    duration: "2h 15m",
    year: "2024",
    rating: "PG-13",
    genre: "Sci-Fi / Drama",
    director: "Alexandra Chen"
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowDetails(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (isPlaying) {
    return <MoviePlayer movie={movie} onClose={() => setIsPlaying(false)} />;
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navigation />
      
      {/* Back Button */}
      <button 
        onClick={() => window.history.back()}
        className="fixed top-24 left-8 z-50 bg-background/20 backdrop-blur-sm p-2 rounded-full hover:bg-background/40 transition-colors"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="container mx-auto px-4 pt-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-6rem)]">
          {/* 3D Poster Section */}
          <div className="relative h-[70vh]">
            <MoviePoster3D image={movie.image} />
          </div>

          {/* Movie Details Section */}
          <div className={`space-y-8 transform transition-all duration-1000 ${showDetails ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0'}`}>
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">{movie.title}</h1>
              <div className="flex items-center space-x-2 text-muted-foreground">
                <span>{movie.year}</span>
                <span>•</span>
                <span>{movie.duration}</span>
                <span>•</span>
                <span>{movie.rating}</span>
              </div>
            </div>

            <p className="text-lg text-muted-foreground leading-relaxed">
              {movie.synopsis}
            </p>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground">Genre:</span>
                <span>{movie.genre}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground">Director:</span>
                <span>{movie.director}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsPlaying(true)}
                className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-medium hover:bg-primary/90 transition-all hover:scale-105 flex items-center space-x-2"
              >
                <Play className="w-5 h-5" />
                <span>Watch Now</span>
              </button>
              <button className="bg-secondary text-secondary-foreground px-8 py-3 rounded-full font-medium hover:bg-secondary/90 transition-all hover:scale-105">
                Add to List
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieDetail;
