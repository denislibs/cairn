# Cairn — Стилизация и возможности: полный каталог

> Справочник: что нужно фреймворку для полноценных приложений, и что из этого уже есть.
> Дата: 2026-07-03.

**Ключевой факт (обновлено 2026-07-03):** блок продакшн-стилизации S1–S7 завершён — слой стилей
(`BaseStyle` в `@cairn/style`) теперь выдаёт наружу практически все возможности рендерера
(градиенты, тени, per-corner радиусы, трансформы, фильтры, клип) плюс полноценные лейаут/текст/
Grid/единицы/тему/анимации. Оставшиеся ❌ — это нестилизационная инфраструктура (оверлеи, жесты,
a11y, перформанс, роутинг, i18n) и точечные дыры (`boxSizing`, `outline`, `wordSpacing`, 3D,
полный SVG-документ). Историческая заметка: изначально рендерер умел много, а стиль — почти ничего;
эта работа «прокинула» всё в стиль.

**Легенда статусов:**
- ✅ — есть в стиле сейчас
- 🟡 — движок/рендерер умеет, надо вывести в `BaseStyle`/примитив
- ❌ — нет вообще (нужно и в движке, и в стиле)

---

> **Статус блока S1–S7 (стилизация):** ЗАВЕРШЁН. Все семь фаз продакшн-стилизации реализованы:
> overflow (S1), текстовый движок (S2), трансформации и эффекты (S3), Grid (S4), единицы/адаптивность (S5), тема/токены/варианты/курсор (S6), анимации (S7).
> Оставшиеся ❌-строки в этом документе относятся к нестилизационной инфраструктуре:
> scroll, оверлеи, жесты, a11y, производительность, роутинг, i18n, выделение текста.

---

## 1. Размеры и box-model
- ✅ `width`, `height`
- ✅ `minWidth` / `maxWidth` / `minHeight` / `maxHeight`
- ✅ `padding` (+ по сторонам через `EdgeInsets`)
- ✅ `margin` (+ по сторонам через `EdgeInsets`)
- ✅ `aspectRatio`
- ❌ `boxSizing` (сейчас поведение border-box-подобное)
- ✅ `gap`; ✅ раздельные `rowGap` / `columnGap`
- ✅ `overflow: hidden | clip` (клип детей по скруглённому боксу); `overflow: scroll` → используй `ScrollView`

## 2. Флекс и позиционирование
- ✅ `flexDirection` (`Row` / `Column`)
- ✅ `justify` (главная ось), `align` (поперечная ось)
- ✅ `alignSelf` (переопределение cross на ребёнке)
- ✅ `flex` (grow); ✅ `flexShrink`, `flexBasis`
- ✅ `flexWrap` (перенос на новую линию)
- ✅ `mainAxisSize: 'min' | 'max'` (shrink-wrap vs fill)
- ✅ `position` (`Stack` + `left`/`top`/`right`/`bottom`/`inset`)
- ✅ `zIndex`
- ✅ `Grid` (columns / rows / areas) — v1 подмножество: `gridTemplateColumns`/`gridTemplateRows` (px/fr/auto/repeat), `gridTemplateAreas`, `rowGap`/`columnGap`/`gap`, `justifyItems`/`alignItems`, размещение ячеек через `gridColumn`/`gridRow` (line/span) и `gridArea`, row-major auto-flow; отложено: `minmax()`, `auto-fill`/`auto-fit`, `justifyContent`/`alignContent` (распределение дорожек), `justifySelf`/`alignSelf` на ячейке, subgrid, dense packing

## 3. Фон и заливки
- ✅ `backgroundColor`
- ✅ `backgroundGradient` (linear / radial)
- ✅ `backgroundImage` (через `backgroundSize: cover | contain | fill`, клип по скруглению)
- ✅ `opacity` (альфа всего элемента)
- 🟡 `backdropFilter` (принят в типе, отложен — нужен ресэмплинг фона)

## 4. Границы
- ✅ `border { width, color }` (все стороны одинаково)
- ✅ per-side (`borderTop` / `borderRight` / `borderBottom` / `borderLeft`)
- ✅ `borderStyle` (solid / dashed / dotted)
- ✅ `borderRadius` (единый); ✅ per-corner (`{ tl, tr, br, bl }`)
- ❌ `outline` / focus-ring как отдельный слой

## 5. Тени и эффекты
- ✅ `boxShadow` (массив теней; каждая: color / blur / offsetX / offsetY / spread + inset best-effort)
- ✅ `textShadow`
- ✅ `elevation` (пресеты material-теней)
- ✅ `filter`: blur / brightness / contrast / … (CSS filter string на Box)

