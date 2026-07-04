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
  | 'combobox'
  | 'dialog'
  | 'group'
  | 'heading'
  | 'image'
  | 'tooltip'
  | 'status'
  | 'alert'
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
  /** textbox: current text value to reflect in the native input element */
  placeholder?: string;
  /** textbox: called when the native input changes value */
  onInput?: (value: string) => void;
  /** textbox: true if the field is a multi-line textarea */
  multiline?: boolean;
  rect: { x: number; y: number; width: number; height: number };
  onActivate?: () => void;
  onFocus?: (keyboard: boolean) => void;
  onBlur?: () => void;
  onKeyDown?: (key: string, mods: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => boolean;
  autoFocus?: boolean;
  /** True if this node is a modal dialog/drawer that traps focus. */
  modal?: boolean;
  /** The id of the nearest ancestor (or self) with modal:true; undefined for non-modal subtrees. */
  modalGroup?: number;
}

export interface AccessibilityBridge {
  sync(nodes: SemanticsNodeData[]): void;
  focus(id: number): void;
  announce(message: string, assertive?: boolean): void;
  dispose(): void;
}
