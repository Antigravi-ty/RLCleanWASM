export type PanelSizingMode = 'auto' | 'fixed';

export type MenuPanelId =
  | 'layer1-main'
  | 'layer2-play'
  | 'layer2-garage'
  | 'layer2-settings'
  | 'layer2-room-host-control'
  | 'layer3-audio-detail'
  | 'layer3-ball-trajectory'
  | 'layer3-online-warmup'
  | 'layer3-bot-difficulty'
  | 'layer3-self-training'
  | 'layer3-custom-training'
  | 'layer3-camera'
  | 'layer3-training'
  | 'layer3-keybindings'
  | 'layer4-advanced-controller'
  | 'layer4-advanced-audio'
  | 'layer4-event-and-triggerer'
  | 'layer3-exp-multi-bots'
  | 'layer3-dev-subsystem-isolation'
  | 'layer3-dev-sandboxes'
  | 'layer3-dev-active-tuners'
  | 'layer3-dev-calibrated-presets'
  | 'layer3-dev-under-development'
  | 'layer4-static-training-pack'
  | 'layer5-static-training-pack-session';

export interface PanelSizingConfig {
  /**
   * 'auto': Height automatically fits content, clamped to [minHeight, min(maxHeight, availH)].
   *         Ideal for single-view menus without internal tab switching (e.g., Layer 1 Main Menu, Layer 2 Play).
   * 'fixed': Height is locked to min(targetHeight, availH).
   *          Ideal for multi-tab menus (Garage, Settings) and Layer 3 panels with inline error notices so container never jumps.
   */
  mode: PanelSizingMode;
  /** Target container width in px */
  width: number;
  /** Locked target height in px when mode === 'fixed' (or fallback height before initial measurement) */
  targetHeight: number;
  /** Minimum height in px when mode === 'auto' */
  minHeight: number;
  /** Maximum allowed height in px when mode === 'auto' (overflows into internal scrolling beyond this) */
  maxHeight: number;
}

export interface MenuLayoutConstants {
  panels: Record<MenuPanelId, PanelSizingConfig>;
  /** Vertical margin (top & bottom in px) for MenuDivider (default: 2px) */
  dividerMarginY: number;
  /** Vertical flex gap (in px) between items inside MenuContainer (default: 4px) */
  menuItemGap: number;
  /** Vertical padding (top & bottom in px) inside each MenuItem (default: 10px) */
  menuItemPaddingY: number;
  /** Uniform inner padding (in px) of MenuContainer (default: 4px) */
  menuContainerPadding: number;
  /** Vertical padding (top & bottom in px) of Layer 1 PanelContent (default: 14px) */
  panelContentPaddingY: number;
}

export const DEFAULT_PANEL_SIZING: Record<MenuPanelId, PanelSizingConfig> = {
  'layer1-main': {
    mode: 'auto',
    width: 420,
    targetHeight: 450,
    minHeight: 240,
    maxHeight: 540,
  },
  'layer2-play': {
    mode: 'fixed',
    width: 680,
    targetHeight: 494,
    minHeight: 260,
    maxHeight: 540,
  },
  'layer2-garage': {
    mode: 'fixed',
    width: 680,
    targetHeight: 540,
    minHeight: 320,
    maxHeight: 640,
  },
  'layer2-settings': {
    mode: 'fixed',
    width: 680,
    targetHeight: 580,
    minHeight: 360,
    maxHeight: 680,
  },
  'layer2-room-host-control': {
    mode: 'fixed',
    width: 480,
    targetHeight: 560,
    minHeight: 340,
    maxHeight: 640,
  },
  'layer3-audio-detail': {
    mode: 'fixed',
    width: 480,
    targetHeight: 540,
    minHeight: 320,
    maxHeight: 620,
  },
  'layer3-ball-trajectory': {
    mode: 'fixed',
    width: 480,
    targetHeight: 540,
    minHeight: 320,
    maxHeight: 620,
  },
  'layer3-online-warmup': {
    mode: 'fixed',
    width: 480,
    targetHeight: 540,
    minHeight: 320,
    maxHeight: 620,
  },
  'layer3-bot-difficulty': {
    mode: 'auto',
    width: 500,
    targetHeight: 480,
    minHeight: 280,
    maxHeight: 560,
  },
  'layer3-self-training': {
    mode: 'auto',
    width: 500,
    targetHeight: 470,
    minHeight: 260,
    maxHeight: 560,
  },
  'layer3-custom-training': {
    mode: 'auto',
    width: 500,
    targetHeight: 480,
    minHeight: 280,
    maxHeight: 560,
  },
  'layer3-camera': {
    mode: 'fixed',
    width: 480,
    targetHeight: 540,
    minHeight: 320,
    maxHeight: 620,
  },
  'layer3-training': {
    mode: 'auto',
    width: 480,
    targetHeight: 380,
    minHeight: 240,
    maxHeight: 520,
  },
  'layer3-keybindings': {
    mode: 'fixed',
    width: 560,
    targetHeight: 560,
    minHeight: 340,
    maxHeight: 640,
  },
  'layer4-advanced-controller': {
    mode: 'fixed',
    width: 560,
    targetHeight: 560,
    minHeight: 340,
    maxHeight: 640,
  },
  'layer4-advanced-audio': {
    mode: 'fixed',
    width: 560,
    targetHeight: 560,
    minHeight: 340,
    maxHeight: 640,
  },
  'layer4-event-and-triggerer': {
    mode: 'fixed',
    width: 580,
    targetHeight: 560,
    minHeight: 340,
    maxHeight: 640,
  },
  'layer3-exp-multi-bots': {
    mode: 'fixed',
    width: 600,
    targetHeight: 580,
    minHeight: 360,
    maxHeight: 660,
  },
  'layer3-dev-subsystem-isolation': {
    mode: 'fixed',
    width: 600,
    targetHeight: 580,
    minHeight: 360,
    maxHeight: 660,
  },
  'layer3-dev-sandboxes': {
    mode: 'auto',
    width: 560,
    targetHeight: 460,
    minHeight: 280,
    maxHeight: 580,
  },
  'layer3-dev-active-tuners': {
    mode: 'fixed',
    width: 600,
    targetHeight: 580,
    minHeight: 360,
    maxHeight: 660,
  },
  'layer3-dev-calibrated-presets': {
    mode: 'auto',
    width: 540,
    targetHeight: 380,
    minHeight: 240,
    maxHeight: 520,
  },
  'layer3-dev-under-development': {
    mode: 'auto',
    width: 580,
    targetHeight: 500,
    minHeight: 300,
    maxHeight: 620,
  },
  'layer4-static-training-pack': {
    mode: 'fixed',
    width: 680,
    targetHeight: 560,
    minHeight: 360,
    maxHeight: 660,
  },
  'layer5-static-training-pack-session': {
    mode: 'fixed',
    width: 740,
    targetHeight: 580,
    minHeight: 360,
    maxHeight: 660,
  },
};

export const DEFAULT_MENU_LAYOUT_TOKENS: MenuLayoutConstants = {
  panels: DEFAULT_PANEL_SIZING,
  dividerMarginY: 2,
  menuItemGap: 4,
  menuItemPaddingY: 10,
  menuContainerPadding: 4,
  panelContentPaddingY: 14,
};