## 6. Типографика
- ✅ `font` (CSS-шорткат строкой), `color`
- ✅ раздельные `fontFamily` / `fontSize` / `fontWeight` / `fontStyle` (шорткат `font` тоже работает; `composeFont` собирает строку из лонгхендов)
- ✅ `lineHeight`
- ✅ `textAlign` (left / center / right)
- ✅ `letterSpacing`; ❌ `wordSpacing`
- ✅ `textDecoration` (underline / line-through)
- ✅ `textTransform` (none / uppercase / lowercase / capitalize)
- ✅ `maxLines` + `ellipsis` (обрезка; `ellipsis` — строка, напр. `'…'`)
- ✅ перенос строк / многострочность (перенос по ширине, явный `\n`, `TextNode.lines`)
- ❌ выделение текста (selection)

## 7. Трансформации
- ✅ `translate`, `scale` (через `transform` в стиле; paint-walker применяет к поддереву)
- ✅ `rotate`, `skew` (через `transform`; рендерер: `rotate` + аффинный `transform`)
- ✅ `transformOrigin`
- ❌ 3D-трансформации (perspective / rotateX / rotateY)

## 8. Анимации и переходы (Фаза 13 + AN1 + AN2)
- ✅ `transition` (свойство / длительность / easing / delay) — декларативно через `TransitionConfig` на `BaseStyle`; поддерживаемые свойства (Box / Text / Flex / Grid; ScrollView маршрутизирован; Image отложен — leaf-примитив):
  `opacity`, `color`, `backgroundColor`,
  `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`,
  `padding`, `margin`, `gap`,
  `borderRadius`, `border`, `boxShadow`,
  `transform` (структурная интерполяция: `translateX`/`translateY`/`scale`/`scaleX`/`scaleY`/`rotate`/`skewX`/`skewY`),
  `letterSpacing`, `lineHeight`.
  Структурная интерполяция реализована через `lerpLength`, `lerpTransform`, `lerpShadow`, `lerpRadii`, `lerpInsets` (AN1).
- ✅ `TransitionConfig.spring` (`{ stiffness?, damping?, mass? }`) — реальная физика пружины через `animateSpring` (AN2): без фиксированной длительности, overshoot, прерываемо с переносом скорости; при наличии `spring` поля `duration`/`easing` игнорируются.
- ✅ `animateSpring` — экспортируется из `@cairn/runtime` для ручного использования; semi-implicit Euler, параметры: `stiffness` / `damping` / `mass` / `initialVelocity` / `restDelta` / `restSpeed`.
- ✅ keyframes-анимации — императивно через `animateKeyframes`; полный CSS `@keyframes`-синтаксис отложен
- ✅ spring-easing — аппроксимация через `spring()` (временно́й easing для time-based переходов; отличается от `animateSpring` — остаётся доступным)
- ✅ появление/удаление элементов (enter/exit) — через `Presence` (`@cairn/primitives`): монтирует/размонтирует с анимацией из `from`-стиля; поддерживает `duration`, `easing`, `spring` (AN3).
- ✅ `For` `flip` — плавное переупорядочивание keyed-списков (AN4): `flip?: boolean | { duration?, easing? }`; invert/play через `onNextLayout` + `transform`; отменяется при перекрывающихся перестановках.

## 9. Интерактивность, состояния, курсор
- ✅ состояния `hover` / `focus` / `active` / `pressed` / `disabled` (live + реактивно)
- ✅ `focusable` / `tabIndex` (проп)
- ✅ `cursor` (pointer / text / …) — применяется к канвасу на hover через `onHoverChange` + `Host.setCursor`
- ✅ `pointerEvents: none` (пропускать хит-тест)
- 🟡 `userSelect` (типизирован, инертен — ждёт выделения текста)

## 10. Изображения и векторы (SVG)
- ✅ `Image`-примитив (+ `objectFit`: `fill` / `contain` / `cover` / `none`)
- **Векторы / SVG:**
  - ✅ `Icon`-примитив (path-данные, как в Lucide)
  - ✅ `Svg` / `Path`-примитив (произвольные пути, заливка / обводка / градиент)
  - ❌ **полный SVG-документ** (парсинг `<svg>`: groups, transforms, gradients, clipPath, filters, `<use>`) — большая отдельная фича

