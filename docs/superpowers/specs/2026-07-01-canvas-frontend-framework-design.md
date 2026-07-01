# Cairn — Дизайн и роадмап

**Дата:** 2026-07-01
**Статус:** черновик дизайна (утверждается)

## Идея

**Cairn** — SolidJS-подобный фронтенд-фреймворк, который рендерит приложение **на `<canvas>`**,
а не в DOM. Свои примитивы, своя реактивность, свой layout, своя стилизация и текстовый ввод.

*Имя:* cairn — тур из камней, отмечающий тропу; приложение собирается из примитивов-«камней».

## Нейминг

| Слой | Решение |
|---|---|
| Фреймворк | **Cairn** |
| npm | scoped multi-package: `@cairn/reactivity`, `@cairn/layout`, `@cairn/runtime`, `@cairn/host`, `@cairn/platform-web`, `@cairn/primitives`, … |
| Core-API | как в Solid, 1-в-1: `createSignal`, `createEffect`, `createMemo`, `createRoot`, `createContext`, `onCleanup`, `batch`, `untrack` |
| Примитивы v1 | `Box` (базовый контейнер), `Text`, `Row`, `Column` |
| Точка входа | `createRoot(host)` |

## Зафиксированные решения

| Область | Решение |
|---|---|
| Цель | Полноценный фреймворк (полнота, стабильность, DX) |
| Реактивность | Своя, с нуля (fine-grained, как Solid) |
| Шаблоны | JSX |
| Layout | Модель Flutter: **constraints down / size up** |
| Renderer | Canvas 2D за интерфейсом `Renderer` (подмена на WebGL позже) |
| Текстовый ввод | Скрытый DOM `<input>`-прокси (клавиатура/IME/буфер) |
| Стили | CSS-подобные стили-листы `StyleSheet.create` + состояния + тема |
| Примитивы v1 | Box, Text, Row, Column |
| Платформа | Ядро без `document`/`window`; вся браузерная специфика за интерфейсом `Host` в пакете `platform-web` (паттерн Flutter embedder / RN host config). Вторая платформа — за пределами v1 |
| Роутинг | Отдельный пакет, надстройка после control-flow (ближе к релизу) |
| Язык/стек | TypeScript, Vite (JSX через `jsxImportSource`), Vitest, монорепо (pnpm) |

## Общая архитектура

### Структура пакетов

```
packages/                       // все публикуются как @cairn/<name>
  # --- ЯДРО (переносимое, БЕЗ document/window) ---
  reactivity/    // @cairn/reactivity — signals, effects, memo, batch, owner/cleanup, context
  layout/        // @cairn/layout — constraints-down/size-up движок (чистая математика)
  runtime/       // @cairn/runtime — дерево элементов, связка реактивность↔дерево, jsx-runtime
  events/        // @cairn/events — модель событий: hit-testing, bubbling, focus (без DOM)
  style/         // @cairn/style — StyleSheet, состояния, тема
  router/        // @cairn/router — сопоставление маршрутов (history-адаптер — из Host)
  primitives/    // @cairn/primitives — Box, Text, Row, Column (+ Button/Input/…)
  # --- ПЛАТФОРМЕННЫЙ ШОВ ---
  host/          // @cairn/host — интерфейсы Host: Renderer, InputSource, TextInputService,
                 //   AccessibilityBridge, FrameScheduler, SurfaceMetrics
  platform-web/  // @cairn/platform-web — веб-реализация Host: Canvas2DRenderer, DOM-события,
                 //   скрытый input-прокси, DOM a11y-зеркало, rAF, ResizeObserver
  # --- ПРИЛОЖЕНИЕ ---
  app/           // @cairn/app — createRoot(host), mount
examples/
  counter/
```

### Поток данных (один кадр)

