import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { learnerService } from '../../services/learnerService';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
}

export const NotificationDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Use the singleton learnerService instance

  const fetchNotifications = async () => {
    try {
      const data = await learnerService.getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  const markAllRead = async () => {
    try {
      await learnerService.markNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Failed to mark notifications read', e);
    }
  };

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  return (
    <div className="relative inline-block text-left">
      <button
        className="relative p-2 bg-slate-50 dark:bg-gray-800 rounded-full border border-slate-200 dark:border-gray-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition shadow-premium hover:shadow-md active:scale-95"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-gray-900" />
        )}
      </button>

      {open && (
        <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 z-50">
          <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">الإشعارات</h3>
            <button onClick={markAllRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              قراءتها جميعاً
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 dark:text-slate-400">لا توجد إشعارات</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`p-3 border-b border-slate-200 dark:border-slate-700 ${n.is_read ? '' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{n.title}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{n.body}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
          <button onClick={() => setOpen(false)} className="absolute top-2 right-2 text-slate-500 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
export default NotificationDropdown;
