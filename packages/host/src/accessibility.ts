export type SemanticsRole =
  | 'button'
  | 'checkbox'
  | 'radio'
  | 'radiogroup'
  | 'switch'
  | 'textbox'
  | 'link'
  | 'slider'
  | 'tab'
  | 'menuitem'
  | 'option'
  | 'listbox'
  | 'menu'
  | 'dialog'
  | 'group'
  | 'heading'
  | 'image'
  | 'none';

export interface SemanticsNodeData {
  id: number;
  role: SemanticsRole;
  label?: string;
  value?: string;
  checked?: boolean | 'mixed';
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  level?: number;
  min?: number;
  max?: number;
  now?: number;
  focusable?: boolean;
  rect: { x: number; y: number; width: number; height: number };
  onActivate?: () => void;
  onFocus?: (keyboard: boolean) => void;
  onBlur?: () => void;
  onKeyDown?: (key: string, mods: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => boolean;
  autoFocus?: boolean;
}

export interface AccessibilityBridge {
  sync(nodes: SemanticsNodeData[]): void;
  focus(id: number): void;
  announce(message: string, assertive?: boolean): void;
  dispose(): void;
}
