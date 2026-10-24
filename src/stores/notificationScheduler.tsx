import React from 'react';
export type QuickNotificationGlowLevel = 'none' | 'info' | 'warning' | 'orange' | 'error';
export type QuickNotificationType = 'temporary' | 'persistent' | 'ongoing' | 'background';
export type QuickNotificationButtonVariant = 'green' | 'red' | 'amber' | 'neutral' | 'sky' | 'purple';
export type QuickNotificationButtonFormat = 'icon-only' | 'text-only' | 'icon-text';

export interface QuickNotificationButtonConfig {
  key?: string;
  label?: string;
  icon?: string | React.ReactNode;
  format?: QuickNotificationButtonFormat;
  color?: QuickNotificationButtonVariant;
  dismissOnClick?: boolean;
  onClick?: () => void;
}

export type SchemaErrorPresenter = (message: string) => void;
let customSchemaErrorPresenter: SchemaErrorPresenter | null = null;

/**
 * Optional hook to register a custom error UI presenter (e.g. Dialogue modal)
 * without coupling the pure notification scheduler to any specific UI widget.
 */
export const registerSchemaErrorPresenter = (presenter: SchemaErrorPresenter | null) => {
  customSchemaErrorPresenter = presenter;
};

export interface QuickNotificationItem {
  id: string;
  content: React.ReactNode;
  tone: QuickNotificationGlowLevel;
  icon: string | React.ReactNode;
  type: QuickNotificationType;
  duration: number; // in milliseconds (0 for persistent/ongoing)
  buttons?: QuickNotificationButtonConfig[];
  actionButton?: {
    label: string;
    onClick?: () => void;
  };
  timestamp: number;
  remainingProgress?: number; // 0 to 1 for temporary
  progress?: number | 'indeterminate'; // for ongoing/background tasks
  isSpinningIcon?: boolean;
}

export type QuickNotificationPushOptions = Omit<
  QuickNotificationItem,
  'id' | 'timestamp' | 'icon' | 'tone'
> & {
  id?: string;
  timestamp?: number;
  icon?: string | React.ReactNode;
  tone?: QuickNotificationGlowLevel;
};

export type QuickNotificationOngoingPushOptions = Omit<
  QuickNotificationPushOptions,
  'type' | 'duration'
> & {
  type?: QuickNotificationType;
  duration?: number;
};

export type OngoingConflictPolicy = 'latest' | 'first' | 'queue';

export interface QuickNotificationStoreState {
  activeNotification: QuickNotificationItem | null;
  preemptedPersistentStack: QuickNotificationItem[];
  unreadStack: QuickNotificationItem[];
  totalUnreadCount: number;
  isStackOpen: boolean;
  ongoingTasks: QuickNotificationItem[];
  activeOngoingTask: QuickNotificationItem | null;
  ongoingConflictPolicy: OngoingConflictPolicy;
}

/**
 * Triggers a fatal parameter schema error:
 * 1. Outputs structured bold red console error
 * 2. Notifies any registered error presenter or spawns a top-level error dialogue with ghost icon
 * 3. Throws a fatal JavaScript Error
 */
export const triggerFatalSchemaError = (message: string): never => {
  const errorBanner = `[FATAL NOTIFICATION ERROR] ${message}`;
  console.error(errorBanner);

  try {
    if (customSchemaErrorPresenter) {
      customSchemaErrorPresenter(message);
    }
  } catch (err) {
    console.warn("[notificationScheduler] Dialogue container not yet initialized:", err);
  }

  throw new Error(errorBanner);
};

/**
 * Strict Runtime Validation for Notification Push Options.
 * Prohibits silent fallbacks. Throws and spawns Dialogue on violation.
 */
