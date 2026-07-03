export type SemanticsRole =
  | 'button'
  | 'checkbox'
  | 'radio'
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
}

export interface AccessibilityBridge {
  sync(nodes: SemanticsNodeData[]): void;
  dispose(): void;
}
