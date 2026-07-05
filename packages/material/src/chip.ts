import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Chip as HeadlessChip, type ChipProps as HeadlessChipProps } from '@cairn/widgets';
import { alpha } from './colors';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

// 'default' is a special sentinel for the grey/neutral chip that has no palette slot.
export type ChipColor = MaterialColor | 'default';
export type ChipVariant = 'filled' | 'outlined';
export type ChipSize = 'small' | 'medium';

export interface ChipProps {
  label: string;
  color?: ChipColor;
  variant?: ChipVariant;
  size?: ChipSize;
  onClick?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  /** Leading icon instance rendered before the label. */
  icon?: Instance;
  /** Leading avatar instance rendered before the label. */
  avatar?: Instance;
}

// Grey color used for the 'default' chip (not tied to any palette key).
const DEFAULT_CHIP_MAIN = '#757575';

export function Chip(props: ChipProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;

  const variant = props.variant ?? 'filled';
  const size = props.size ?? 'medium';
  const disabled = !!props.disabled;

  // Resolve palette color. 'default' → neutral grey (not in the palette).
  const isDefault = !props.color || props.color === 'default';
  const colorMain: string = isDefault
    ? DEFAULT_CHIP_MAIN
    : (t.palette[props.color as MaterialColor]?.main ?? DEFAULT_CHIP_MAIN);

  // Material styling per variant:
  //   filled  → tonal / M2 soft chip: subtle alpha bg + colored text
  //   outlined → transparent bg + divider border
  let bgColor: string;
  let borderStyle: { width: number; color: string } | undefined;

  if (variant === 'filled') {
    bgColor = alpha(colorMain, 0.12);
    borderStyle = undefined;
  } else {
    // outlined
    bgColor = 'transparent';
    borderStyle = { width: 1, color: t.palette.divider };
  }

  // Size → headless size mapping
  const headlessSize: 'sm' | 'md' = size === 'small' ? 'sm' : 'md';

  // Leading: icon takes priority over avatar; headless Chip accepts `leading`.
  const leading: Instance | undefined = props.icon ?? props.avatar;

  // Map Material variant to headless variant. We override the bg colour via
  // `style` so headless variant choice only affects the base look (soft / outline).
  // Using 'soft' for filled (semi-transparent default) and 'outline' for outlined.
  const headlessVariant: 'soft' | 'outline' = variant === 'filled' ? 'soft' : 'outline';

  // Build the style override that Material applies over the headless pill Box.
  // We only override what diverges from headless defaults (bg, border, opacity).
  const materialStyle = {
    backgroundColor: bgColor,
    ...(borderStyle ? { border: borderStyle } : {}),
    opacity: disabled ? 0.38 : 1,
    cursor: (props.onClick && !disabled) ? 'pointer' : 'default',
  };

  const headlessProps: HeadlessChipProps = {
    label: props.label,
    // Map Material color key to widget-theme color key.
    // For 'default', we pass 'secondary' so the text color uses a neutral grey tone.
    // In Material context, useWidgetTheme() merges MaterialTheme.colors.secondary
    // (= palette.secondary.main) as the base; the style override sets the actual bg.
    color: isDefault ? 'secondary' : (props.color as string),
    variant: headlessVariant,
    size: headlessSize,
    onClick: props.onClick,
    onDelete: props.onDelete,
    disabled,
    leading,
    style: materialStyle,
  };

  const inst = HeadlessChip(headlessProps);
  inst.debugName = 'Chip';
  return inst;
}
