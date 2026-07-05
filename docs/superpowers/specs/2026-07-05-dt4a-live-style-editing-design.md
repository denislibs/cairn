# DT4a — Live style editing + DevTools panel shell

**Дата:** 2026-07-05
**Статус:** реализовано (DT4a)
**Охват:** D4a — первый срез интерактивных девтулз поверх DT1–DT3. Поднять панель до канонического мокапа (`docs/superpowers/specs/assets/dt4-devtools-mockup.html`) и сделать **вживую правку стилей**: выбрал ноду → добавил/изменил/выключил style-свойство → применилось к реальному canvas. Signals/Performance-табы присутствуют в вёрстке мокапа и питаются УЖЕ доступными данными D3 (без фейка); их богатая интерактивность — отдельные циклы D4b/D4c/D4d.

## Проблема

DT1–DT3 дали инспектор, подсветку, пипетку, имена, style-интроспекцию, «почему кадр», профайлер-данные. Но панель — только чтение, а её вид далёк от целевого. Пользователь дал канонический мокап (Chrome-DevTools-стиль) и хочет: **менять стили из панели и видеть результат на живом приложении.**

## Цель

1. Панель выглядит как мокап 1:1 (тёмная тема, toolbar, maintabs Elements/Performance, subtabs Styles/Computed/Signals, дерево+сайд, свотчи, spark, flame).
2. В табе **Styles**: contenteditable prop/value, чекбокс-toggle, «+ add property», свотчи цветов → правки применяются к живому canvas-приложению; **Computed** — только чтение; **live-preview** блок.
3. **Signals/Performance** — вёрстка мокапа на реальных данных D3 (список изменившихся сигналов + spark; frame-strip + статы из `durationMs`). Редактирование сигналов, dependency-граф, flame по эффектам — вне D4a.

## Ключевые находки по кодовой базе

- **`packages/primitives/src/box.ts:184`**: резолвнутый стиль идёт `styleSource = createStyleTransitions(resolved)` → `bind(styleSource, (s) => { current = s; instance.debugStyle = s; layout.width = s.width; … })`. То есть в bind-колбэке есть единая точка, где стиль применяется и к paint (`current`), и к layout (`layout.*`). Вставка override здесь применит правку и к отрисовке, и к раскладке. `text.ts`, `flex.ts`, `grid.ts`, `scroll-view.ts` — тот же паттерн (в D3 туда добавлен `instance.debugStyle = s`).
- **id→instance удалён в D3** (мёртвый reverse-map). D4a возвращает его — теперь у него реальный потребитель: применять правки по id из команд панели.
- **Whitelist стилей уже есть** (D3 `serialize.ts` `STYLE_KEYS`): `backgroundColor, color, padding, border, borderRadius, opacity, font, gap, boxShadow`. Редактируемый набор = этот whitelist + `width, height`.
- **Данные для Signals/Perf уже текут** (D3): `CommitMeta.signals` (список изменившихся сигналов), `CommitMeta.durationMs`, commit-log. Панель их отрисует без нового рантайм-кода.
- **Панель — DOM-only, из `@cairn/devtools` только `import type`** (инвариант DT2). Стиль-правки идут строкой через протокол; агент их парсит.

## Архитектура

Слои DT1 неизменны (инструментирование → агент → мост → панель). D4a добавляет: (1) резолв id→instance, (2) dev-override сигнал стиля на инстанс, (3) мерж override в примитивах, (4) команды правки + парсер значений, (5) панель по мокапу.

### 1. Резолв id→instance (`@cairn/devtools/ids.ts`)

Вернуть `reverse: Map<number, WeakRef<Instance>>` и `instanceById(id): Instance | undefined`, заполняемый в `idOf` (как было до D3-очистки). Потребитель — обработчики команд правки стиля.

### 2. Dev-override seam (`packages/runtime/src/dev-style-override.ts`, новый)

Мотив: правка должна (а) переживать реактивные ре-биндинги (hover/pressed), (б) триггерить перерисовку. Значит override — реактивный источник, читаемый внутри bind.

```ts
import type { Instance } from './instance';
import type { BaseStyle } from '@cairn/style';
export interface StyleOverride { patch: Partial<BaseStyle>; disabled: Set<string>; }
// Per-instance override signal, created lazily. Empty (WeakMap miss) in prod → zero cost.
export function readStyleOverride(inst: Instance): StyleOverride | undefined; // REACTIVE read (call inside bind)
export function setStyleProp(inst: Instance, prop: string, value: unknown): void;   // add/edit
export function removeStyleProp(inst: Instance, prop: string): void;                // remove added
export function toggleStyleProp(inst: Instance, prop: string, enabled: boolean): void; // disable/enable
export function clearStyleOverride(inst: Instance): void;
```
Реализация: `WeakMap<Instance, [Accessor<StyleOverride>, Setter<StyleOverride>]>` через `createSignal` из `@cairn/reactivity`; сеттеры бьют сигнал → bind перебегает. `readStyleOverride` читает сигнал (tracked) если он есть; если нет — возвращает `undefined` без создания сигнала (чтобы прод-инстансы не обрастали сигналами). Первое `setStyleProp` создаёт сигнал для инстанса.