```
signal меняется
   └─▶ effect (layout узла) помечает поддерево dirty
        └─▶ scheduler (rAF) собирает dirty-узлы
             └─▶ layout(constraints) для dirty-поддерева  (down/up)
                  └─▶ paint грязных регионов через Renderer  ─▶ Canvas2D
события мыши/клавы ─▶ events (hit-test по дереву) ─▶ хендлеры ─▶ меняют signal ─▶ …
текстовый ввод ─▶ скрытый input ─▶ signal значения ─▶ …
```

**Ключевая идея:** реактивность точечная — при изменении signal пересчитывается только
затронутое поддерево layout и перерисовывается только грязный регион канваса, а не весь кадр.

### Платформенный шов (Host)

Ядро не знает, где оно исполняется. Вся платформенная специфика — за единым интерфейсом
`Host` (паттерн Flutter embedder / React Native host config). Браузер — одна из реализаций.

```ts
interface Host {
  renderer: Renderer;            // поверхность рисования
  input: InputSource;            // pointer/keyboard → фреймворк
  textInput: TextInputService;   // начать/закончить ввод, IME (web: скрытый input; native: системная клава)
  a11y: AccessibilityBridge;     // отдать дерево семантики платформе
  scheduler: FrameScheduler;     // запланировать кадр (web: rAF; native: display link)
  metrics: SurfaceMetrics;       // размер, devicePixelRatio, событие ресайза
}
```

- Точка входа: `createRoot(host)` — канвас и DOM становятся деталью `platform-web`.
- `platform-web` реализует `Host`: `Canvas2DRenderer`, DOM-слушатели, **скрытый input-прокси**,
  **DOM a11y-зеркало**, rAF-планировщик, `ResizeObserver`.
- Правило (проверяется линтером в CI): **в ядре запрещены `document`/`window`**.
- Другой таргет (мобилка и т.п.) = новый пакет `platform-*` со своими реализациями
  (нативное текстовое поле, нативный a11y, своя поверхность). Ядро не меняется.
  Реально писать второй хост — за пределами v1; сейчас проводим только границу.

### Модель layout (constraints down / size up)

Однопроходный алгоритм (как во Flutter), без CSS-reflow и без constraint-солвера:

1. Родитель передаёт ребёнку `Constraints` (min/max W/H) — вниз.
2. Ребёнок выбирает свой `Size` внутри ограничений — вверх.
3. Родитель проставляет ребёнку позицию (offset), зная его размер.

`Text` — единственный лист, который реально измеряет себя (`ctx.measureText` + перенос).
`flex`-дети (аналог Flutter `Expanded`) реализуются как надстройка: им выдаются жёсткие
`min==max` ограничения по доле свободного места (двухфазный проход внутри Flex-узла).

## Роадмап до production-ready

Легенда: 🎯 milestone · 📦 артефакт · ✅ критерий готовности · 🔗 зависимости.

### Фаза 0 — Фундамент проекта
📦 Монорепо (pnpm workspaces), TypeScript, Vite, Vitest, ESLint/Prettier, CI, пакеты-заглушки.
✅ `pnpm test`/`pnpm build` зелёные; CI на PR.

### Фаза 1 — Ядро реактивности `reactivity` 🔗 —
📦 `createSignal`, `createEffect`, `createMemo`, `batch`, `untrack`, `onCleanup`, `createRoot`,
граф зависимостей (owner-tree), автотрекинг чтений, glitch-free пересчёт.
✅ Юнит-тесты: диамонд без двойных пересчётов, cleanup, батчинг. Ноль зависимостей от canvas.
🎯 **M1: реактивность работает в вакууме.**

### Фаза 2 — Host-шов + веб-рендерер `host` + `platform-web` 🔗 —
📦 Интерфейсы `Host` (`Renderer`, `InputSource`, `TextInputService`, `AccessibilityBridge`,
`FrameScheduler`, `SurfaceMetrics`); веб-реализация `Renderer` = `Canvas2DRenderer`
(fillRect, roundRect, fillText, drawImage, clip, save/restore, HiDPI) + rAF-`FrameScheduler`
+ `SurfaceMetrics` через `ResizeObserver`. Остальные сервисы Host — заглушки, наполняются в своих фазах.
✅ Тесты через мок-контекст; пример со статичными фигурами/текстом, чёткий HiDPI; линт-правило «нет document/window в ядре».

