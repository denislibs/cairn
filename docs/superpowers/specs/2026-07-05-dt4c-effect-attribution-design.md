# DT4c — Effect→node attribution + signal dependency graph

**Дата:** 2026-07-05
**Статус:** реализовано (DT4c)
**Охват:** D4c поверх DT1–D4d. Атрибуция реактивных рендер-эффектов к инстансам (нодам), чтобы построить статический граф **сигнал→эффект→нода** и оживить dep-панель мокапа: «выбрал сигнал → показались/подсветились ноды, которые он обновит». **Flame по именованным эффектам вынесен в отдельный будущий срез** (нужен ещё per-effect тайминг).

## Проблема

Панель Signals (D4b) показывает сигналы и их правку, dep-панель мокапа («Dependency graph… select a signal to see what it updates») — заглушка. Подсветка изменившихся нод сейчас только ПОСЛЕ правки (через commit-diff). Пользователь хочет статически видеть, какие ноды обновит сигнал, ДО правки — как в мокапе (`сигнал → эффекты → node-чипы`).

## Цель

1. **Атрибуция эффект→нода** — каждый рендер-эффект, созданный примитивом (bind стиля/текста, `Show`), помечается инстансом, которым он владеет.
2. **Граф сигнал→нода** — по сигналу: его наблюдатели-эффекты (`SignalState.observers`) → инстансы (из атрибуции) → ноды.
3. **Dep-панель** — выбор сигнала показывает поток `сигнал → эффект(label) → node-чипы` и подсвечивает затрагиваемые ноды в дереве.

## Ключевые находки по кодовой базе

- **`createEffect` прогоняет эффект синхронно** (`effect.ts`: `runUpdates(() => scheduleEffect(node))` дренит сразу), а **`onComputationRun(node)` срабатывает в начале `runComputation`** (`core.ts:129`), до `node.fn()`. → Первый прогон bind-эффекта происходит СИНХРОННО внутри фабрики примитива; можно затегать его, не добавляя новый реактивный хук.
- **Рендер-эффекты создаются в известных местах:** `bind(value, apply)` (`runtime/src/reactive-props.ts`) — стиль-бинды `box/text/flex/grid/scroll` и текст-контент; `createEffect` в `Show` (`runtime/src/show.ts:26`). Реактивный `bind` создаёт эффект только если value — функция (у примитивов стиль всегда реактивный аксессор).
- **`SignalState.observers: Computation[]`** — наблюдатели сигнала (эффекты+мемо; фильтр `isEffect`). Реестр сигналов (D4b) хранит `WeakRef<SignalState>` и умеет `resolve(id)`.
- **Инстанс уже в области видимости** фабрики примитива на момент создания bind (`const instance = {...}; bind(...)`). Достаточно обернуть создание эффекта ambient-контекстом.
- **Ограничение:** если фабрика исполняется ВНУТРИ активного апдейт-батча (реактивно созданное поддерево в `For`/`Show`), `runUpdates` не дренит сразу — первый прогон эффекта случится позже, вне ambient → такой эффект не затегается. Атрибуция best-effort: полная для стартового дерева, возможны пропуски в динамических поддеревьях.

## Архитектура

### 1. Ambient dev-owner (`packages/runtime/src/dev-owner.ts`, новый)

```ts
import type { Instance } from './instance';
export interface DevOwner { inst: Instance; label: string }
let current: DevOwner | null = null;
let active = false;
export function activateDevOwner(): void { active = true; }          // called by installDevtools
export function deactivateDevOwner(): void { active = false; current = null; }
export function runWithDevOwner<T>(inst: Instance, label: string, fn: () => T): T {
  if (!active) return fn();                                           // zero prod cost
  const prev = current; current = { inst, label };
  try { return fn(); } finally { current = prev; }
}
export function getDevOwner(): DevOwner | null { return active ? current : null; }
```
Экспорт из runtime index. Прод-путь (не activated): `runWithDevOwner` = прямой вызов `fn()`, `getDevOwner` = null.

### 2. Примитивы оборачивают создание эффекта

- `box/flex/grid/scroll-view` (стиль-бинд): `runWithDevOwner(instance, 'style', () => bind(styleSource, (raw) => { ... }))`.
- `text`: стиль-бинд `'style'`; текст-контент бинд `runWithDevOwner(instance, 'text', () => bind(content, ...))`.
- `Show`: `runWithDevOwner(instance, 'show', () => createEffect(...))` вокруг его эффекта.
Инстанс — тот же объект, что получает id в снапшоте (для box/text/flex/grid — `instance`; scroll-view — тот же, что в дереве; если идентичность расходится, как со style-override, — пропустить и отметить).

### 3. Атрибуция в агенте (`@cairn/devtools`)

- Новый `effect-owner.ts`: `WeakMap<Computation, { instanceId: number; label: string }>` + API `tag(node, instanceId, label)`, `get(node)`.
- Композитный реактивный хук агента (D4b) в `onComputationRun`: 
  ```
  onComputationRun: (n) => {
    why.noteEffectRun(n);                         // существующее
    if (n.isEffect) {
      const owner = getDevOwner();
      if (owner && !effectOwner.get(n)) effectOwner.tag(n, idOf(owner.inst), owner.label);
    }
  }
  ```
  Тег ставится на первом прогоне, пока ambient стоит; повторные прогоны — no-op (`!get(n)`).

### 4. Граф (протокол + агент)

