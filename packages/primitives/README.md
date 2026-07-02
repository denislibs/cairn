# @cairn/primitives

Core Cairn UI primitives, built on `@cairn/runtime` and `@cairn/layout`.

- `Box` — single-child container; `style`: `width`, `height`, `padding`, `backgroundColor`,
  `borderRadius`.
- `Text` — text content (string, number, or an accessor for reactivity); `style`: `font`, `color`.
- `Row` / `Column` — flex containers; `style`: `gap`, `justify`, `align`.

## Example

Use with `mount` from `@cairn/runtime` and a host from `@cairn/platform-web`. Dynamic text is a
function/accessor: `<Text>{() => String(count())}</Text>`.

## Styling

Primitives accept `style` as a `Style`, a `Style[]` (cascade), or a `(theme) => Style` function
(from `@cairn/style`). Wrap a subtree in `ThemeProvider` to provide theme tokens:

    <ThemeProvider theme={theme}>{() => <App />}</ThemeProvider>

Inside, `style={(t) => ({ backgroundColor: t.colors.surface })}` reads the provided theme.
Live state activation (hover/focus) arrives with the events phase.