### 3. Мерж override в примитивах

В bind-колбэке `box/text/flex/grid/scroll-view` заменить `current = s` на:
```ts
const eff = applyStyleOverride(s, readStyleOverride(instance));
current = eff;
instance.debugStyle = eff;
// … далее layout.* и flags читают из eff, а не из s
```
`applyStyleOverride(base, ovr)` (в `dev-style-override.ts`, чистая): если `ovr` нет — вернуть `base` без копии; иначе `{ ...base }` минус `ovr.disabled` ключи, плюс `ovr.patch`. Все места, где сейчас читается `s.<key>` для layout/flags, начинают читать `eff.<key>`. Прод-путь (нет override) — `applyStyleOverride` возвращает `base` как есть (одна проверка, ноль аллокаций).

### 4. Команды правки + парсер (`@cairn/devtools`)

Новые `PanelCommand`:
- `{ type: 'set-style'; id: number; prop: string; value: string }`
- `{ type: 'toggle-style'; id: number; prop: string; enabled: boolean }`
- `{ type: 'remove-style'; id: number; prop: string }`

Агент (`agent.ts` `handleCommand`): резолвит `instanceById(id)`; для `set-style` — `parseStyleValue(prop, value)` → `setStyleProp`; `toggle-style` → `toggleStyleProp`; `remove-style` → `removeStyleProp`. Неизвестный id / нередактируемый prop → тихо игнор. После правки фреймворк сам перерисуется (сигнал override) и придёт новый `commit` со снапшотом → панель обновит Styles из `SnapshotNode.style`.

`parseStyleValue(prop, raw)` (новый `@cairn/devtools/parse-style.ts`, чистый): редактируемый whitelist (`backgroundColor, color, border, font` — строка как есть; `opacity, borderRadius, gap, width, height` — `parseFloat`; `padding` — число или `"t r b l"`/`"v h"` → `{top,right,bottom,left}`; `boxShadow` — оставить строкой/пропустить как read-only-сложный в D4a). Возвращает `{ ok: true, value }` или `{ ok: false }` (нераспарсенное → команда игнорируется, панель показывает исходное из следующего снапшота). Нередактируемые prop → `{ ok:false }`.

### 5. Панель по мокапу (`devtools-extension/src/panel/`)

Переписать `panel.html`/`panel.css`/`panel.ts` под мокап (взять разметку+CSS из `assets/dt4-devtools-mockup.html` дословно). Строго `textContent`/DOM-билдеры (XSS-safe; узловые имена/значения — от приложения).

- **Дерево (Elements)**: из снапшота (имена, dims, caret-сворачивание, выбор, hover→`highlight`).
- **Styles (live)**: из `node.style` (снапшот). Рендер `element.style` (добавленные props) + `<Tag>` (matched, из снапшота) + inherited-хинт (от родителя). contenteditable prop/value → на `blur`/Enter шлёт `set-style`/`remove-style`; чекбокс → `toggle-style`; «+ add property» → `set-style` с новым ключом. Свотчи для цветовых значений. Отредактированные значения возвращаются подтверждённым следующим снапшотом (панель — оптимистично рендерит, снапшот — источник правды).
- **Computed**: тот же `node.style`, read-only.
- **Live-preview**: DOM-бокс из значений стиля (как в мокапе; чисто панельная визуализация, canvas — настоящий результат).
- **Signals (реальные данные D3)**: список изменившихся за последние коммиты сигналов (union из `commit.meta.signals`, с текущими именами/id) + spark коммитов (signals/effects из meta). Правка значения/dep-граф — заглушены (видны, но `Apply`/edit неактивны, с пометкой «D4b»).
- **Performance (реальные данные D3)**: frame-strip из `durationMs` коммитов, статы (avg/slowest/over-budget/effects) из commit-log. Flame по эффектам — заглушка с пометкой «D4c/D4d».

### Протокол (дополнения к DT1–DT3)

- `PanelCommand` += `set-style` / `toggle-style` / `remove-style` (выше).
- Изменений в `AgentEvent`/`SnapshotNode` не требуется — правки видны через уже существующий `SnapshotNode.style` в следующем `commit`.