export const validateNotificationOptions = (config: any): void => {
  if (!config || typeof config !== 'object') {
    triggerFatalSchemaError('Notification configuration must be a valid non-null object.');
  }

  // Check for deprecated or mistaken property names
  if ('durationMs' in config) {
    triggerFatalSchemaError(
      `Found invalid property 'durationMs' in notification '${config.id || 'anonymous'}'. ` +
        `You must use 'duration' (in milliseconds) instead.`
    );
  }

  if ('action' in config && !('actionButton' in config)) {
    triggerFatalSchemaError(
      `Found legacy property 'action' in notification '${config.id || 'anonymous'}'. ` +
        `You must use 'actionButton: { label, onClick }' or 'buttons: [...]' instead.`
    );
  }

  if (!config.type) {
    triggerFatalSchemaError(
      `Missing required property 'type' in notification '${config.id || 'anonymous'}'. ` +
        `Must be explicitly set to 'temporary', 'persistent', 'ongoing', or 'background'. Silent fallback is strictly disabled.`
    );
  }

  const validTypes: QuickNotificationType[] = ['temporary', 'persistent', 'ongoing', 'background'];
  if (!validTypes.includes(config.type)) {
    triggerFatalSchemaError(
      `Invalid notification type '${config.type}'. Expected one of: ${validTypes.map((t) => `'${t}'`).join(', ')}.`
    );
  }

  if (config.type === 'temporary') {
    if (typeof config.duration !== 'number' || config.duration <= 0) {
      triggerFatalSchemaError(
        `Temporary notification requires a positive numerical 'duration' (in milliseconds). Received: ${config.duration}.`
      );
    }
  }

  if (config.content === undefined || config.content === null) {
    triggerFatalSchemaError(
      `Notification 'content' cannot be null or undefined in notification '${config.id || 'anonymous'}'.`
    );
  }
};

/**
 * Resolves active ongoing task based on conflict policy
 */
export const resolveActiveOngoing = (
  tasks: QuickNotificationItem[],
  policy: OngoingConflictPolicy
): QuickNotificationItem | null => {
  if (tasks.length === 0) return null;
  if (policy === 'first' || policy === 'queue') return tasks[0];
  return tasks[tasks.length - 1]; // Default 'latest'
};

/**
 * Notification Scheduler: Pure state arbitration engine
 */