## 11. Тема, токены, тёмная тема
- ✅ базовая тема `createTheme` / `useTheme`
- ✅ дизайн-токены (типизированы: `colors` / `spacing` / `radii` / `fontSizes` через `ThemeTokens`)
- ✅ переключение light / dark вживую (реактивная тема через accessor: `ThemeProvider` принимает `Theme | () => Theme`)
- ✅ варианты компонентов (`variant="primary"`) — хелпер `resolveVariant(map, selected, fallback?)`

## 12. Единицы и адаптивность
- ✅ `%`, `vw` / `vh`, `rem`, `auto`, `calc` — для `width` / `height` / `min*` / `max*` / `padding` у `Box` / `Flex`; `gap` / `margin` / `borderRadius` пока принимают только px; `calc` — один оператор (`A + B` или `A - B`)
- ✅ media-queries / breakpoints — через `useBreakpoint` / `useViewport` / `responsive()`, реактивно от `SurfaceMetrics`
- ✅ адаптив через `SurfaceMetrics` (реактивные width / height) — хелперы `useBreakpoint` / `useViewport` / `responsive()` в `@cairn/primitives`

## 13. Инфраструктура «настоящего приложения»
- ✅ `ScrollView` (колесо + drag, кламп, скроллбар-оверлей; виртуализация ❌ отдельно)
- ✅ `Portal` / `Modal` / `Tooltip` / `Popover` (оверлей-слой в mount: рендер поверх всего, хит-тест первым; позиционирование `computePlacement` + `getAbsRect` с авто-флипом)
- ✅ клиппинг / `overflow: hidden | clip` (в стиле через `overflow`, клипает детей по скруглённому боксу)
- ❌ жесты: drag, swipe, long-press, pinch / zoom, pointer-capture (клики / hover / колесо / клавиатура — есть)
- ❌ виртуализация длинных списков
- ❌ формы: валидация, группы, submit (частично: `Input`, состояния)
- ❌ роутинг (запланирован, Фаза 15/16)
- ❌ i18n / RTL
- ❌ буфер обмена сверх нативного, drag-n-drop файлов

## 14. Доступность (Фаза 14)
- ❌ ARIA-роли, labels, screen-reader зеркало, focus-ring, live-regions

## 15. Производительность (Фаза 12)
- ❌ dirty-region (перерисовка только изменившегося; сейчас — весь кадр целиком)
- ❌ слои / кэш растеризации, `will-change`

---

## Приоритет: «дёшево и полезно» (рендерер уже готов)
Все пункты этого списка реализованы в Phase 10b (✅):
1. ✅ `boxShadow` (есть `setShadow`)
2. ✅ градиенты в `backgroundGradient` (есть `Gradient`)
3. ✅ per-corner `borderRadius` (есть `Radii {tl,tr,br,bl}`)
4. ✅ `textAlign` (есть `TextStyle.align`)
5. ✅ `lineHeight` (есть у `TextNode`)
6. ✅ `opacity` (`globalAlpha` в рендерере)
7. ✅ `Image` / `Icon` / `Svg`-path примитивы (есть `drawImage` / `fillPath`)
8. ✅ `min` / `max` размеры (есть у `BoxNode`)

## «Дорого» — осталось (нужен и движок, и большая фича)
Виртуализация длинных списков, жесты + pointer-capture,
полный SVG-парсер, формы/валидация, dirty-region (Фаза 12), a11y (Фаза 14),
роутинг (Фаза 15/16), i18n / RTL, выделение текста.
(Реализовано ранее и убрано из списка: `flexWrap`, анимации/переходы, Grid, ScrollView, единицы/адаптив, Portal/оверлеи.)

---

## Текущий набор (для ориентира)
- **Примитивы:** `Box`, `Text`, `Row`, `Column`, `Stack`, `Grid`, `ScrollView`, `Spacer`, `Input` (алиас `TextInput`), `Image`, `Icon`, `Path`, `Svg`, `Portal`
  (+ control-flow `Show`/`For`/`Index`/`Switch`, `Presence` (enter/exit — AN3), `ThemeProvider` (принимает `Theme | () => Theme` — реактивная смена темы), сырой `Instance` как escape-hatch;
  позиционирование оверлеев: `computePlacement`, `getAbsRect`).
