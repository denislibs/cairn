# DT4b — Signal monitoring (live signal list + editing)

**Дата:** 2026-07-05
**Статус:** дизайн утверждён, ждёт review
**Охват:** D4b поверх DT1–D4a. Панель Signals показывает реестр ВСЕХ живых сигналов со значениями/именами; правка скалярного сигнала из панели применяется к живому приложению; изменившиеся ноды подсвечиваются (через уже существующий commit-diff). Статический граф сигнал→эффект→нода и flame по эффектам — D4c (требует атрибуции эффект→инстанс), вне D4b.

## Проблема

D4a дал живую правку стилей. Signals-таб пока показывает только сигналы, изменившиеся в последних коммитах (из `CommitMeta.signals`), без текущих значений и без возможности их менять. Пользователь хочет: видеть все сигналы со значениями и «менять и смотреть, что обновляется».

## Цель

1. **Реестр сигналов** — панель показывает все живые сигналы (имя или `#id`, текущее значение, число эффектов-наблюдателей), не только изменившиеся в кадре.
2. **Live-правка** — редактирование значения скалярного сигнала (number/string/boolean) из панели → реальный write в рантайме → эффекты пробегают → приложение обновляется.
3. **Подсветка изменений** — после правки изменившиеся ноды подсвечиваются в дереве (через уже существующий `changed` в коммите).

## Ключевые находки по кодовой базе

- **`SignalState = { value, observers: Computation[] | null, equals, name? }`** (`packages/reactivity/src/core.ts`). Значение читается `node.value`; эффекты-наблюдатели — `node.observers` (Computation с `isEffect`). Имя — `node.name` (D3, из `createSignal(v,{name})`).
- **`writeSignal(node, value)`** есть в core (не в index) — триггерит наблюдателей → кадр. D4b экспонирует dev-writer.
- **`setReactiveDevHooks` — единственный слот**, которым уже владеет `WhyFrameTracker` (`why-frame.ts`): в нём `onSignalCreate` (раздаёт id), `onSignalWrite`, `onComputationRun`. Чтобы реестр видел все создания, нужно, чтобы `onSignalCreate` ещё и регистрировал ноду. → Рефактор: владение реактивными хуками переносится в агент (композитный объект), кормящий и why-frame-счётчики, и реестр. Единый слот сохраняется.
- **Панель Signals уже есть** (D4a): сейчас строит список как union изменившихся сигналов из `commitLog[].meta.signals` + spark. D4b заменяет источник списка на полный реестр (push-событие `signals`), spark оставляет.
- **commit-diff уже подсвечивает** изменившиеся ноды: панель помечает `changedIds` классом `.affected` в дереве (D4a). Правка сигнала → кадр → `changed` → подсветка «бесплатно».

## Архитектура

Слои DT1 неизменны. D4b добавляет: (1) dev-writer в reactivity, (2) реестр сигналов + рефактор владения хуками в агенте, (3) коэрсинг значения, (4) протокол signals/set-signal, (5) панель Signals на реестре.

### 1. Dev-writer (`@cairn/reactivity`)

```ts
// core.ts — тонкая обёртка над существующим writeSignal
export function devWriteSignal(node: SignalState<unknown>, value: unknown): void { writeSignal(node, value); }
```
Экспорт из `reactivity/src/index.ts` (`devWriteSignal`, тип `SignalState` — как type). Запись триггерит наблюдателей → coalesced-кадр → commit.

### 2. Реестр сигналов (`@cairn/devtools/signal-registry.ts`, новый) + рефактор хуков

- **Единый ассайнер id.** Сейчас id раздаёт `WhyFrameTracker`. Выносим общий `signalId(node): number` (WeakMap) в новый модуль или в реестр; и why-frame, и реестр используют его, чтобы id сигнала был один и тот же везде.
- **Реестр:** `Map<number, WeakRef<SignalState>>`, заполняется в `onSignalCreate`. API:
  - `note(node)` — регистрирует (id + WeakRef).
  - `list(): SignalInfo[]` — дерефит живые записи; для каждого читает `name`, `value` (через `serializeSignalValue`), `type`, `observers` (число `node.observers`, отфильтрованных по `isEffect`); мёртвые (deref → undefined) пропускает и удаляет.
  - `resolve(id): SignalState | undefined` — для команды set-signal.
- **Рефактор владения хуками:** `WhyFrameTracker` больше не вызывает `setReactiveDevHooks`; вместо этого экспонирует методы `noteWrite(node)`, `noteEffectRun(node)` (и потребляет общий `signalId`). Агент в `installDevtools` ставит ОДИН композитный объект:
  ```
  setReactiveDevHooks({
    onSignalCreate: (n) => { signalId(n); registry.note(n); },
    onSignalWrite:  (n) => why.noteWrite(n),
    onComputationRun:(n) => why.noteEffectRun(n),
  });
  ```
  `uninstallDevtools` → `setReactiveDevHooks(null)` (как сейчас).

### 3. Сериализация + коэрсинг значения (`@cairn/devtools/signal-value.ts`, новый)

- `serializeSignalValue(v): { value: string; type: 'number'|'string'|'boolean'|'other' }` — number/boolean → String + тип; string → сам текст + 'string'; иначе → безопасная строка (`JSON.stringify` в try/catch, функции → `[fn]`) + 'other'.
- `coerceSignalValue(current: unknown, raw: string): { ok: true; value: unknown } | { ok: false }` — по типу текущего значения: number → parseFloat (NaN → ok:false); boolean → `/^true$/i`; string → raw (снять обрамляющие кавычки); **иначе (object/other/undefined) → ok:false** (правим только скаляры).

