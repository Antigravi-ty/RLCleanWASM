import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Home } from 'lucide-react';
import { UI_EASING } from '../tokens';

export interface RouteMeta {
  id: string;
  title: string;
  width?: number; // target shell width in px
  isLayer1?: boolean;
}

export interface MenuStackContextValue {
  currentRoute: string;
  history: string[];
  depth: number;
  push: (routeId: string) => void;
  pop: () => void;
  replace: (routeId: string) => void;
  reset: () => void;
  canGoBack: boolean;
  routeMetaMap: Record<string, RouteMeta>;
}

const MenuStackContext = createContext<MenuStackContextValue | null>(null);

export function useMenuStack() {
  const ctx = useContext(MenuStackContext);
  if (!ctx) {
    throw new Error('useMenuStack must be used within a MenuStackProvider');
  }
  return ctx;
}

export interface MenuStackProviderProps {
  initialRoute: string;
  routes: RouteMeta[];
  children: React.ReactNode;
}

export const MenuStackProvider: React.FC<MenuStackProviderProps> = ({
  initialRoute,
  routes,
  children,
}) => {
  const [history, setHistory] = useState<string[]>([initialRoute]);

  const routeMetaMap = React.useMemo(() => {
    return routes.reduce<Record<string, RouteMeta>>((acc, r) => {
      acc[r.id] = r;
      return acc;
    }, {});
  }, [routes]);

  const currentRoute = history[history.length - 1] || initialRoute;
  const depth = history.length - 1;
  const canGoBack = depth > 0;

  const push = useCallback((routeId: string) => {
    setHistory((prev) => [...prev, routeId]);
  }, []);

  const pop = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const replace = useCallback((routeId: string) => {
    setHistory((prev) => [...prev.slice(0, -1), routeId]);
  }, []);

  const reset = useCallback(() => {
    setHistory([initialRoute]);
  }, [initialRoute]);

  return (
    <MenuStackContext.Provider
      value={{
        currentRoute,
        history,
        depth,
        push,
        pop,
        replace,
        reset,
        canGoBack,
        routeMetaMap,
      }}
    >
      {children}
    </MenuStackContext.Provider>
  );
};

export interface BreadcrumbNavProps {
  isLight?: boolean;
  className?: string;
}

/**
 * BreadcrumbNav
 * Renders interactive navigation history (e.g. Main > Settings > Audio)
 */
export const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({
  isLight = false,
  className = '',
}) => {
  const { history, routeMetaMap, pop, depth } = useMenuStack();

  if (depth === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs select-none ${
        isLight ? 'text-neutral-500' : 'text-neutral-400'
      } ${className}`}
    >
      {history.map((routeId, idx) => {
        const isLast = idx === history.length - 1;
        const meta = routeMetaMap[routeId];
        const title = meta?.title || routeId.toUpperCase();

        return (
          <React.Fragment key={routeId}>
            {idx > 0 && <ChevronRight className="h-3 w-3 opacity-40 shrink-0" />}
            {isLast ? (
              <span className={`font-semibold ${isLight ? 'text-neutral-900' : 'text-neutral-100'}`}>
                {title}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const stepsBack = history.length - 1 - idx;
                  for (let i = 0; i < stepsBack; i++) pop();
                }}
                className={`hover:underline cursor-pointer ${
                  idx === 0 ? 'flex items-center gap-1' : ''
                }`}
              >
                {idx === 0 && <Home className="h-3 w-3" />}
                <span>{title}</span>
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export interface RouteTransitionProps {
  currentKey: string;
  children: React.ReactNode;
}

/**
 * RouteTransition
 * Wraps active panels with synchronized cross-fade and subtle slide motion.
 */
export const RouteTransition: React.FC<RouteTransitionProps> = ({
  currentKey,
  children,
}) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={currentKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{
          duration: 0.18,
          ease: UI_EASING.apple,
        }}
        className="w-full flex flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