- `SignalGraph { effects: { label: string; nodeId: number }[]; nodeIds: number[] }` (`nodeIds` — дедуп union затрагиваемых нод).
- `PanelCommand` += `{ type: 'signal-graph'; id: number }`.
- `AgentEvent` += `{ type: 'signal-graph'; id: number; graph: SignalGraph }`.
- Агент: `signal-graph` → `registry.resolve(id)` → `node.observers.filter(isEffect)` → для каждого `effectOwner.get(effect)` → собрать `{label, nodeId}` (пропустить незатеганные) → `nodeIds` = уникальные → emit.

### 5. Панель (dep-панель)

- При выборе сигнала в Signals-табе: `send({ type:'signal-graph', id })`.
- На событие `signal-graph`: отрисовать в dep-блоке поток (мокап `.flow`): корень = имя сигнала; по эффектам — строка `label()` + node-чипы `<Tag> dims` (клик → выбрать ноду: переключить subtab на Styles + select id + scroll). Подсветить `nodeIds` в дереве классом `.affected` (уже есть).
- Пустой граф (нет затеганных эффектов) → «no attributed nodes (best-effort — dynamic subtrees may be missing)».
- DOM-safe (`textContent`), из `@cairn/devtools` только `import type`.

## Данные и поток

Старт: примитивы создают эффекты внутри `runWithDevOwner` → агентский `onComputationRun` тегает эффект→{instanceId,label}. Позже: панель, выбор сигнала → `signal-graph{id}` → агент: сигнал.observers → effectOwner → `SignalGraph` → панель рисует поток + подсвечивает ноды.

## Обработка ошибок и деградация

- Прод (не activated) → `runWithDevOwner` = прямой `fn()`, тегирования нет, ноль стоимости.
- Эффект без владельца (реактивно созданное поддерево / не примитивный эффект) → нет в `effectOwner` → пропускается в графе (best-effort).
- **Сигнал в условии `Show`/`Switch`** читается ВНУТРИ `createMemo` (`cond`/`chosen`), поэтому прямой наблюдатель сигнала — мемо (`isEffect:false`, отфильтровывается), а не структурный `'show'`/`'switch'`-эффект (он наблюдает мемо, не сам сигнал). → такой сигнал даёт пустой граф. `For` читает `each()` прямо в эффекте, поэтому его атрибуция работает. Реализация тегает и Show/Switch (parity), но для signal-graph эти лейблы достижимы только для сигналов, читаемых в эффекте напрямую, не через мемо-условие.
- Инстанс собран GC → `WeakMap`/`WeakRef` не держат; в графе пропуск.
- Незнакомый signal id → пустой граф.
- Идентичность scroll-view (id снапшота ≠ инстанс бинда) — если расходится, scroll-view не оборачиваем (как со style-override в D4a), отмечаем.

## Тестирование

**Unit (vitest):**
- `dev-owner`: `runWithDevOwner` ставит/снимает owner; вложенность восстанавливает prev; неактивный — прямой вызов, `getDevOwner`=null; `deactivate` чистит.
- `effect-owner`: `tag`/`get`; повторный tag не перезаписывает (guard в агенте).
- Примитивы: `Box` с реактивным стилем + активный dev-owner → после построения эффект стиля затеган инстансом Box (проверяемо через агентскую атрибуцию или экспонированный тест-хук). Реалистично: тест ставит композитный `setReactiveDevHooks` вручную, строит `Box` в `runWithDevOwner`, проверяет, что `onComputationRun` получил isEffect-ноду при выставленном owner.
- Агент: `signal-graph` по сигналу, чей эффект затеган → `nodeIds` содержит id инстанса; эффект с label; незатеганный/неизвестный → пусто.

**Интеграция (Playwright, demo):** выбрать сигнал `count` → `signal-graph` возвращает ≥1 nodeId (нода «count: N» Text); клик по чипу выбирает ноду. (Демо: `count` наблюдается текст-эффектом Text → атрибуция к Text-инстансу.)

**Панель (ручной чек-лист):** select сигнала рисует поток и подсвечивает ноды; клик по чипу открывает ноду; для сигнала без атрибуции — понятная заглушка.

## Вне охвата (следующие срезы)

- **Flame по именованным эффектам** в Performance (переиспользует `effectOwner`+label, но нужен per-effect тайминг — обёртка `node.fn` в `runComputation`).
- Атрибуция реактивно-созданных поддеревьев (динамический `For`/`Show`) — требует иной модели (не ambient-first-run).
- Имена пользовательских эффектов (только примитивные label: style/text/show).

## Затрагиваемые файлы

**Ядро:**
- `packages/runtime/src/dev-owner.ts` (новый) + экспорт из index; `activate/deactivate` дёргаются агентом (по аналогии с dev-style-override).
- `packages/primitives/src/{box,text,flex,grid,scroll-view}.ts` — обернуть создание эффекта в `runWithDevOwner`; `packages/runtime/src/show.ts` — обернуть эффект Show.

**`@cairn/devtools`:**
- `effect-owner.ts` (новый) — WeakMap эффект→{instanceId,label}.
- `protocol.ts` — `SignalGraph`, событие/команда `signal-graph`.
- `agent.ts` — тег в `onComputationRun`; `activateDevOwner`/`deactivateDevOwner` в install/uninstall; обработка `signal-graph`.

**Расширение:** `src/panel/panel.ts` — dep-панель на `signal-graph` (поток + чипы + подсветка); `README.md` чек-лист.

**Пример/тесты:** `examples/devtools-demo` (как есть); Playwright-спека signal-graph.
