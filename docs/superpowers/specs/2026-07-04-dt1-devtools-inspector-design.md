# DT1 — Cairn DevTools (инспектор + Chrome-расширение)

**Дата:** 2026-07-04
**Статус:** дизайн утверждён, ждёт review
**Охват:** D1 (агент + инструментирование) + D2 (расширение Chrome). D3 (глубина «почему кадр», style-интроспекция, имена компонентов) — отдельный будущий цикл.

## Проблема

Приложения Cairn рендерятся в `<canvas>`. Нет способа осмотреть дерево layout, увидеть размеры/позиции элементов и понять, что и где меняется между кадрами. Отладка вслепую.

## Цель

Инструменты отладки уровня React DevTools:

1. **Инспектор дерева + свойства** — дерево `Instance`/layout с типами нод; панель свойств выбранной ноды (size, offset, констрейнты-результат, flex/z, clip/transform/opacity, cursor/pointerEvents, semantics).
2. **Подсветка на canvas** — двусторонняя: навёл на ноду в панели → рамка+размеры на canvas; «пипетка» по canvas → выбор ноды в дереве.
3. **Что изменилось** — diff между кадрами: подсветка нод с изменившимся rect/size/offset/layout-параметром + лог коммитов.
4. **Почему кадр** — какие сигналы записаны и какие эффекты пробежали за кадр (v1: счётчики + best-effort; атрибуция сигнал→компонент — D3).

## Ключевые находки по кодовой базе

- **Дерево `Instance` не пересоздаётся каждый кадр.** `mount` строит его один раз; далее fine-grained эффекты мутируют ноды на месте. Детей меняют только `<For>/<Show>/<Switch>`. → идентичность ноды стабильна → стабильные ID через `WeakMap<Instance, number>`.
- **`renderFrame` в `packages/runtime/src/mount.ts` — единственный choke-point.** Каждый кадр релэйаутит от корня и перерисовывает всю поверхность; после `paint()` доступно всё дерево с посчитанным layout.
- **Реактивность на модульных глобалах** (`writeSignal`, `runComputation`, `runUpdates` в `packages/reactivity/src/core.ts`) — точки для dev-хуков.
- **`collectSemantics` (`packages/runtime/src/semantics.ts`) уже считает абсолютные rect'ы** обходом дерева — та же математика для рамки-подсветки и hit-test пипетки.
- **Модель full-frame repaint:** пер-нодовых dirty-флагов нет, перерисовывается всё → «подсветка перерисовок» буквально бессмысленна. Реальная ценность — diff состояния (что поменяло rect/size) + «почему кадр» (что из реактивного состояния сработало).
- **Имена нод.** `Instance` безымянен; Material/widgets возвращают внутренний `Instance` от `Box`, так что имя компонента теряется. Восстанавливаем из класса layout-ноды.
- **Резолвнутый `style` в замыкании `Box`/`Text`**, на `Instance` не виден → глубокая интроспекция style-ключей вне охвата v1 (D3).

## Архитектура

Модель React DevTools: **инструментирование → агент → мост → панель**. Агент (D1) не знает про Chrome — только протокол snapshot/command. Расширение (D2) — транспорт + рендер поверх того же протокола. Это де-рискует и делает ядро тестируемым без браузера.

```
приложение (dev)                              браузерные DevTools
┌──────────────────────────────┐             ┌───────────────────────┐
│ @cairn/runtime + reactivity   │             │ панель "Cairn"        │
│   └─ dev-хуки (null-guarded)  │             │  дерево / свойства /  │
│ @cairn/devtools (агент)       │             │  лог коммитов / pick  │
│   ids/serialize/diff/         │  postMessage│                       │
│   commit-log/why-frame/       │◀───bridge──▶│                       │
│   highlight/pick              │  +runtime   │                       │
│   window.__CAIRN_DEVTOOLS_HOOK│   port      │                       │
└──────────────────────────────┘             └───────────────────────┘
        injected.ts (page) ⇄ content.ts (isolated) ⇄ devtools.ts/panel
```

### D1 — Инструментирование (в самом фреймворке, нулевая цена в проде)

Все точки за null-флагом: в проде `@cairn/devtools` не импортируется → сеттер не вызван → `hooks` остаётся `null` → ветка не берётся.