### Фаза 3 — Layout-движок `layout` 🔗 —
📦 Типы `Constraints`/`Size`, протокол `layout()→size` + расстановка позиций, `BoxNode`
(padding/margin), `FlexNode` (row/column, gap, flex-grow, align/justify), измерение текста,
absolute-позиционирование.
✅ Снапшот-тесты координат на эталонных деревьях; один проход down/up, две фазы для flex.
🎯 **M2: ядро + рендер + layout готовы по отдельности и покрыты тестами.**

### Фаза 4 — Runtime + JSX + связка 🔗 1,2,3
📦 `runtime`: дерево элементов над layout-узлами; реактивная привязка (эффект→dirty→
`Host.scheduler`→точечный re-layout→paint региона через `Host.renderer`); `jsx-runtime`
(`jsx`/`jsxs`/`Fragment`) + Vite `jsxImportSource`; примитивы **Box, Text, Row, Column**;
`createRoot(host)` + `mount` (в примере host создаётся из `platform-web` по canvas-элементу).
✅ `examples/counter`: JSX-компонент со `createSignal`, изменение числа перерисовывает
только затронутую область.
🎯 **M3: «Hello, reactive canvas» — счётчик. Архитектура доказана end-to-end.**

### Фаза 5 — Context 🔗 1
📦 `createContext(default)`, `useContext`, `<Provider>` поверх owner-tree (lookup вверх по
owner-цепочке). Сам lookup не реактивен; реактивность даёт положенный внутрь signal/store.
✅ Тесты: значение находится через границы компонентов, дефолт без провайдера, вложенные
провайдеры перекрывают. Фундамент для `ThemeProvider` (Фаза 6) и роутера (Фаза 16).

### Фаза 6 — Система стилей `style` 🔗 4,5
📦 `StyleSheet.create`, разрешение стилей в layout+paint свойства, состояния
(`hover/focus/active/disabled/pressed`), токены темы + `ThemeProvider` (на Context), каскад/мерж, единицы.
✅ Тесты разрешения стилей/состояний; пример с темизированными карточками.

### Фаза 7 — События `events` + `InputSource` (web) 🔗 4
📦 Модель событий в ядре (`events`) + веб-`InputSource` в `platform-web` (DOM-слушатели →
нормализованные события ядра). Hit-testing (обход дерева с z/clip), нормализация pointer (mouse+touch), bubbling/capture,
`onClick/onPointerDown/Move/Up/onWheel`, hover (связь со стилями), фокус-менеджмент (Tab, ring).
✅ Тесты hit-testing на перекрытиях/вложенности; кнопка реагирует на hover/click.
🎯 **M4: интерактивный UI — клики, hover, фокус, состояния.**

### Фаза 8 — Текстовый ввод: `TextInputService` (web) + Input 🔗 6,7
📦 Веб-`TextInputService` в `platform-web` = скрытый DOM `<input>/<textarea>`-прокси;
ядро работает только через интерфейс `TextInputService` (открыть/закрыть ввод, события IME).
Синхронизация значения ↔ signal, отрисовка поля/курсора/выделения, позиционирование прокси под фокус,
IME/composition, буфер, мобильная клава.
✅ Форма: ввод, курсор, выделение, вставка, Tab между полями; проверка IME.
🎯 **M5: настоящие текстовые поля на канвасе.**

### Фаза 9 — Control flow и списки 🔗 4
📦 `<Show>`, `<Switch/Match>`, `<For>` (keyed-реконсиляция), `<Index>`, `<Portal>`, cleanup поддеревьев.
✅ Тесты реконсиляции (вставка/удаление/перестановка с сохранением состояния); todo-пример.

### Фаза 10 — Расширенные примитивы 🔗 7,8,9
📦 `Button`, `Image` (загрузка/кеш/спиннер), `ScrollView` (виртуальный вьюпорт, clip, инерция,
скроллбар), `Checkbox`, `TextInput`, `Spacer`.
✅ Демо, использующее все примитивы вместе.
🎯 **M6: полноценный UI-кит.**

