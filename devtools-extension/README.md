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
- [ ] Tree shows component names (Button/Card/Chip), not just Box/Row/Text.
- [ ] Selecting a node shows a Style section (backgroundColor/padding/…).
- [ ] Commit log lines show changed signal names (e.g. `signals:[count]`) and frame duration.
- [ ] Profiler strip shows a bar per commit; taller = slower frame.
- [ ] Panel matches the dark mockup (toolbar, Elements/Performance tabs, Styles/Computed/Signals).
- [ ] Selecting a node shows its Styles; editing a value (e.g. backgroundColor) repaints the canvas.
- [ ] The checkbox toggles a property off/on on the live canvas.
- [ ] "+ add property" adds a style that appears on the canvas.
- [ ] Signals tab lists signals seen in recent commits; Performance shows frame durations + stats.
- [ ] Signals tab lists all signals with current values (named ones by name, others as #id).
- [ ] Editing a scalar signal's value updates the app and highlights changed nodes in the tree.
- [ ] Object/other signals are shown read-only.
- [ ] Performance tab shows a phase flame (layout/a11y/paint) for the slowest frame with a ms scale.
- [ ] Record captures a window of frames; Stop freezes it; Reload re-renders.
- [ ] Stats show avg commit / slowest frame / frames over budget / effects run.
- [ ] Selecting a signal in the Signals tab shows a dependency flow (signal → effect → node chips).
- [ ] The nodes a signal updates are highlighted in the tree; clicking a node chip opens that node.
