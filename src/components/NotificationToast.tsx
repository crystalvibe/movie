import { useMyList } from '@/contexts/MyListContext';
import { Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const NotificationToast = () => {
  const { notification } = useMyList();

  if (!notification) return null;

  return (
    <div className="fixed bottom-8 right-8 z-[100] animate-slide-up">
      <div 
        className={cn(
          "px-6 py-4 rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-3",
          notification.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
        )}
      >
        {notification.type === 'success' ? (
          <Check className="w-5 h-5" />
        ) : (
          <AlertCircle className="w-5 h-5" />
        )}
        <span className="text-sm font-medium">{notification.message}</span>
      </div>
    </div>
  );
}; 