**`packages/reactivity/src/core.ts`** — экспорт `setReactiveDevHooks(h | null)`:
- в `writeSignal` (когда значение реально меняется): `hooks?.onSignalWrite(node, prev, next)`
- в `runComputation` (в начале): `hooks?.onComputationRun(node)`
- в фабрике сигнала (`signal.ts`): `hooks?.onSignalCreate(node)`

**`packages/runtime`** — новый `devtools-hook.ts` c `setRuntimeDevHooks({ onCommit } | null)`; вызов в `mount.renderFrame` после `paint(...)`: `hooks?.onCommit(root, ctx.viewport)`.

**`packages/runtime/src/instance.ts`** — добавить опциональное `debugName?: string` в интерфейс `Instance` (undefined по умолчанию). Проставление имён в primitives/material — D3.

Правка ядра: ~6 строк вызовов + один опциональный сеттер на пакет + одно опциональное поле.

### D1 — Агент `@cairn/devtools`

DOM-free ядро + тонкий web-слой (highlight/pick трогают DOM). Модули:

- **`ids.ts`** — `WeakMap<Instance, number>` (стабильные ID) + обратный `Map<number, WeakRef<Instance>>` для резолва команд.
- **`serialize.ts`** — обход дерева → `SnapshotNode`:
  `{ id, name, rect{x,y,w,h абс.}, size{w,h}, offset{x,y}, layout{flex,zIndex,margin,left?,top?,right?,bottom?}, flags{clip,transform,opacity,focusable,pointerEvents}, semantics?{role,label}, children: SnapshotNode[] }`.
  Абсолютный rect накоплением offset (+ transform) вниз по дереву — как в `collectSemantics`.
- **`name.ts`** — инференс имени: `debugName` если задан; иначе по классу layout-ноды: `FlexNode`→`Row`/`Column` (по direction), `BoxNode`→`Box`, `TextNode`→`Text`, `StackNode`→`Stack`, `ScrollNode`→`ScrollView`, `GridNode`→`Grid`; фолбэк — имя класса.
- **`diff.ts`** — prev↔next snapshot: множество ID с изменившимся rect/size/offset/layout-параметром (с дельтами полей) + структурные add/remove.
- **`commit-log.ts`** — кольцевой буфер `{ frame#, changedIds[], signalWrites, effectRuns }` (фиксированная ёмкость, напр. 100).
- **`why-frame.ts`** — подписан на реактивные хуки; копит счётчики записей сигналов / пробегов эффектов между коммитами; на `onCommit` вешает на запись `commit-log` и сбрасывает.
- **`highlight.ts`** — DOM-оверлей над canvas (position:fixed, pointer-events:none): id → абс. rect → page-px через `canvas.getBoundingClientRect()` + масштаб (canvas-space → CSS-px). Рисует content-бокс (+ margin как отдельный слой).
- **`pick.ts`** — режим inspect: слушает `pointermove` на host-элементе canvas; hit-test rect'ов текущего snapshot (верхний по z, затем по порядку); подсветка + hover id; клик → `selection`.
- **`agent.ts`** — `installDevtools(options?)`: ставит reactive+runtime хуки, коалесит коммиты (троттлинг снапшотов), публикует `window.__CAIRN_DEVTOOLS_HOOK__`. Идемпотентно; повторный вызов — no-op.

**API хука** (`window.__CAIRN_DEVTOOLS_HOOK__`):
```
{ version: string,
  subscribe(cb: (evt: AgentEvent) => void): () => void,
  send(cmd: PanelCommand): void,
  getSnapshot(): SnapshotNode }
```

### Протокол (транспорт-независимый)

Агент → панель (`AgentEvent`):
- `{ type:'hello', version }`
- `{ type:'commit', snapshot: SnapshotNode, changed: ChangedNode[], meta:{ frame, signalWrites, effectRuns } }`
- `{ type:'selection', id }`

Панель → агент (`PanelCommand`):
- `{ type:'inspect-start' } | { type:'inspect-stop' }`
- `{ type:'highlight', id: number | null }`
- `{ type:'select', id: number }`
- `{ type:'get-snapshot' }`

v1: на каждый (троттлённый) коммит отправляется полный snapshot; панель сама держит предыдущий для UI-diff. Дельта-протокол — будущая оптимизация.

### D2 — Расширение Chrome

Каталог `devtools-extension/` вне пакетов фреймворка, своя сборка (esbuild, Manifest V3):

