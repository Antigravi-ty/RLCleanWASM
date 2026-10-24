import React from 'react';
import { create } from 'zustand';
import type { QuickNotificationGlowLevel } from './notificationScheduler';
import {
  type QuickNotificationItem,
  type QuickNotificationPushOptions,
  type QuickNotificationOngoingPushOptions,
  type OngoingConflictPolicy,
  type QuickNotificationStoreState,
  validateNotificationOptions,
  resolveActiveOngoing,
  notificationScheduler,
} from './notificationScheduler';

export type {
  QuickNotificationItem,
  QuickNotificationPushOptions,
  QuickNotificationOngoingPushOptions,
  OngoingConflictPolicy,
  QuickNotificationStoreState,
};

export interface QuickNotificationActions {
  // Ongoing Tasks (Lazy Loading, Preloading, Background Sync)
  pushOngoingNotification: (config: QuickNotificationOngoingPushOptions) => string;
  pushBackgroundNotification: (config: QuickNotificationOngoingPushOptions) => string;
  updateOngoingNotification: (
    idOrUpdates: string | Partial<QuickNotificationOngoingPushOptions>,
    updates?: Partial<QuickNotificationOngoingPushOptions>
  ) => void;
  updateBackgroundNotification: (
    idOrUpdates: string | Partial<QuickNotificationOngoingPushOptions>,
    updates?: Partial<QuickNotificationOngoingPushOptions>
  ) => void;
  dismissOngoingNotification: (id?: string) => void;
  dismissBackgroundNotification: (id?: string) => void;
  completeOngoingNotification: (
    id?: string,
    options?: {
      content?: React.ReactNode;
      autoDismissMs?: number;
      icon?: string;
      tone?: QuickNotificationGlowLevel;
    }
  ) => void;
  completeBackgroundNotification: (
    id?: string,
    options?: {
      content?: React.ReactNode;
      autoDismissMs?: number;
      icon?: string;
      tone?: QuickNotificationGlowLevel;
    }
  ) => void;
  setOngoingConflictPolicy: (policy: OngoingConflictPolicy) => void;

  // Interactive Notifications (Temporary & Persistent Alerts)
  pushNotification: (config: QuickNotificationPushOptions) => string;
  updateNotification: (
    id: string,
    patch: Partial<QuickNotificationPushOptions>
  ) => void;
  dismissNotification: (id: string) => void;
  resolveNotification: (id: string) => void;

  // Active notification actions
  collapseActive: () => void;
  resolveActive: () => void;
  ignoreActive: () => void;

  // Unread stack tray
  toggleStack: () => void;
  setStackOpen: (open: boolean) => void;
  expandNotificationCenter: () => void;
  resolveFromStack: (id: string) => void;
  dismissFromStack: (id: string) => void;

  // Global reset
  clearAll: () => void;
}

export type QuickNotificationStore = QuickNotificationStoreState & QuickNotificationActions;

let activeTimer: ReturnType<typeof setTimeout> | null = null;
let activeProgressInterval: ReturnType<typeof setInterval> | null = null;

const clearActiveTimers = () => {
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  if (activeProgressInterval) {
    clearInterval(activeProgressInterval);
    activeProgressInterval = null;
  }
};

const startTimerForActive = (
  item: QuickNotificationItem,
  set: (fn: (state: QuickNotificationStore) => Partial<QuickNotificationStore>) => void,
  get: () => QuickNotificationStore
) => {
  clearActiveTimers();
  if (item.type !== 'temporary') return;

  const totalMs = Math.max(800, item.duration || 3000);
  const startTime = Date.now();

  activeProgressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remainingFraction = Math.max(0, 1 - elapsed / totalMs);

    const active = get().activeNotification;
    if (active && active.id === item.id) {
      set(() => ({
        activeNotification: {
          ...active,
          remainingProgress: remainingFraction,
        },
      }));
    }
  }, 40);

  activeTimer = setTimeout(() => {
    clearActiveTimers();
    const { nextState, restoredItem } = notificationScheduler.scheduleTimeoutAutoCollapse(get());
    set(() => nextState);

    if (restoredItem && restoredItem.type === 'temporary') {
      startTimerForActive(restoredItem, set, get);
    }
  }, totalMs);
};

