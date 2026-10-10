export interface MenuRoute {
  id: 'main' | 'garage' | 'settings';
  title: string;
  subtitle: string;
  backTo: 'main' | null;
}

export const MENU_ROUTES: Record<string, MenuRoute> = {
  main: {
    id: 'main',
    title: 'PAUSED',
    subtitle: 'Free Play Arena',
    backTo: null
  },
  garage: {
    id: 'garage',
    title: 'GARAGE',
    subtitle: 'Vehicle Hitbox & Chassis Specification',
    backTo: 'main'
  },
  settings: {
    id: 'settings',
    title: 'SETTINGS',
    subtitle: 'Safe Area & Viewport Scaling Engine',
    backTo: 'main'
  }
};
