import { useEffect } from 'react';
import { detectDevTools } from '@/utils/devtools-detection';

export const useDevToolsProtection = () => {
  useEffect(() => {
    // Only run in production
    if (process.env.NODE_ENV === 'production') {
      detectDevTools();
    }
  }, []);
}; 