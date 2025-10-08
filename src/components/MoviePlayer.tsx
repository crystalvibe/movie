
import { useEffect, useState } from "react";
import { X, Volume2, VolumeX, Maximize, Minimize, Pause, Play } from "lucide-react";

interface MoviePlayerProps {
  movie: {
    title: string;
    trailer: string;
  };
  onClose: () => void;
}

export const MoviePlayer = ({ movie, onClose }: MoviePlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  let controlsTimeout: number;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeout);
    controlsTimeout = window.setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black z-50"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video Player */}
      <video
        className="w-full h-full object-cover"
        src={movie.trailer}
        autoPlay
        playsInline
        muted={isMuted}
        controls={false}
      />

      {/* Controls Overlay */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{movie.title}</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
            </div>
            <button 
              onClick={toggleFullscreen}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
