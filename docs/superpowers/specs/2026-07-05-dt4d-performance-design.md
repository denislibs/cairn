# DT4d — Performance panel (frame-phase profiler)

**Дата:** 2026-07-05
**Статус:** реализовано (DT4d)
**Охват:** D4d поверх DT1–D4b. Реальный Performance-таб: замер фаз кадра (layout/a11y/paint) в `renderFrame`, frame-strip + статы (уже есть на `durationMs`), flame по ФАЗАМ самого медленного кадра, режим Record (запись/заморозка окна коммитов). Flame по именованным эффектам и переход спан→нода — D4c (атрибуция эффект→инстанс), вне D4d.

## Проблема

Панель Performance (D4a) показывает frame-strip и статы из `CommitMeta.durationMs`, но flame — заглушка «per-effect flame arrives later». Пользователь хочет реальный профайлер, ловящий проблемы: видеть, из чего складывается время кадра (layout/paint/…) и находить медленные кадры.

## Цель

1. **Разбивка кадра по фазам** — `renderFrame` меряет layout / a11y / paint отдельно.
2. **Flame по фазам** — для самого медленного кадра панель рисует горизонтальную дорожку с сегментами layout/a11y/paint и шкалой мс.
3. **Record** — запись окна коммитов и заморозка для разбора; **Reload** — перерисовать.
4. Статы/frame-strip остаются (avg commit, slowest frame, frames over budget, effects run).

## Ключевые находки по кодовой базе

- **`packages/runtime/src/mount.ts` `renderFrame`** уже меряет `t0 = now()` и total `durationMs`. Тело чётко делится на фазы:
  - **layout:** `root.layout.layout(...)` + overlays `.layout(...)` + `flushAfterLayout()`.
  - **a11y:** `collectSemantics(root)` (+ overlays) + `host.a11y.sync(...)` — только если `host.a11y`.
  - **paint:** `beginFrame` + `clear` + `paint(root)` + `paint(overlays)` + `endFrame`.
  Вставка `now()` между блоками даёт фазы без изменения логики.
- **`onCommit(root, viewport, durationMs)`** (`devtools-hook.ts`) — сигнатуру расширяем до `FrameTiming` (владеем контрактом; агент — единственный потребитель).
- **`CommitMeta`** уже несёт `durationMs`. Добавляем `phases`.
- **Панель `renderPerf`** (D4a) уже строит frame-strip + статы из `commitLog[].durationMs`; flame — заглушка, которую D4d заменяет. Кнопки `recBtn`/`reloadBtn` есть в разметке мокапа (в D4a без обработчиков).
- Замер дёшев: 3 доп. вызова `now()` на кадр; всегда выполняется, `emitCommit` no-op без хуков → ноль прод-стоимости.

## Архитектура

### 1. Замер фаз (`mount.renderFrame`)

```ts
const t0 = now();
// ...layout block...
const tLayout = now();
// ...a11y block (or skipped)...
const tA11y = now();
// ...paint block...
const tPaint = now();
emitCommit(root, ctx.viewport, {
  total: tPaint - t0,
  layout: tLayout - t0,
  a11y: tA11y - tLayout,
  paint: tPaint - tA11y,
});
```
`a11y` фаза = 0, если `host.a11y` отсутствует (метка `tA11y` берётся сразу после layout-блока — разница 0).

### 2. Хук + тип (`packages/runtime/src/devtools-hook.ts`)

```ts
export interface FrameTiming { total: number; layout: number; a11y: number; paint: number }
export interface RuntimeDevHooks { onCommit(root: Instance, viewport: { w: number; h: number }, timing: FrameTiming): void }
export function emitCommit(root, viewport, timing: FrameTiming): void { if (hooks) hooks.onCommit(root, viewport, timing); }
```
Экспорт `FrameTiming` из runtime index.

### 3. Протокол (`@cairn/devtools/protocol.ts`)

- `CommitMeta.phases: { layout: number; a11y: number; paint: number }` (новое поле). `durationMs` = `timing.total` (как есть).
- Изменений в событиях/командах нет: агент кладёт `phases` в `CommitMeta` при построении коммита.

### 4. Агент (`agent.ts`)

