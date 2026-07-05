# Cairn DevTools (Chrome extension)

Inspector panel for Cairn canvas apps.

## Build

    pnpm install
    pnpm build     # outputs ./dist

## Load in Chrome

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `devtools-extension/dist`.
3. Open a page running a Cairn app that calls `installDevtools()` in dev
   (e.g. `examples/devtools-demo`).
4. Open DevTools (F12) → **Cairn** panel.

## Manual verification checklist

- [ ] Panel status shows "Cairn detected".
- [ ] Tree shows the instance hierarchy with names + dimensions.
- [ ] Clicking a node fills the properties pane (rect/offset/flex/z/flags/role).
- [ ] Hovering a tree row draws a highlight box on the canvas.
- [ ] "Inspect" then hovering the canvas highlights nodes; clicking selects
      the node in the tree.
- [ ] Interacting with the app (e.g. Increment) appends commit-log lines with
      signal/effect counts and marks changed nodes (orange outline).