## Данные и поток

Правка в Styles → команда `set-style{id,prop,value}` → мост → агент: `instanceById` + `parseStyleValue` → `setStyleProp` → override-сигнал → bind в примитиве перебегает → `applyStyleOverride` мержит → `current`/`layout` обновлены → `scheduleFrame` → `renderFrame` → `emitCommit` → новый снапшот (у ноды новый `style`) → панель ре-рендерит Styles. Круг замкнут на реальном рантайме.

## Обработка ошибок и деградация

- Нет override (прод / не редактировали) → `applyStyleOverride` возвращает base, ноль стоимости; WeakMap пуст.
- `instanceById(id)` вернул `undefined` (нода собрана GC) → команда тихо игнорируется.
- `parseStyleValue` не смог (нередактируемый/битый ввод) → команда игнор; панель откатится к значению из следующего снапшота.
- Правка layout-свойства (width/padding/gap) → bind обновляет `layout.*` → полный re-layout+paint (уже так работает).
- Панель старого протокола (без новых команд) — просто не шлёт их; агент незнакомую команду игнорирует.

## Тестирование

**Unit (vitest):**
- `dev-style-override`: `setStyleProp`/`toggle`/`remove` меняют то, что видит `readStyleOverride`; `applyStyleOverride(base, ovr)` — мерж (patch поверх, disabled удаляет, без ovr — тот же объект); реактивность (правка override → эффект, читающий `readStyleOverride`, перебегает).
- `parse-style`: цвет/шрифт как есть; `opacity/borderRadius/gap/width/height` → число; `padding "4 8"`/`"1 2 3 4"` → объект; мусор/нередактируемый → `{ok:false}`.
- Примитивы: `Box` с активным override красит/раскладывается по merged (напр. override `width` меняет `layout.width`; `backgroundColor` меняет `debugStyle`/paint) — проверяемо через `debugStyle` после правки в `createRoot`.
- Агент: `set-style`/`toggle`/`remove` по id → `instanceById` → override применён → следующий `serialize` даёт обновлённый `SnapshotNode.style`; неизвестный id — no-op.
- Резолв: `instanceById` стабилен/возвращает undefined на неизвестном.

**Интеграция (Playwright, demo):**
- Выбрать ноду Button, `set-style backgroundColor #ee0000` → снапшот Button.style.backgroundColor обновился; прочитать пиксель canvas в области кнопки → цвет изменился (реальная перерисовка).
- `toggle-style` off у `backgroundColor` → снапшот без него / цвет ушёл; on → вернулся.

**Панель (ручной чек-лист в README):** вид совпадает с мокапом; правка/toggle/add в Styles меняет canvas; Signals/Performance показывают реальные данные; заглушенные места помечены.

## Вне охвата (следующие циклы)

- **D4b** — мониторинг сигналов: реестр всех сигналов + значения, live-правка (`dev-write-signal`), «изменил → подсветились изменившиеся ноды» (через commit-diff).
- **D4c** — атрибуция эффект→нода: тегать bind/Show/text-эффекты инстансом → статический dependency-граф сигнал→эффект→нода + flame по именованным эффектам.
- **D4d** — Performance: flame по фазам кадра (layout/a11y/paint/commit — замеры в `renderFrame`), запись/reload, детект проблем.
- **D4e** — дельта-протокол снапшотов (с move-детекцией), вынесен из DT3.
- Персистентность overrides между reload; правка `boxShadow`/сложных структур; правка текста/props (не style).

## Затрагиваемые файлы

**Ядро:**
- `packages/runtime/src/dev-style-override.ts` (новый) + экспорт из `runtime/src/index.ts`.
- `packages/primitives/src/box.ts`, `text.ts`, `flex.ts`, `grid.ts`, `scroll-view.ts` — мерж override в bind (читать `eff` вместо `s`).

**`@cairn/devtools`:**
- `ids.ts` — вернуть reverse-map + `instanceById`.
- `protocol.ts` — новые `PanelCommand` варианты.
- `parse-style.ts` (новый) — `parseStyleValue`.
- `agent.ts` — обработка новых команд.
- `index.ts` — экспорт `instanceById` (для агента; наружу по надобности).

**Расширение:**
- `src/panel/panel.html` + `panel.css` + `panel.ts` — переписать под мокап; Styles live, Signals/Perf на данных D3.
- `README.md` — обновить чек-лист.

**Пример/тесты:**
- `examples/devtools-demo` — как есть (уже с material Button + именованным сигналом).
- Playwright-спеки — правка стиля меняет снапшот + пиксель canvas.
