import { useState, useEffect, useRef } from 'react';

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

// Image optimization utility for progressive loading
const getOptimizedImageUrl = (path: string | undefined, type = 'poster', size = 'medium') => {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
  const sizeStr = IMAGE_SIZES[type][size];
  return `https://image.tmdb.org/t/p/${sizeStr}${path}`;
};

interface ProgressiveImageProps {
  path?: string;
  alt: string;
  type?: 'poster' | 'backdrop';
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
}

const ProgressiveImage = ({ 
  path, 
  alt, 
  type = 'poster', 
  className = '', 
  style = {},
  priority = false
}: ProgressiveImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const fullImageRef = useRef<HTMLImageElement>(null);
  const thumbnailUrl = getOptimizedImageUrl(path, type, 'small');
  const fullSizeUrl = getOptimizedImageUrl(path, type, 'medium');
  
  useEffect(() => {
    // Reset state when path changes
    setLoaded(false);
    setError(false);
    
    // If image is already in browser cache, mark as loaded immediately
    if (path && fullImageRef.current?.complete) {
      setLoaded(true);
    }
  }, [path]);
  
  // Use intersection observer for non-priority images
  useEffect(() => {
    if (priority) {
      // For priority images, load immediately
      if (fullImageRef.current) {
        fullImageRef.current.src = fullSizeUrl;
      }
      return;
    }
    
    const imageRef = fullImageRef.current;
    if (!imageRef) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Set the src attribute when the component enters the viewport
          imageRef.src = fullSizeUrl;
          observer.disconnect();
        }
      },
      { 
        rootMargin: '50px', // Reduced from 200px to load closer to viewport
        threshold: 0.1 // Only trigger when 10% visible
      }
    );
    
    observer.observe(imageRef);
    
    return () => {
      observer.disconnect();
    };
  }, [fullSizeUrl, priority]);
  
  const handleLoad = () => {
    setLoaded(true);
  };
  
  const handleError = () => {
    setError(true);
    setLoaded(true); // Show the thumbnail at least
  };
  
  return (
    <div className="relative w-full h-full lazy-image-container">
      {/* Thumbnail (loads immediately) */}
      <img
        src={thumbnailUrl}
        alt={alt}
        width={type === 'poster' ? 200 : 300}
        height={type === 'poster' ? 300 : 169}
        loading="eager"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover blur-sm"
        style={{ 
          opacity: loaded && !error ? 0 : 1, 
          transition: 'opacity 0.3s ease',
          willChange: 'opacity'
        }}
      />
      
      {/* Full size image (loads progressively) */}
      <img
        ref={fullImageRef}
        src={priority ? fullSizeUrl : undefined} // Only set src for priority images
        data-src={!priority ? fullSizeUrl : undefined} // Store URL for lazy loading
        alt={alt}
        width={type === 'poster' ? 500 : 1280}
        height={type === 'poster' ? 750 : 720}
        fetchPriority={priority ? "high" : "low"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`absolute inset-0 w-full h-full object-cover ${loaded ? 'image-fade-in' : 'opacity-0'} ${className}`}
        style={{ 
          ...style,
          transition: loaded ? 'opacity 0.2s ease' : 'none', // Faster transition, no transition when not loaded
          opacity: loaded && !error ? 1 : 0,
          willChange: loaded ? 'opacity' : 'auto' // Only use willChange when transitioning
        }}
      />
    </div>
  );
};

export default ProgressiveImage; 