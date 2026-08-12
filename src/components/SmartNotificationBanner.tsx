'use client';

import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Clock, X, CheckCircle2 } from 'lucide-react';
import { TaskItem } from './TaskCard';

interface SmartNotificationBannerProps {
  tasks: TaskItem[];
}

export default function SmartNotificationBanner({ tasks }: SmartNotificationBannerProps) {
  const [notification, setNotification] = useState<{
    id: string;
    title: string;
    message: string;
    type: 'urgent' | 'warning' | 'info';
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    // Check for tasks due today or within 24-48 hours
    const pending = tasks.filter((t) => t.status === 'PENDING' && t.deadline);
    const now = new Date();

    const dueToday = pending.filter((t) => {
      const d = new Date(t.deadline!);
      if (isNaN(d.getTime())) return false;
      return d.toDateString() === now.toDateString();
    });

    const dueSoon = pending.filter((t) => {
      const d = new Date(t.deadline!);
      if (isNaN(d.getTime())) return false;
      const hours = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hours > 0 && hours <= 48 && d.toDateString() !== now.toDateString();
    });

    if (dueToday.length > 0) {
      setNotification({
        id: 'due-today',
        title: '🚨 Deadline Alert — Due Today!',
        message: `You have ${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today: "${dueToday[0].title}"`,
        type: 'urgent',
      });
      // Trigger Web Browser Push Notification if permission granted
      triggerBrowserNotification(
        '🚨 Deadline Alert — Due Today!',
        `Task due today: "${dueToday[0].title}"`
      );
    } else if (dueSoon.length > 0) {
      setNotification({
        id: 'due-soon',
        title: '⏰ Intelligent Reminder — Due Soon',
        message: `Upcoming: "${dueSoon[0].title}" is due in the next 48 hours.`,
        type: 'warning',
      });
    } else {
      setNotification(null);
    }
  }, [tasks, dismissed]);

  const enablePushNotifications = async () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const reg = await navigator.serviceWorker.register('/sw.js');
          console.log('Background Push Service Worker Registered:', reg);
          alert('✅ Background Mobile Push Notifications Enabled! You will receive alerts even when the app is closed.');
        }
      } catch (err) {
        console.error('Service worker registration failed:', err);
      }
    }
  };

  const triggerBrowserNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then((reg) => {
              reg.showNotification(title, { body, icon: '/globe.svg' });
            })
            .catch((e) => {
              console.log('SW notification fallback:', e);
            });
        }
      } catch (err) {
        console.error('Mobile notification suppressed:', err);
      }
    }
  };

  if (!notification || dismissed) return null;

  return (
    <div
      className={`w-full border-b px-4 py-2.5 transition-all duration-300 animate-in slide-in-from-top ${
        notification.type === 'urgent'
          ? 'bg-red-950/90 border-red-500/40 text-red-200'
          : 'bg-amber-950/90 border-amber-500/40 text-amber-200'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2.5 truncate">
          {notification.type === 'urgent' ? (
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-bounce" />
          ) : (
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          )}
          <span className="font-bold">{notification.title}:</span>
          <span className="truncate opacity-90">{notification.message}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={enablePushNotifications}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition-all"
          >
            🔔 Enable Push
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