### 4. Протокол (дополнения)

- `SignalInfo { id: number; name?: string; value: string; type: 'number'|'string'|'boolean'|'other'; observers: number }`.
- `AgentEvent` += `{ type: 'signals'; list: SignalInfo[] }` — агент шлёт после каждого коммита (лениво: только при наличии подписчиков) и по команде `get-signals`, и один раз на subscribe (после `hello`, как `get-snapshot`).
- `PanelCommand` += `{ type: 'set-signal'; id: number; value: string }` и `{ type: 'get-signals' }`.
- Агент `handleCommand`: `set-signal` → `registry.resolve(id)` → `coerceSignalValue(node.value, cmd.value)` → при ok `devWriteSignal(node, value)` (иначе тихо игнор). `get-signals` → emit `{ type:'signals', list: registry.list() }`.

### 5. Панель Signals (`devtools-extension/src/panel/panel.ts`)

- Источник списка — событие `signals` (не union из commitLog). Хранить `let signals: SignalInfo[]`; на `signals` событие — пересобрать список.
- Рендер каждой строки (как в мокапе `.sig`): точка, имя (`name` или `#id`), `=`, contenteditable значение, «N eff» (observers). Для `type !== 'other'` значение редактируемо (Enter/blur → `set-signal {id, value}`); для `other` — read-only.
- Правка → `set-signal` → рантайм-write → кадр → `commit` с `changed` → дерево подсвечивает изменившиеся ноды (`.affected`, уже есть). `signals` событие обновляет значения в списке.
- Spark коммитов остаётся (из `commitLog`/meta).
- Панель по-прежнему `textContent`/DOM-safe, из `@cairn/devtools` только `import type`.
- Dep-панель («select signal → граф/превью нод») остаётся заглушкой с пометкой «D4c».

## Данные и поток

Правка значения в Signals → `set-signal{id,value}` → мост → агент: `resolve` + `coerce` → `devWriteSignal` → наблюдатели-эффекты → coalesced-кадр → `renderFrame`/`emitCommit` → `commit` (с `changed`) + `signals` (обновлённые значения) → панель: подсветка изменившихся нод в дереве + обновление списка значений.

## Обработка ошибок и деградация

- Сигнал собран GC → `WeakRef.deref()` undefined → пропускается в `list`, `resolve` → undefined → команда игнор.
- `coerceSignalValue` не смог (нескаляр / битый ввод) → команда игнор; панель откатит значение по следующему `signals`.
- Нет подписчиков → `list` не строится (лениво), как со снапшотами.
- Сигналы, созданные до `installDevtools`, не попадут в реестр (dev-требование: install до mount — уже так в demo).
- Прод (нет devtools) → реактивные хуки `null`, реестр не работает, ноль оверхеда.

## Тестирование

**Unit (vitest):**
- `devWriteSignal`: запись меняет `node.value` и триггерит эффект (createRoot + createEffect).
- `signal-value`: `serializeSignalValue` (number/string/boolean/object/fn); `coerceSignalValue` (скаляры ok; object/битьё → ok:false; кавычки у строк снимаются).
- `signal-registry`: `note`+`list` возвращает живые с name/value/type/observers; мёртвый WeakRef пропущен; `resolve` возвращает ноду/undefined; общий `signalId` стабилен и совпадает с why-frame id.
- Агент: `set-signal` по id скаляра → значение сигнала изменилось (+ эффект пробежал); нескаляр/неизвестный id → no-op; `get-signals` эмитит список; композитный хук по-прежнему даёт why-frame-счётчики (регрессия D3 не сломана).

**Интеграция (Playwright, demo):** `get-signals` возвращает именованный `count` с текущим значением; `set-signal count=5` → следующий снапшот показывает обновление приложения (текст «count: 5») и `count` в списке = 5; изменившаяся нода в `changed`.

**Панель (ручной чек-лист):** список всех сигналов со значениями; правка скаляра меняет приложение и подсвечивает ноды; объектные сигналы read-only.

## Вне охвата (D4c+)

- Статический граф сигнал→эффект→нода и «select signal → превью затрагиваемых нод» (атрибуция эффект→инстанс).
- Flame по именованным эффектам.
- Site-захват имён безымянных сигналов (показываются как `#id`).
- Редактирование объектных/структурных сигналов.

## Затрагиваемые файлы

**Ядро:**
- `packages/reactivity/src/core.ts` — `devWriteSignal`; `packages/reactivity/src/index.ts` — экспорт.

**`@cairn/devtools`:**
- `signal-registry.ts` (новый) — реестр + общий `signalId`.
- `signal-value.ts` (новый) — `serializeSignalValue`/`coerceSignalValue`.
- `why-frame.ts` — убрать самостоятельный `setReactiveDevHooks`, экспонировать `noteWrite`/`noteEffectRun`, использовать общий `signalId`.
- `protocol.ts` — `SignalInfo`, событие `signals`, команды `set-signal`/`get-signals`.
- `agent.ts` — композитный реактивный хук; обработка `set-signal`/`get-signals`; push `signals` на коммите/subscribe.

**Расширение:** `src/panel/panel.ts` — Signals-таб на реестре + правка скаляров; `README.md` чек-лист.

**Пример/тесты:** `examples/devtools-demo` (уже с именованным `count`); Playwright-спека set-signal.