### Фаза 11 — Продвинутый текст 🔗 3,10
📦 Перенос по словам, выравнивание, `lineHeight`, ellipsis, несколько шрифтов/весов, веб-шрифты
(FontFace) с ре-layout по готовности, эмодзи/базовый bidi.
✅ Снапшот-тесты переносов; пример с абзацами и разными шрифтами.

### Фаза 12 — Производительность 🔗 всё
📦 Dirty-region rendering, слои/офскрин-кеш статичных поддеревьев, culling вне вьюпорта,
кеш измерений текста, дедуп layout-проходов, метрики (FPS/кадр-бюджет), бенчмарки.
✅ Бенчмарк: 10k узлов, скролл 60 FPS; профиль без лишних re-layout.
🎯 **M7: быстро на больших сценах.**

### Фаза 13 — Анимации 🔗 1,12
📦 `createAnimation`/`tween`, easing, spring, `<Transition>`, интеграция со scheduler.
✅ Пример с анимированными переходами без jank.

### Фаза 14 — Доступность (a11y) `AccessibilityBridge` (web) 🔗 7,10
📦 Веб-`AccessibilityBridge` в `platform-web` = скрытое DOM-зеркало дерева (ARIA-узлы) для
скринридеров; ядро отдаёт дерево семантики через интерфейс. Роли/лейблы, клавиатурная навигация,
объявления. Интерфейс `AccessibilityBridge` заложен в Фазе 2, наполняется здесь.
✅ Прогон скринридером; полная клавиатурная навигация.
🎯 **M8: доступный canvas-UI.**

### Фаза 15 — DevTools и отладка 🔗 всё
📦 Оверлей-инспектор (подсветка узла, границы layout, «почему перерисовалось»), граф
реактивности, лог перерисованных регионов, warning'и (unbounded constraints и пр.).
✅ Инспектор работает в примерах; понятные ошибки.

### Фаза 16 — Роутинг `router` 🔗 1,5,9
📦 `<Router>` (history/hash), `<Route path>` с параметрами (`/user/:id`), вложенные маршруты +
`<Outlet>`, `<Link>`/`navigate()`, `useParams`/`useSearchParams` (маршрут прокидывается через
Context), ленивая загрузка, скролл-восстановление.
✅ Приложение с 2–3 экранами, deep-link по URL, корректные back/forward.

### Фаза 17 — Production-hardening 🔗 всё
📦 Кроссбраузерность (Chrome/FF/Safari + мобильные), ресайз/`ResizeObserver`, DPR-переключения,
устойчивость к потере контекста, отсутствие утечек, SSR-заглушка/деградация без canvas,
error boundaries.
✅ Матрица браузеров зелёная; тест на утечки; стабильность под ресайзом/зумом.

### Фаза 18 — Релиз и DX 🔗 всё
📦 Сборка пакетов (ESM+типы, tree-shaking, size-budget), semver + changesets, документация
(гайды + API + рецепты), `create-cairn-app`, плейграунд, contributing-гайд.
✅ `npm i` ставит фреймворк; шаблон запускается за минуту; доки покрывают всё.
🎯 **M9: v1.0 — production ready.**

## Критический путь и параллелизм

- **Строго последовательно (фундамент):** Фаза 1 → 2 → 3 → 4 (до M3 порядок фиксирован).
- **После M3 параллелятся:** Context (5), стили (6, зависят от 5), события (7), control-flow (9).
- **Сквозные (закладывать интерфейсы рано, наполнять в свою фазу):** интерфейсы `Host`
  (Фаза 2), a11y-`AccessibilityBridge` (14), dirty-region (12).

## Процесс

Каждая фаза = отдельный цикл **спек → план → реализация**. Первый под-проект для детальной
проработки — **Фаза 1 (ядро реактивности)**: фундамент для всего, чистая логика, идеальна для TDD.
