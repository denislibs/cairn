# @cairn/primitives

Core Cairn UI primitives, built on `@cairn/runtime` and `@cairn/layout`.

- `Box` — single-child container; `style`: `width`, `height`, `padding`, `backgroundColor`,
  `borderRadius`.
- `Text` — text content (string, number, or an accessor for reactivity); `style`: `font`, `color`.
- `Row` / `Column` — flex containers; `style`: `gap`, `justify`, `align`.

## Example

Use with `mount` from `@cairn/runtime` and a host from `@cairn/platform-web`. Dynamic text is a
function/accessor: `<Text>{() => String(count())}</Text>`. Styling is minimal inline for now; a
full `StyleSheet` + theme lands in a later phase.