- **`injected.ts`** (page world) — читает `window.__CAIRN_DEVTOOLS_HOOK__`, ретранслирует `AgentEvent` через `window.postMessage`; принимает команды и зовёт `hook.send`. Инжектится content-скриптом, чтобы бежать в мире страницы.
- **`content.ts`** (isolated world) — мост `window.postMessage` ↔ `chrome.runtime` port до devtools-страницы.
- **`devtools.ts`** — `chrome.devtools.panels.create('Cairn', …)`.
- **`panel/`** — UI на голом TS + DOM:
  - дерево (сворачивание/разворот, выбор, наведение → команда `highlight`),
  - панель свойств выбранной ноды,
  - лог коммитов с подсветкой изменённых ID и счётчиками signals/effects,
  - тумблер inspect (`inspect-start/stop`).
- **`manifest.json`** — MV3 (`devtools_page`, content_scripts, web_accessible_resources для injected).

**Детекция:** приложение в dev делает `installDevtools()`; панель показывает «Cairn detected» по `hello`, иначе «Cairn на странице не найден».

## Данные и поток

1. Кадр → `renderFrame` → `paint` → `onCommit(root, viewport)`.
2. Агент: `serialize(root)` → `diff(prev, next)` → пишет `commit-log` (+why-frame счётчики) → эмитит `commit` подписчикам (троттлинг).
3. injected ловит через `subscribe`, шлёт `postMessage` → content → port → панель.
4. Панель рендерит дерево/лог; наведение/выбор/inspect → команды обратно тем же путём → `hook.send` → агент (highlight/pick/selection).

## Обработка ошибок и деградация

- Нет расширения / не вызван `installDevtools` → хуки `null`, нулевой оверхед, приложение не знает о devtools.
- Агент есть, панель закрыта → `subscribe` без подписчиков, snapshot'ы не строятся (ленивость: сериализуем только при наличии подписчиков).
- `WeakRef` в обратной мапе может отдать `undefined` (нода собрана) → команда по устаревшему id безопасно игнорируется.
- injected не находит хук → шлёт `hello`-miss, панель показывает «не найден».

## Тестирование

**Unit (vitest, преимущественно DOM-free):**
- стабильность ID между коммитами;
- `serialize`: корректные абс. rect / вложенность / имена;
- `diff`: верные множества изменённых + дельты; структурные add/remove;
- `name`: инференс по классам layout-нод и по `debugName`;
- `commit-log`: кольцевой буфер, вытеснение;
- hit-test пипетки: верхний по z, попадание/промах;
- протокол: encode/decode round-trip;
- `highlight`: rect-математика canvas-space→page-px со stub `getBoundingClientRect`.

**Интеграция:**
- `examples/devtools-demo` с `installDevtools()`;
- Playwright: `window.__CAIRN_DEVTOOLS_HOOK__` эмитит `commit`; `select`/`highlight` ставят DOM-рамку; пипетка выбирает ноду под курсором.

**Расширение:** панель в headless-Chrome капризна → smoke-проверка загрузки расширения + ручной чек-лист в `devtools-extension/README.md`.

## Вне охвата (D3+)

- Глубокая интроспекция style-ключей (требует `debugStyle` в primitives).
- Осмысленные имена компонентов (`debugName` в primitives/material — «Button» вместо «Box»).
- Атрибуция сигнал→компонент, имена сигналов, профайлер-таймлайн.
- Дельта-протокол снапшотов, редактирование свойств на лету.

## Затрагиваемые файлы

**Правки ядра:**
- `packages/reactivity/src/core.ts`, `signal.ts` — dev-хуки + сеттер.
- `packages/runtime/src/mount.ts` — вызов `onCommit`; новый `devtools-hook.ts`; `instance.ts` — поле `debugName?`.

**Новый пакет `packages/devtools/`:**
- `ids.ts`, `serialize.ts`, `name.ts`, `diff.ts`, `commit-log.ts`, `why-frame.ts`, `highlight.ts`, `pick.ts`, `agent.ts`, `index.ts`, `protocol.ts` (+ тесты).

**Новый `devtools-extension/`:**
- `manifest.json`, `injected.ts`, `content.ts`, `devtools.ts`, `panel/` (html/ts/css), сборка, `README.md`.

**Примеры:**
- `examples/devtools-demo/`.
