# DT3 — Cairn DevTools depth (names + style + why-frame + profiler)

**Дата:** 2026-07-05
**Статус:** дизайн утверждён, ждёт review
**Охват:** D3 поверх влитых D1+D2 (PR #53). Четыре группы: D3a имена компонентов, D3b style-интроспекция, D3c «почему кадр» (список сигналов), D3d профайлер + дельта-протокол.

## Проблема

DT1/DT2 дали инспектор дерева, подсветку, пипетку, diff, счётчики «почему кадр» и Chrome-расширение. Но инструмент пока «слепой» на двух фронтах:
- дерево показывает `Box/Row/Text` вместо `Button/Card/Chip` — для реального приложения почти не читается;
- панель свойств показывает только layout-факты (size/offset/flex), но не резолвнутый style (цвета/паддинги) — нельзя отлаживать «почему не тот цвет/отступ»;
- «почему кадр» — только счётчики (N сигналов, M эффектов), без указания, какие именно;
- нет замера длительности кадра и истории (профайлера).

## Цель

1. **Имена компонентов** — дерево показывает `Button/Card/Chip/TextField/Dialog/...`.
2. **Style-интроспекция** — панель свойств показывает резолвнутые цвета/паддинги/бордеры/шрифт/opacity.
3. **«Почему кадр»** — список изменившихся сигналов за кадр (id + имя, если задано).
4. **Профайлер** — длительность каждого кадра + таймлайн истории коммитов; дельта-протокол снапшотов.

## Ключевые находки по кодовой базе

- **`packages/primitives/src/box.ts`**: резолвнутый style хранится в замыкании `let current: BaseStyle` и обновляется в `bind(styleSource, (s) => { current = s; ... })` (строка ~184). `text.ts` — тот же паттерн. → `debugStyle` можно выставлять там же одной строкой, живо обновляется.
- **`packages/material/src/button.ts`**: `return HeadlessButton(headlessProps)` — Material возвращает внутренний `Instance` от `Box`, имя компонента теряется. Внешняя фабрика ставит `inst.debugName` перед возвратом → перебивает внутренний инференс. То же во всех material/widgets.
- **`Instance.debugName?: string`** уже добавлено в DT1 — фабрикам достаточно его выставить; сериализатор уже предпочитает `debugName` инференсу (`name.ts`).
- **`packages/reactivity/src/signal.ts`**: `createSignal(value, options?)`; `SignalState` не имеет поля `name`. Для именования сигналов нужно опциональное `SignalState.name`, ставится из `options.name`.
- **`packages/reactivity/src/core.ts`**: dev-хук `onSignalWrite(node, prev, next)` уже есть (DT1) — агент может читать `node.name`/раздавать id.
- **`packages/runtime/src/mount.ts`**: `renderFrame` — единственный choke-point; `emitCommit(root, ctx.viewport)` вызывается после `paint`. Для `durationMs` замер `performance.now()` вокруг layout+paint здесь.
- **Атрибуция эффект→инстанс НЕ делается в D3**: `bind` создаёт эффекты во время исполнения фабрики, «текущего инстанса» в рантайме нет, дерево строится снизу вверх — прямой связи нет. Полный граф сигнал→компонент требует ambient-стека и риска на горячем пути → отложено в D4.

## Архитектура

Те же слои, что DT1 (инструментирование → агент → мост → панель). D3 расширяет данные, текущие по протоколу, и добавляет проставление имён/стилей в фабриках. Ядро-правки — дешёвые присваивания, не на горячем пути.

### D3a — Имена компонентов

- В каждой фабрике `@cairn/widgets` и `@cairn/material`, которая возвращает обёрнутый `Instance`, установить `inst.debugName = '<ComponentName>'` перед `return`. Внешняя (Material) фабрика перебивает внутреннюю (widget), внутренняя — примитив. Примитивы `Box/Row/Column/Text/Stack/ScrollView/Grid` уже корректно выводятся из класса layout — их не трогаем.
- Список (widgets): Button, Checkbox, Radio, Switch, Slider, TextField/Input, Select, Combobox, Tabs(.Tab/.Panel/.List), Accordion, Stepper, Breadcrumbs, Pagination, Dialog, Drawer, Toast, Card, Avatar, Badge, Chip, Progress, Skeleton, List, Table (по факту наличия в пакете — проставить каждому корневому возвращаемому инстансу).
- Список (material): Button, IconButton, Fab, Checkbox, Radio, Switch, TextField, Select, Paper, Card, AppBar, List, Dialog, Snackbar, Tabs, Chip, Badge, LinearProgress, CircularProgress.
- Пользовательские компоненты: поле `inst.debugName` публично — пользователь может ставить сам; отдельного API не вводим (YAGNI).
- Стоимость в проде: одно присваивание строкового литерала на инстанс компонента — ничтожно, всегда включено (как `displayName` в React). Без dev-флага.

### D3b — Style-интроспекция

- `Instance.debugStyle?: BaseStyle` (новое опциональное поле в `packages/runtime/src/instance.ts`).
- `box.ts` и `text.ts`: в bind-колбэке, где уже присваивается `current = s`, добавить `instance.debugStyle = s`. Объект уже удерживается `current` — доп. памяти нет.
- `serialize.ts`: если `inst.debugStyle` есть, положить в `SnapshotNode.style?: Record<string, unknown>` JSON-safe whitelist ключей: `backgroundColor, color, padding, border, borderRadius, opacity, font, gap, boxShadow`. Значения-объекты (`padding {top,right,bottom,left}`, `border {width,color,style}`) копируются плоско; функции/несериализуемое отбрасываются. Отсутствующие ключи не включаются.
- Протокол: `SnapshotNode.style?: Record<string, unknown>` (опционально).
- Панель: секция «Style» в панели свойств (key/value, как layout-факты). DOM-safe (`textContent`).
- Стоимость: одно присваивание ссылки в уже существующем bind-колбэке — ничтожно, всегда включено.

### D3c — «Почему кадр» (список сигналов)

- **Именование сигналов:** `SignalOptions.name?: string`; `createSignal` кладёт его в `SignalState.name` (новое опциональное поле в core). Правка reactivity — одно поле + одна строка в `createSignal`. Обратная совместимость полная (опционально).
- **Идентификация в агенте:** `WhyFrameTracker` раздаёт стабильный числовой id каждому сигналу через `WeakMap<SignalState, number>` в `onSignalCreate`; в `onSignalWrite` копит множество изменившихся `{ id, name? }` за текущий кадр (name из `node.name`).
- **Проброс:** `CommitMeta.signals: { id: number; name?: string }[]` — список сигналов, изменившихся в этом кадре (дедуп по id). `CommitEntry.signals` в лог-буфере — аналогично. Существующие счётчики `signalWrites/effectRuns` сохраняются.
- **Панель:** в логе коммитов/панели показывать список изменившихся сигналов (`name` или `#id`).
- **Вне охвата D3 (→ D4):** граф сигнал→компонент (какая нода перерисовалась из-за сигнала); site-захват имён безымянных сигналов.

### D3d — Профайлер + дельта-протокол

- **Длительность кадра:** `mount.renderFrame` меряет `performance.now()` в начале и после `endFrame()` → `durationMs`; сигнатура рантайм-хука расширяется до `onCommit(root, viewport, durationMs)` (владеем контрактом; агент — единственный потребитель). Замер дёшев (2 вызова now()); выполняется всегда, `emitCommit` no-op без хуков.
- **Проброс:** `CommitMeta.durationMs: number` + `CommitEntry.durationMs`.
- **Профайлер-панель:** горизонтальный таймлайн из `commit-log` — столбик на коммит, высота ∝ `durationMs`, цвет ∝ числу изменённых нод; клик по столбику → показать этот коммит (снапшот + сигналы). DOM-safe.
- **Дельта-протокол:** новое событие `commit-delta { added: SnapshotNode[]; removed: number[]; changed: { id, patch }[]; meta }` — агент после первого полного `commit` шлёт структурные дельты; панель держит дерево и применяет. Первый снапшот и `get-snapshot` — всегда полные. Функция `applyDelta(prev, delta) → next` (чистая, в `@cairn/devtools`, переиспользуется тестами и панелью).
- **Риск/трим:** дельта — единственная чисто-оптимизационная часть с наибольшей сложностью (stateful-реконструкция дерева в панели). Если при реализации сложность окажется несоразмерной ценности, профайлер оставляем, дельту выносим в D4 (плановая задача помечает это как точку решения). Полный снапшот на коммит уже работает для обычных деревьев.

## Протокол (дополнения к DT1)

- `SnapshotNode.style?: Record<string, unknown>` (D3b).
- `CommitMeta`: добавить `signals: { id: number; name?: string }[]` (D3c) и `durationMs: number` (D3d).
- `AgentEvent` новый вариант: `{ type: 'commit-delta'; added: SnapshotNode[]; removed: number[]; changed: { id: number; patch: Partial<SnapshotNode> }[]; meta: CommitMeta }` (D3d).
- Обратная совместимость: панель DT2 игнорирует незнакомые поля/варианты; новые поля опциональны там, где возможно.

## Обработка ошибок и деградация

- `debugName`/`debugStyle` отсутствуют → сериализатор фолбэчит на инференс имени и опускает `style` (как в DT1).
- Безымянный сигнал → показывается как `#id`.
- `performance.now` недоступен (не-браузерный тест) → `durationMs = 0` (guard).
- Дельта не может примениться (рассинхрон) → панель запрашивает `get-snapshot` (полный) и продолжает.

## Тестирование

**Unit (vitest, DOM-free где можно):**
- D3a: выборка widgets/material фабрик выставляет ожидаемый `debugName`; `serialize` отдаёт это имя.
- D3b: `box`/`text` проставляют `debugStyle`; `serialize` кладёт whitelist в `SnapshotNode.style`, объекты плоско, несериализуемое отброшено, при отсутствии — поле опущено.
- D3c: `SignalState.name` пробрасывается из `createSignal({name})`; `WhyFrameTracker` собирает изменившиеся `{id,name}` за кадр (дедуп); id стабилен.
- D3d: `mount` кладёт `durationMs` в meta (fake performance.now); `applyDelta(prev, delta)` round-trip = полный `serialize` следующего кадра (property-тест на несколько мутаций дерева).

**Интеграция (Playwright, расширить `examples/devtools-demo`):**
- дерево содержит узел с именем `Button` (демо использует material Button);
- `get-snapshot` → у ноды есть `style.backgroundColor`/`style.padding`;
- клик по кнопке → следующий commit-meta несёт `signals` (именованный сигнал `count`) и `durationMs > 0`.

**Расширение:** ручной чек-лист (Style-секция, список сигналов в логе, таймлайн профайлера, дельта-обновления) в `devtools-extension/README.md`.

## Вне охвата (D4+)

- Граф сигнал→компонент (атрибуция перерисовок к нодам).
- Site-захват имён безымянных сигналов.
- Редактирование свойств/стиля на лету из панели.
- (Возможно) дельта-протокол, если вынесен из D3d при реализации.

## Затрагиваемые файлы

**Правки ядра:**
- `packages/reactivity/src/signal.ts` + `core.ts` — `SignalOptions.name` → `SignalState.name`.
- `packages/runtime/src/instance.ts` — `debugStyle?: BaseStyle`.
- `packages/runtime/src/mount.ts` + `devtools-hook.ts` — `durationMs`, расширение `onCommit`.
- `packages/primitives/src/box.ts`, `text.ts` — `instance.debugStyle = s`.
- `packages/widgets/src/*.ts`, `packages/material/src/*.ts` — `inst.debugName`.

**`@cairn/devtools`:**
- `protocol.ts` — `SnapshotNode.style`, `CommitMeta.signals/durationMs`, `commit-delta`.
- `serialize.ts` — style whitelist.
- `why-frame.ts` — signal ids + changed-signals set.
- `delta.ts` (новый) — `computeDelta`/`applyDelta`.
- `agent.ts` — прокинуть signals/durationMs; опц. дельта-эмиссия.

**Расширение:** `panel/panel.ts` — Style-секция, signals в логе, профайлер-таймлайн, применение дельт.

**Пример/тесты:** `examples/devtools-demo` (material Button + именованный сигнал), Playwright-спеки.