- **Виджеты (`@cairn/widgets`):** `Button` (primary / secondary / ghost), `Slider`, `Checkbox`, `Switch`, `Divider`, `Modal`, `Tooltip`, `Popover`.
- **Адаптивные утилиты (`@cairn/primitives`):** `useViewport`, `useBreakpoint`, `responsive`, `pickBreakpoint`.
- **`BaseStyle` сейчас:** `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
  (все принимают `Length`: px-числа, `'50%'`, `'100vw'`, `'2rem'`, `'auto'`, `'calc(100% - 16px)'`),
  `left`, `top`, `right`, `bottom`, `inset`,
  `padding` (принимает `Length`; `margin`, `gap`, `rowGap`, `columnGap` — пока px), `margin` (+ `EdgeInsets`), `gap`, `rowGap`, `columnGap`,
  `justify`, `align`, `alignSelf`, `alignX`, `alignY`,
  `flex`, `flexShrink`, `flexBasis`, `flexWrap`,
  `zIndex`, `aspectRatio`,
  `backgroundColor`, `backgroundGradient` (linear/radial),
  `backgroundImage`, `backgroundSize` (`cover | contain | fill`),
  `borderRadius` (единый или `{tl,tr,br,bl}`),
  `border`, `borderTop`, `borderRight`, `borderBottom`, `borderLeft` (`{width,color,style?}`),
  `boxShadow` (массив `Shadow[]`; каждая: `{color,blur,offsetX,offsetY,spread?,inset?}`),
  `textShadow` (`{color,blur,offsetX,offsetY}`),
  `elevation` (пресет: `0–24`),
  `filter` (CSS filter string),
  `backdropFilter` (принят в типе, отложен — v1 limitation),
  `opacity`, `textAlign`, `lineHeight`,
  `color`, `font`, `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`,
  `letterSpacing`, `textTransform`, `textDecoration`,
  `maxLines`, `ellipsis`,
  `overflow`,
  `cursor` (применяется к канвасу на hover),
  `pointerEvents` (`'none'` — пропуск хит-теста),
  `userSelect` (типизирован, инертен — v1 limitation),
  `gridTemplateColumns`, `gridTemplateRows`, `gridTemplateAreas`,
  `justifyItems`, `alignItems`
  (дочерние grid-пропсы: `gridColumn`, `gridRow`, `gridArea`),
  `transform` (translate / scale / rotate / skew — один объект или массив), `transformOrigin`.
- **Состояния:** `hover`, `focus`, `active`, `pressed`, `disabled` (вложенные варианты, live).
- **Стилизация:** инлайн `Style`, массив `Style[]` (каскад), функция `(theme) => Style`, `StyleSheet.create`.
- **Тема (`@cairn/style`):** `createTheme`, `useTheme`, `ThemeTokens` (`colors`/`spacing`/`radii`/`fontSizes`), `resolveVariant(map, selected, fallback?)` (хелпер вариантов компонентов).
- **Анимации (`@cairn/style` + `@cairn/runtime`):** `animate`, `animateKeyframes`, `animateSpring`, `easings` (linear/ease/ease-in/ease-out/ease-in-out), `cubicBezier`, `spring`, `resolveEasing`, `lerp`, `lerpColor`, `interpolateValue`, `transition` / `TransitionConfig` (декларативные переходы на `BaseStyle`; `TransitionConfig.spring` — реальная физика пружины).
  AN1 — структурная интерполяция: `lerpLength` (px/% / rem / vw / vh / auto / calc), `lerpTransform` (translateX/Y, scale/X/Y, rotate, skewX/Y), `lerpShadow` (blur / offset / color), `lerpRadii` (per-corner), `lerpInsets` (padding/margin по сторонам).
  AN2 — реальная spring-физика: `animateSpring` (semi-implicit Euler; `stiffness`/`damping`/`mass`; overshoot; прерываемо с переносом скорости); `TransitionConfig.spring` активирует её декларативно — `duration`/`easing` при этом игнорируются.
  AN3 — `Presence` (enter/exit, `@cairn/primitives`): монтирует/размонтирует дочерний элемент с анимацией из `from`-стиля; `when` — accessor, `children` — thunk `() => Instance`; поддерживает `duration`, `easing`, `spring`.
  AN4 — `For` `flip` (FLIP-переупорядочивание, `@cairn/runtime`): `flip?: boolean | { duration?, easing? }`; захватывает offsetX/Y до reconcile, вычисляет дельты через `onNextLayout`, анимирует transform-сдвиг к нулю; перекрывающиеся перестановки отменяются и запускаются заново.
  Переходы охватывают все структурные пропсы: `opacity`, `color`, `backgroundColor`, `width`/`height`/`min*`/`max*`, `padding`, `margin`, `gap`, `borderRadius`, `border`, `boxShadow`, `transform`, `letterSpacing`, `lineHeight` — на Box / Text / Flex / Grid.
