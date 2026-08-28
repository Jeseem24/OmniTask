'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, X, Bell } from 'lucide-react';
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

    const pending = tasks.filter((t) => t.status === 'PENDING' && t.deadline);
    const now = new Date();

    const dueToday = pending.filter((t) => {
      const d = new Date(t.deadline!);
      if (isNaN(d.getTime())) return false;
      return d.toDateString() === now.toDateString();
    });

    const overdue = pending.filter((t) => {
      const d = new Date(t.deadline!);
      if (isNaN(d.getTime())) return false;
      return d.getTime() < now.getTime() && d.toDateString() !== now.toDateString();
    });

    const dueSoon = pending.filter((t) => {
      const d = new Date(t.deadline!);
      if (isNaN(d.getTime())) return false;
      const hours = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hours > 0 && hours <= 48 && d.toDateString() !== now.toDateString();
    });

    if (overdue.length > 0) {
      setNotification({
        id: 'overdue',
        title: 'Overdue',
        message: `${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} past deadline — "${overdue[0].title}"`,
        type: 'urgent',
      });
    } else if (dueToday.length > 0) {
      setNotification({
        id: 'due-today',
        title: 'Due Today',
        message: `${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today — "${dueToday[0].title}"`,
        type: 'urgent',
      });
      triggerBrowserNotification('Due Today', `"${dueToday[0].title}" is due today`);
    } else if (dueSoon.length > 0) {
      setNotification({
        id: 'due-soon',
        title: 'Coming Up',
        message: `"${dueSoon[0].title}" is due within 48 hours`,
        type: 'warning',
      });
    } else {
      setNotification(null);
    }
  }, [tasks, dismissed]);

  const triggerBrowserNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then((reg) => reg.showNotification(title, { body, icon: '/globe.svg' }))
            .catch(() => {});
        }
      } catch {}
    }
  };

  const enablePushNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          alert('Push notifications enabled!');
        }
      } catch {}
    }
  };

  if (!notification || dismissed) return null;

  return (
    <div className={`w-full border-b animate-slide-down ${
      notification.type === 'urgent'
        ? 'bg-red-950/60 border-red-500/20 text-red-200'
        : 'bg-amber-950/40 border-amber-500/20 text-amber-200'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 py-2.5 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2.5 truncate">
          {notification.type === 'urgent' ? (
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
          )}
          <span className="font-bold">{notification.title}:</span>
          <span className="truncate opacity-80">{notification.message}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={enablePushNotifications}
            className="hidden sm:flex px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-bold text-white transition-all items-center gap-1.5"
          >
            <Bell className="w-3 h-3" /> Enable Push
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/[0.1] rounded-lg text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
