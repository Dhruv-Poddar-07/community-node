import { useEffect } from 'react';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface NotificationProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

export default function NotificationUI({ notifications, onRemove }: NotificationProps) {
  useEffect(() => {
    notifications.forEach(notification => {
      if (notification.duration) {
        const timer = setTimeout(() => {
          onRemove(notification.id);
        }, notification.duration);
        return () => clearTimeout(timer);
      }
    });
  }, [notifications, onRemove]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '✓';
    }
  };

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-400';
      case 'error':
        return 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-400';
      case 'warning':
        return 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-yellow-400';
      case 'info':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white border-gray-400';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`relative flex items-center p-4 rounded-xl shadow-2xl backdrop-blur-lg min-w-[320px] max-w-[400px] transform transition-all duration-300 hover:scale-105 animate-slide-in-right border ${getNotificationStyles(notification.type)}`}
        >
          {/* Close button */}
          <button
            onClick={() => onRemove(notification.id)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center transition-all duration-200"
          >
            <span className="text-white text-opacity-80 hover:text-opacity-100">×</span>
          </button>
          
          {/* Icon and content */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
              <span className="text-lg font-bold">{getNotificationIcon(notification.type)}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium leading-tight">{notification.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
