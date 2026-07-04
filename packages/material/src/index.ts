export { parseHex, toHex, lighten, darken, alpha, luminance, contrastText } from './colors';
export { stateLayerOpacity, stateOverlay } from './state-layer';
export type { InteractionState } from './state-layer';
export { createMaterialTheme } from './theme';
export { createRipple } from './ripple';
export type { RippleHandle } from './ripple';
export type {
  PaletteColor,
  Palette,
  TypographyVariant,
  TypographyVariantName,
  TypographyScale,
  MaterialTheme,
  MaterialThemeOptions,
} from './theme';
export { Button } from './button';
export type { ButtonProps, MaterialColor, ButtonVariant } from './button';
export { IconButton } from './icon-button';
export type { IconButtonProps } from './icon-button';
export { Fab } from './fab';
export type { FabProps } from './fab';
export { Checkbox } from './checkbox';
export type { CheckboxProps } from './checkbox';
export { Radio, RadioGroup, radioGroupContext } from './radio';
export type { RadioProps } from './radio';
export { Switch } from './switch';
export type { SwitchProps } from './switch';
export { TextField } from './textfield';
export type { TextFieldProps, TextFieldVariant } from './textfield';
export { Select, Option } from './select';
export type { SelectProps, OptionProps, SelectOptionItem } from './select';

// ─── MT5 — surfaces ─────────────────────────────────────────────────────────
export { Paper } from './paper';
export type { PaperProps } from './paper';
export { Card } from './card';
export type { CardProps, CardVariant, CardContentProps, CardActionsProps } from './card';
export { AppBar } from './appbar';
export type { AppBarProps, AppBarColor, AppBarTitleProps } from './appbar';
export { List, listContext } from './list';
export type { ListProps, ListItemProps, MaterialListInstance } from './list';

// ─── MT6 — feedback + navigation ────────────────────────────────────────────
export { Dialog } from './dialog';
export type {
  DialogProps, DialogTriggerProps, DialogContentProps, DialogTitleProps,
  DialogDescriptionProps, DialogActionsProps, DialogCloseProps,
} from './dialog';
export { SnackbarProvider, SnackbarItem, useSnackbar } from './snackbar';
export type { SnackbarProviderProps, SnackbarItemProps, SnackbarOptions } from './snackbar';
export { Tabs } from './tabs';
export type { TabsProps, TabsListProps, TabProps, TabsPanelProps, TabsInstance } from './tabs';
export { Chip } from './chip';
export type { ChipProps, ChipColor, ChipVariant, ChipSize } from './chip';
export { Badge } from './badge';
export type { BadgeProps } from './badge';
export { LinearProgress, CircularProgress } from './progress';
export type { LinearProgressProps, CircularProgressProps } from './progress';