`onCommit(root, viewport, timing)` — берёт `timing.total` для `durationMs` (как раньше) и кладёт `phases: { layout: timing.layout, a11y: timing.a11y, paint: timing.paint }` в `s.lastMeta`/лог/emit. Все места конструирования `CommitMeta` (onCommit, get-snapshot fallback) добавляют `phases` (fallback — нули).

### 5. Панель Performance (`devtools-extension/src/panel/panel.ts`)

- **Статы/frame-strip:** без изменений (из `commitLog`/`durationMs`).
- **Record:** `recBtn` тумблер. Старт → `recording = true`, чистит `recorded: CommitMeta[]`, класс `recording` на кнопке; каждый входящий `commit` при `recording` пушится в `recorded`. Стоп → `recording = false`, замораживает; `renderPerf` использует `recorded` (если запись была) иначе `commitLog`. `reloadBtn` → повторный `renderPerf`.
- **Flame по фазам:** для самого медленного кадра выбранного окна (max `durationMs`) — одна дорожка `scheduler`/`frame` с последовательными сегментами `layout`→`a11y`→`paint`, ширина ∝ мс, цвета (layout=`--span.layout`, paint=`--span.paint`, a11y=свой), заголовок сегмента = `фаза Xms`. Шкала `0 … total ms`. DOM-safe (`textContent`/DOM-билдеры, без `innerHTML`; ширины через `style.width`).
- Клик по сегменту→нода — НЕ делаем (фаза не мапится на ноду; per-effect — D4c). Оставить hint «per-effect flame → D4c».

## Данные и поток

Кадр → `renderFrame` меряет фазы → `emitCommit(timing)` → агент кладёт `durationMs`+`phases` в `CommitMeta` → `commit` событие → панель копит `commitLog` (и `recorded` при записи) → Performance-таб: статы + strip + flame по фазам slowest-кадра.

## Обработка ошибок и деградация

- `performance.now` недоступен → `now()` = 0 → все фазы 0 (как сейчас с durationMs).
- Нет `host.a11y` → `a11y` фаза 0.
- Пустое окно (нет коммитов) → статы нули, flame показывает «no frames recorded».
- Старая панель (без phases) — поле опционально не ломает; но `phases` обязателен в новом `CommitMeta`, панель D4d читает его.
- Прод — хуки null, замер не эмитится.

## Тестирование

**Unit (vitest):**
- `mount`: `onCommit` получает `FrameTiming` с `total ≥ layout+a11y+paint - ε` и неотрицательными фазами; `a11y = 0` без `host.a11y` (fake host). (Числа через fake `performance.now`, монотонно растущий счётчик, чтобы проверить арифметику фаз.)
- Агент: `CommitMeta.phases` присутствует и берётся из timing; `durationMs === timing.total`; get-snapshot fallback даёт нулевые phases; композит why-frame не сломан.
- (панель — без юнитов; flame-геометрия проверяется вручную/в браузере.)

**Интеграция (Playwright, demo):** после кадра `commit.meta.phases` содержит числовые `layout/paint` (≥0) и `a11y` (демо без a11y-bridge? — если a11y включён, >0; иначе 0). `durationMs ≈ layout+a11y+paint`.

**Панель (ручной чек-лист):** flame показывает сегменты layout/a11y/paint slowest-кадра со шкалой; Record копит и замораживает окно; Reload перерисовывает; статы/strip как раньше.

## Вне охвата (D4c / позже)

- Flame по именованным эффектам и переход спан→нода (атрибуция эффект→инстанс — D4c).
- Замер времени сериализации/diff в агенте как отдельная дорожка (опц. позже).
- Экспорт профиля, детальные метрики per-node.

## Затрагиваемые файлы

**Ядро:**
- `packages/runtime/src/mount.ts` — метки фаз + `emitCommit(timing)`.
- `packages/runtime/src/devtools-hook.ts` — `FrameTiming`, расширение `onCommit`/`emitCommit`; `index.ts` — экспорт `FrameTiming`.

**`@cairn/devtools`:**
- `protocol.ts` — `CommitMeta.phases`.
- `agent.ts` — `onCommit(timing)` → `durationMs`+`phases`; fallback phases в get-snapshot.

**Расширение:** `src/panel/panel.ts` — `renderPerf` flame по фазам + Record/Reload; `README.md` чек-лист.

**Пример/тесты:** `examples/devtools-demo` (как есть); Playwright-спека phases в meta.