export const useQuickNotificationStore = create<QuickNotificationStore>((set, get) => ({
  activeNotification: null,
  preemptedPersistentStack: [],
  unreadStack: [],
  totalUnreadCount: 0,
  isStackOpen: false,
  ongoingTasks: [],
  activeOngoingTask: null,
  ongoingConflictPolicy: 'latest',

  setOngoingConflictPolicy: (policy: OngoingConflictPolicy) => {
    const activeOngoing = resolveActiveOngoing(get().ongoingTasks, policy);
    set(() => ({
      ongoingConflictPolicy: policy,
      activeOngoingTask: activeOngoing,
    }));
  },

  pushOngoingNotification: (config: QuickNotificationOngoingPushOptions) => {
    validateNotificationOptions({ ...config, type: config.type || 'ongoing' });

    const taskId = config.id || `ongoing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const currentTasks = get().ongoingTasks;
    const existingIndex = currentTasks.findIndex((t) => t.id === taskId);

    const isSpinning =
      config.isSpinningIcon ??
      (typeof config.icon === 'string' &&
        (config.icon.includes('loader') || config.icon.includes('refresh') || config.icon.includes('spin')));

    const taskItem: QuickNotificationItem = {
      id: taskId,
      content: config.content,
      tone: config.tone || 'none',
      icon: config.icon || 'loader-2',
      type: config.type || 'ongoing',
      duration: 0,
      progress: config.progress,
      isSpinningIcon: isSpinning,
      timestamp: Date.now(),
    };

    const nextTasks = [...currentTasks];
    if (existingIndex >= 0) {
      nextTasks[existingIndex] = { ...nextTasks[existingIndex], ...taskItem };
    } else {
      nextTasks.push(taskItem);
    }

    const activeOngoing = resolveActiveOngoing(nextTasks, get().ongoingConflictPolicy);

    set(() => ({
      ongoingTasks: nextTasks,
      activeOngoingTask: activeOngoing,
    }));

    return taskId;
  },

  pushBackgroundNotification: (config) => get().pushOngoingNotification(config),

  updateOngoingNotification: (idOrUpdates, updates) => {
    let targetId: string | undefined;
    let patch: Partial<QuickNotificationPushOptions>;

    if (typeof idOrUpdates === 'string') {
      targetId = idOrUpdates;
      patch = updates || {};
    } else {
      targetId = get().activeOngoingTask?.id || get().ongoingTasks[get().ongoingTasks.length - 1]?.id;
      patch = idOrUpdates;
    }

    if (!targetId) return;

    const currentTasks = get().ongoingTasks;
    const targetIndex = currentTasks.findIndex((t) => t.id === targetId);
    if (targetIndex < 0) return;

    const current = currentTasks[targetIndex];
    const isSpinning =
      patch.isSpinningIcon !== undefined
        ? patch.isSpinningIcon
        : patch.icon && typeof patch.icon === 'string'
        ? patch.icon.includes('loader') || patch.icon.includes('refresh')
        : current.isSpinningIcon;

    const updatedItem: QuickNotificationItem = {
      ...current,
      content: patch.content !== undefined ? patch.content : current.content,
      tone: patch.tone !== undefined ? patch.tone : current.tone,
      icon: patch.icon !== undefined ? patch.icon : current.icon,
      progress: patch.progress !== undefined ? patch.progress : current.progress,
      isSpinningIcon: isSpinning,
      timestamp: Date.now(),
    };

    const nextTasks = [...currentTasks];
    nextTasks[targetIndex] = updatedItem;
    const activeOngoing = resolveActiveOngoing(nextTasks, get().ongoingConflictPolicy);

    set(() => ({
      ongoingTasks: nextTasks,
      activeOngoingTask: activeOngoing,
    }));
  },

  updateBackgroundNotification: (idOrUpdates, updates) =>
    get().updateOngoingNotification(idOrUpdates, updates),

  dismissOngoingNotification: (id?: string) => {
    const targetId = id || get().activeOngoingTask?.id || get().ongoingTasks[get().ongoingTasks.length - 1]?.id;
    if (!targetId) return;

    const nextTasks = get().ongoingTasks.filter((t) => t.id !== targetId);
    const activeOngoing = resolveActiveOngoing(nextTasks, get().ongoingConflictPolicy);

    set(() => ({
      ongoingTasks: nextTasks,
      activeOngoingTask: activeOngoing,
    }));
  },

  dismissBackgroundNotification: (id) => get().dismissOngoingNotification(id),

  completeOngoingNotification: (id, options) => {
    const targetId = id || get().activeOngoingTask?.id;
    if (!targetId) return;

    get().updateOngoingNotification(targetId, {
      content: options?.content || 'Completed',
      progress: 1,
      icon: options?.icon || 'check',
      isSpinningIcon: false,
      tone: options?.tone || 'none',
    });

    const dismissMs = options?.autoDismissMs ?? 1200;
    setTimeout(() => {
      get().dismissOngoingNotification(targetId);
    }, dismissMs);
  },

  completeBackgroundNotification: (id, options) =>
    get().completeOngoingNotification(id, options),

  pushNotification: (config: QuickNotificationPushOptions) => {
    validateNotificationOptions(config);

    if (config.type === 'ongoing' || config.type === 'background') {
      return get().pushOngoingNotification(config);
    }

    clearActiveTimers();

    const newItem: QuickNotificationItem = {
      id: config.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: config.content,
      tone: config.tone || 'none',
      icon: config.icon || 'bell',
      type: config.type,
      duration: config.duration ?? (config.type === 'temporary' ? 3000 : 0),
      buttons: config.buttons,
      actionButton: config.actionButton,
      timestamp: Date.now(),
      remainingProgress: 1,
    };

    const nextState = notificationScheduler.schedulePush(get(), newItem);
    set(() => nextState);

    startTimerForActive(newItem, set, get);
    return newItem.id;
  },

  updateNotification: (id: string, patch: Partial<QuickNotificationPushOptions>) => {
    const current = get();

    if (current.activeNotification && current.activeNotification.id === id) {
      set(() => ({
        activeNotification: {
          ...current.activeNotification!,
          ...patch,
        },
      }));
    }

    const preemptedIndex = current.preemptedPersistentStack.findIndex((item) => item.id === id);
    if (preemptedIndex >= 0) {
      const nextPreempted = [...current.preemptedPersistentStack];
      nextPreempted[preemptedIndex] = { ...nextPreempted[preemptedIndex], ...patch };
      set(() => ({ preemptedPersistentStack: nextPreempted }));
    }

    const unreadIndex = current.unreadStack.findIndex((item) => item.id === id);
    if (unreadIndex >= 0) {
      const nextUnread = [...current.unreadStack];
      nextUnread[unreadIndex] = { ...nextUnread[unreadIndex], ...patch };
      set(() => ({
        unreadStack: nextUnread,
        totalUnreadCount: nextUnread.length + current.preemptedPersistentStack.length,
      }));
    }

    const ongoingIndex = current.ongoingTasks.findIndex((item) => item.id === id);
    if (ongoingIndex >= 0) {
      get().updateOngoingNotification(id, patch);
    }
  },

  dismissNotification: (id: string) => {
    clearActiveTimers();
    const { nextState, restoredItem } = notificationScheduler.scheduleDismissById(get(), id);
    set(() => nextState);

    if (restoredItem && restoredItem.type === 'temporary') {
      startTimerForActive(restoredItem, set, get);
    }
  },

  resolveNotification: (id: string) => {
    get().dismissNotification(id);
  },

  collapseActive: () => {
    clearActiveTimers();
    const nextState = notificationScheduler.scheduleUserCollapseActive(get());
    set(() => nextState);
  },

  resolveActive: () => {
    clearActiveTimers();
    const { nextState, restoredItem } = notificationScheduler.scheduleResolveOrDismissActive(get());
    set(() => nextState);

    if (restoredItem && restoredItem.type === 'temporary') {
      startTimerForActive(restoredItem, set, get);
    }
  },

  ignoreActive: () => {
    clearActiveTimers();
    const { nextState, restoredItem } = notificationScheduler.scheduleResolveOrDismissActive(get());
    set(() => nextState);

    if (restoredItem && restoredItem.type === 'temporary') {
      startTimerForActive(restoredItem, set, get);
    }
  },

  toggleStack: () => {
    const totalTrayItems = get().unreadStack.length + get().preemptedPersistentStack.length;
    if (totalTrayItems === 0) return;
    set((s) => ({
      isStackOpen: !s.isStackOpen,
    }));
  },

  setStackOpen: (open: boolean) => {
    set(() => ({ isStackOpen: open }));
  },

  expandNotificationCenter: () => {
    const current = get();
    const totalTrayItems = current.unreadStack.length + current.preemptedPersistentStack.length;
    if (totalTrayItems > 0 && !current.isStackOpen) {
      set(() => ({ isStackOpen: true }));
    }
  },

  resolveFromStack: (id: string) => {
    get().resolveNotification(id);
  },

  dismissFromStack: (id: string) => {
    get().dismissNotification(id);
  },

  clearAll: () => {
    clearActiveTimers();
    set(() => ({
      activeNotification: null,
      preemptedPersistentStack: [],
      unreadStack: [],
      totalUnreadCount: 0,
      ongoingTasks: [],
      activeOngoingTask: null,
      isStackOpen: false,
    }));
  },
}));

/**
 * Universal Store instance with direct method access
 */
const delegateAction = <K extends keyof QuickNotificationActions>(key: K) =>
  (...args: Parameters<QuickNotificationActions[K]>): ReturnType<QuickNotificationActions[K]> =>
    (useQuickNotificationStore.getState()[key] as (...a: unknown[]) => unknown)(...args) as ReturnType<QuickNotificationActions[K]>;

export const quickNotificationStore = Object.assign(useQuickNotificationStore, {
  pushNotification: delegateAction('pushNotification'),
  pushOngoingNotification: delegateAction('pushOngoingNotification'),
  pushBackgroundNotification: delegateAction('pushBackgroundNotification'),
  updateOngoingNotification: delegateAction('updateOngoingNotification'),
  updateBackgroundNotification: delegateAction('updateBackgroundNotification'),
  dismissOngoingNotification: delegateAction('dismissOngoingNotification'),
  dismissBackgroundNotification: delegateAction('dismissBackgroundNotification'),
  completeOngoingNotification: delegateAction('completeOngoingNotification'),
  completeBackgroundNotification: delegateAction('completeBackgroundNotification'),
  updateNotification: delegateAction('updateNotification'),
  dismissNotification: delegateAction('dismissNotification'),
  resolveNotification: delegateAction('resolveNotification'),
  collapseActive: delegateAction('collapseActive'),
  resolveActive: delegateAction('resolveActive'),
  ignoreActive: delegateAction('ignoreActive'),
  toggleStack: delegateAction('toggleStack'),
  setStackOpen: delegateAction('setStackOpen'),
  expandNotificationCenter: delegateAction('expandNotificationCenter'),
  resolveFromStack: delegateAction('resolveFromStack'),
  dismissFromStack: delegateAction('dismissFromStack'),
  clearAll: delegateAction('clearAll'),
});

export const pushQuickNotification = quickNotificationStore.pushNotification;
export const pushOngoingNotification = quickNotificationStore.pushOngoingNotification;
export const pushBackgroundNotification = pushOngoingNotification;
export const updateOngoingNotification = quickNotificationStore.updateOngoingNotification;
export const updateBackgroundNotification = updateOngoingNotification;
export const dismissOngoingNotification = quickNotificationStore.dismissOngoingNotification;
export const dismissBackgroundNotification = dismissOngoingNotification;
export const completeOngoingNotification = quickNotificationStore.completeOngoingNotification;
export const completeBackgroundNotification = completeOngoingNotification;
export const updateQuickNotification = quickNotificationStore.updateNotification;
export const dismissQuickNotification = quickNotificationStore.dismissNotification;
export const resolveQuickNotification = quickNotificationStore.resolveNotification;
export const expandQuickNotificationCenter = quickNotificationStore.expandNotificationCenter;
export const clearAllQuickNotifications = quickNotificationStore.clearAll;
