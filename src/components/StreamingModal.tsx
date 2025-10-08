import { useState, useEffect } from 'react';
import { X, Shield, Gauge, Wifi, MonitorPlay, CheckCircle2, Play } from 'lucide-react';
import { streamingService } from '@/services/streamingService';
import { useNavigate } from 'react-router-dom';

interface StreamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: {
    id: number;
    title?: string;
    name?: string;
    media_type: 'movie' | 'tv';
    release_date?: string;
    first_air_date?: string;
    season_number?: number;
    episode_number?: number;
  };
  isWatchParty?: boolean;
  partyData?: {
    partyId: string;
    participants: Array<{ id: string; name: string }>;
    messages: Array<{ id: string; userId: string; userName: string; text: string; timestamp: number }>;
    reactions: Array<{ id: string; userId: string; emoji: string; timestamp: number }>;
    hostId: string;
    currentTime: number;
    isPaused: boolean;
    voteSkip: string[];
    voteRewind: string[];
    isChatMuted: boolean;
  };
  onPartyDataUpdate?: (data: any) => void;
}

export const StreamingModal = ({ isOpen, onClose, content, isWatchParty, partyData, onPartyDataUpdate }: StreamingModalProps) => {
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false); // Track iframe load
  const navigate = useNavigate();
  
  const title = content.title || content.name || '';
  const sources = streamingService.getAllStreamingSources({
    type: content.media_type,
    tmdbId: content.id.toString(),
    season: content.season_number,
    episode: content.episode_number
  });

  useEffect(() => {
    // Set first server as default
    if (sources.length > 0 && !selectedServer) {
      setSelectedServer(sources[0].url);
    }
    setIframeLoaded(false); // Reset on server change
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [sources, selectedServer]);

  // Add watch party functionality
  useEffect(() => {
    if (isWatchParty && partyData && onPartyDataUpdate) {
      // Sync video state with party data
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.currentTime = partyData.currentTime;
        if (partyData.isPaused) {
          videoElement.pause();
        } else {
          videoElement.play();
        }

        // Listen for video events
        videoElement.addEventListener('timeupdate', () => {
          onPartyDataUpdate({
            ...partyData,
            currentTime: videoElement.currentTime
          });
        });

        videoElement.addEventListener('play', () => {
          onPartyDataUpdate({
            ...partyData,
            isPaused: false
          });
        });

        videoElement.addEventListener('pause', () => {
          onPartyDataUpdate({
            ...partyData,
            isPaused: true
          });
        });
      }
    }
  }, [isWatchParty, partyData, onPartyDataUpdate]);

  // Add vote handling
  useEffect(() => {
    if (isWatchParty && partyData && onPartyDataUpdate) {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        const totalParticipants = partyData.participants.length;
        const votesNeeded = Math.ceil(totalParticipants / 2);

        // Handle skip votes
        if (partyData.voteSkip.length >= votesNeeded) {
          videoElement.currentTime += 10;
          onPartyDataUpdate({
            ...partyData,
            voteSkip: []
          });
        }

        // Handle rewind votes
        if (partyData.voteRewind.length >= votesNeeded) {
          videoElement.currentTime -= 10;
          onPartyDataUpdate({
            ...partyData,
            voteRewind: []
          });
        }
      }
    }
  }, [isWatchParty, partyData?.voteSkip, partyData?.voteRewind]);

  if (!isOpen) return null;

  const handleWatchNow = () => {
    onClose();
    navigate('/watch', { state: { content } });
  };

  // Automatically redirect
  handleWatchNow();
  return (
    <div className={`fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      {/* Loader while streaming server is loading */}
      {(loading || !iframeLoaded) && (
        <div className="absolute inset-0 bg-black/80 z-40 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-8" />
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
      {/* Streaming iframe */}
      {selectedServer && (
        <iframe
          key={selectedServer}
          src={selectedServer}
          className="w-full h-full z-10"
          allowFullScreen
          scrolling="no"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          style={{ border: 'none', minHeight: '60vh', minWidth: '60vw', borderRadius: 12, background: '#000' }}
          onLoad={() => setIframeLoaded(true)}
        />
      )}
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-50 p-3 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full transition-colors"
      >
        <X className="w-6 h-6" />
      </button>
    </div>
  );
}; 