export const notificationScheduler = {
  /**
   * Schedule a new notification push:
   * - If an active persistent notification exists, it is preempted into the preemptedPersistentStack.
   * - If an active temporary notification exists, it is moved to unreadStack.
   * - The new notification becomes the activeNotification.
   */
  schedulePush: (
    state: QuickNotificationStoreState,
    newItem: QuickNotificationItem
  ): Partial<QuickNotificationStoreState> => {
    const currentActive = state.activeNotification;
    let nextPreempted = [...state.preemptedPersistentStack];
    let nextUnread = [...state.unreadStack];

    if (currentActive) {
      if (currentActive.type === 'persistent') {
        // Preempt active persistent notification into preempted stack (LIFO)
        nextPreempted = [currentActive, ...nextPreempted];
      } else if (currentActive.type === 'temporary') {
        // Temporary notification was preempted by newer notification; move to unread tray
        nextUnread = [currentActive, ...nextUnread];
      }
    }

    const totalUnreadCount = nextUnread.length + nextPreempted.length;

    return {
      activeNotification: newItem,
      preemptedPersistentStack: nextPreempted,
      unreadStack: nextUnread,
      totalUnreadCount,
    };
  },

  /**
   * Schedule resolution or dismissal of an active notification:
   * - If active notification is resolved/dismissed, attempt to restore the latest preempted persistent notification.
   */
  scheduleResolveOrDismissActive: (
    state: QuickNotificationStoreState
  ): {
    nextState: Partial<QuickNotificationStoreState>;
    restoredItem: QuickNotificationItem | null;
  } => {
    let nextActive: QuickNotificationItem | null = null;
    let nextPreempted = [...state.preemptedPersistentStack];

    if (nextPreempted.length > 0) {
      // Pop and restore the most recent preempted persistent notification
      nextActive = nextPreempted[0];
      nextPreempted = nextPreempted.slice(1);
    }

    const totalUnreadCount = state.unreadStack.length + nextPreempted.length;

    return {
      nextState: {
        activeNotification: nextActive,
        preemptedPersistentStack: nextPreempted,
        totalUnreadCount,
      },
      restoredItem: nextActive,
    };
  },

  /**
   * Schedule timeout auto-collapse (when a temporary notification timer finishes):
   * - The expired temporary notification is collapsed into the unreadStack.
   * - If there are preempted persistent notifications pending, restore the topmost persistent notification!
   */
  scheduleTimeoutAutoCollapse: (
    state: QuickNotificationStoreState
  ): {
    nextState: Partial<QuickNotificationStoreState>;
    restoredItem: QuickNotificationItem | null;
  } => {
    const currentActive = state.activeNotification;
    let nextUnread = [...state.unreadStack];
    if (currentActive) {
      nextUnread = [currentActive, ...nextUnread];
    }

    let nextActive: QuickNotificationItem | null = null;
    let nextPreempted = [...state.preemptedPersistentStack];

    if (nextPreempted.length > 0) {
      // Preempted persistent notification restores automatically after temporary alert expires
      nextActive = nextPreempted[0];
      nextPreempted = nextPreempted.slice(1);
    }

    const totalUnreadCount = nextUnread.length + nextPreempted.length;

    return {
      nextState: {
        activeNotification: nextActive,
        preemptedPersistentStack: nextPreempted,
        unreadStack: nextUnread,
        totalUnreadCount,
      },
      restoredItem: nextActive,
    };
  },

  /**
   * Schedule user explicit collapse of active notification:
   * - Moves active notification into unreadStack.
   * - Does NOT immediately pop preempted notification to avoid disturbing the user who explicitly requested a collapsed view.
   */
  scheduleUserCollapseActive: (
    state: QuickNotificationStoreState
  ): Partial<QuickNotificationStoreState> => {
    const currentActive = state.activeNotification;
    if (!currentActive) return {};

    const nextUnread = [currentActive, ...state.unreadStack];
    const totalUnreadCount = nextUnread.length + state.preemptedPersistentStack.length;

    return {
      activeNotification: null,
      unreadStack: nextUnread,
      totalUnreadCount,
    };
  },

  /**
   * Schedule arbitrary item dismissal by ID (could be active, preempted, unread, or ongoing)
   */
  scheduleDismissById: (
    state: QuickNotificationStoreState,
    id: string
  ): {
    nextState: Partial<QuickNotificationStoreState>;
    restoredItem: QuickNotificationItem | null;
  } => {
    let nextActive = state.activeNotification;
    let nextPreempted = state.preemptedPersistentStack.filter((item) => item.id !== id);
    let nextUnread = state.unreadStack.filter((item) => item.id !== id);
    let nextOngoing = state.ongoingTasks.filter((item) => item.id !== id);
    let restoredItem: QuickNotificationItem | null = null;

    if (nextActive && nextActive.id === id) {
      // Dismissing active notification triggers restore if preempted items exist
      if (nextPreempted.length > 0) {
        restoredItem = nextPreempted[0];
        nextActive = restoredItem;
        nextPreempted = nextPreempted.slice(1);
      } else {
        nextActive = null;
      }
    }

    const nextActiveOngoing = resolveActiveOngoing(nextOngoing, state.ongoingConflictPolicy);
    const totalUnreadCount = nextUnread.length + nextPreempted.length;

    return {
      nextState: {
        activeNotification: nextActive,
        preemptedPersistentStack: nextPreempted,
        unreadStack: nextUnread,
        totalUnreadCount,
        ongoingTasks: nextOngoing,
        activeOngoingTask: nextActiveOngoing,
        isStackOpen: nextUnread.length > 0 ? state.isStackOpen : false,
      },
      restoredItem,
    };
  },
};
