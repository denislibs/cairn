# Cairn — Стилизация и возможности: полный каталог

> Справочник: что нужно фреймворку для полноценных приложений, и что из этого уже есть.
> Дата: 2026-07-03.

**Ключевой факт:** низкоуровневый рендерер (`@cairn/host` `Renderer`) уже умеет многое —
градиенты (`Gradient` linear/radial), тени (`setShadow`/`Shadow`), per-corner радиусы
(`Radii {tl,tr,br,bl}`), векторные пути (`Path` + `fillPath`/`strokePath`), картинки
(`drawImage`), `clipRect`, `translate`/`scale`, `TextStyle.align`. Но слой стилей
(`BaseStyle` в `@cairn/style`) почти ничего из этого наружу не выдаёт. Значительная часть
работы — «прокинуть» уже существующие возможности рендерера в стиль.

**Легенда статусов:**
- ✅ — есть в стиле сейчас
- 🟡 — движок/рендерер умеет, надо вывести в `BaseStyle`/примитив
- ❌ — нет вообще (нужно и в движке, и в стиле)

---

## 1. Размеры и box-model
- ✅ `width`, `height`
- ✅ `minWidth` / `maxWidth` / `minHeight` / `maxHeight`
- ✅ `padding` (+ по сторонам через `EdgeInsets`)
- ✅ `margin` (+ по сторонам через `EdgeInsets`)
- ✅ `aspectRatio`
- ❌ `boxSizing` (сейчас поведение border-box-подобное)
- ✅ `gap`; ✅ раздельные `rowGap` / `columnGap`
- ❌ `overflow: visible | hidden | scroll | clip` (в рендерере `clipRect` есть; scroll — отдельная инфраструктура)

## 2. Флекс и позиционирование
- ✅ `flexDirection` (`Row` / `Column`)
- ✅ `justify` (главная ось), `align` (поперечная ось)
- ✅ `alignSelf` (переопределение cross на ребёнке)
- ✅ `flex` (grow); ✅ `flexShrink`, `flexBasis`
- ✅ `flexWrap` (перенос на новую линию)
- ✅ `mainAxisSize: 'min' | 'max'` (shrink-wrap vs fill)
- ✅ `position` (`Stack` + `left`/`top`/`right`/`bottom`/`inset`)
- ✅ `zIndex`
- ❌ `Grid` (columns / rows / areas)

## 3. Фон и заливки
- ✅ `backgroundColor`
- ✅ `backgroundGradient` (linear / radial)
- ❌ `backgroundImage` / `objectFit`
- ✅ `opacity` (альфа всего элемента)
- ❌ `backdropFilter` (блюр под элементом)

## 4. Границы
- ✅ `border { width, color }` (все стороны одинаково)
- ✅ per-side (`borderTop` / `borderRight` / `borderBottom` / `borderLeft`)
- ✅ `borderStyle` (solid / dashed / dotted)
- ✅ `borderRadius` (единый); ✅ per-corner (`{ tl, tr, br, bl }`)
- ❌ `outline` / focus-ring как отдельный слой

## 5. Тени и эффекты
- ✅ `boxShadow` (color / blur / offsetX / offsetY)
- ✅ `textShadow`
- ❌ `elevation` (пресеты material-теней)
- ❌ `filter`: blur / brightness / contrast / …

## 6. Типографика
- ✅ `font` (CSS-шорткат строкой), `color`
- ❌ раздельные `fontFamily` / `fontSize` / `fontWeight` / `fontStyle`
- ✅ `lineHeight`
- ✅ `textAlign` (left / center / right)
- ❌ `letterSpacing`, `wordSpacing`
- ❌ `textDecoration` (underline / strikethrough)
- ❌ `textTransform` (upper / lower / capitalize)
- ❌ `maxLines` + `ellipsis` (обрезка «…»)
- ❌ перенос строк / многострочность (сейчас однострочно)
- ❌ выделение текста (selection)

## 7. Трансформации
- 🟡 `translate`, `scale` (рендерер умеет)
- ❌ `rotate`, `skew` (в рендерере нет `rotate` — надо добавить)
- ❌ `transformOrigin`

## 8. Анимации и переходы (Фаза 13)
- ❌ `transition` (свойство / длительность / easing / delay)
- ❌ keyframes-анимации
- ❌ spring-физика
- ❌ анимация появления / удаления списков (FLIP)

## 9. Интерактивность, состояния, курсор
- ✅ состояния `hover` / `focus` / `active` / `pressed` / `disabled` (live + реактивно)
- ✅ `focusable` / `tabIndex` (проп)
- ❌ `cursor` (pointer / text / …) — сейчас курсор один на весь канвас
- ❌ `pointerEvents: none` (пропускать хит-тест)
- ❌ `userSelect`

## 10. Изображения и векторы (SVG)
- ✅ `Image`-примитив (+ `objectFit`: `fill` / `contain` / `cover` / `none` / `scale-down`)
- **Векторы / SVG:**
  - ✅ `Icon`-примитив (path-данные, как в Lucide)
  - ✅ `Svg` / `Path`-примитив (произвольные пути, заливка / обводка / градиент)
  - ❌ **полный SVG-документ** (парсинг `<svg>`: groups, transforms, gradients, clipPath, filters, `<use>`) — большая отдельная фича

## 11. Тема, токены, тёмная тема
- ✅ базовая тема `createTheme` / `useTheme`
- 🟡 дизайн-токены (шкала отступов / типографики / палитра / радиусы) — можно класть в тему вручную
- ❌ переключение light / dark вживую (тема сейчас не реактивна на смену)
- ❌ варианты компонентов (`variant="primary"`)

## 12. Единицы и адаптивность
- ✅ только px; ❌ `%`, `vw` / `vh`, `rem`, `auto`, `calc`
- ❌ media-queries / breakpoints
- 🟡 адаптив через `SurfaceMetrics` (реактивные width / height) — можно вручную считать от размера канваса

## 13. Инфраструктура «настоящего приложения»
- ❌ `ScrollView` (вертикальный / горизонтальный, инерция)
- ❌ `Portal` / оверлеи / `Modal` / `Tooltip` / `Popover`
- 🟡 клиппинг / `overflow: hidden` (в рендерере `clipRect` есть, в стиле нет)
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

## «Дорого» (нужен и движок, и большая фича)
Перенос строк / многострочный текст, `flexWrap`, `Grid`, `ScrollView`, `Portal` / оверлеи,
анимации (Фаза 13), полный SVG-парсер, жесты + pointer-capture, dirty-region (Фаза 12),
a11y (Фаза 14), роутинг (Фаза 15/16).

---

## Текущий набор (для ориентира)
- **Примитивы:** `Box`, `Text`, `Row`, `Column`, `Stack`, `Input`, `Image`, `Icon`, `Path`, `Svg`
  (+ control-flow `Show`/`For`/`Index`/`Switch`, `ThemeProvider`, сырой `Instance` как escape-hatch).
- **Виджеты (`@cairn/widgets`):** `Button` (primary / secondary / ghost), `Slider`, `Checkbox`, `Switch`, `Divider`.
- **`BaseStyle` сейчас:** `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`,
  `left`, `top`, `right`, `bottom`, `inset`,
  `padding`, `margin` (+ `EdgeInsets`), `gap`, `rowGap`, `columnGap`,
  `justify`, `align`, `alignSelf`, `alignX`, `alignY`,
  `flex`, `flexShrink`, `flexBasis`, `flexWrap`,
  `zIndex`, `aspectRatio`,
  `backgroundColor`, `backgroundGradient` (linear/radial),
  `borderRadius` (единый или `{tl,tr,br,bl}`),
  `border`, `borderTop`, `borderRight`, `borderBottom`, `borderLeft` (`{width,color,style?}`),
  `boxShadow`, `textShadow` (`{color,blur,offsetX,offsetY}`),
  `opacity`, `textAlign`, `lineHeight`,
  `color`, `font`.
- **Состояния:** `hover`, `focus`, `active`, `pressed`, `disabled` (вложенные варианты, live).
- **Стилизация:** инлайн `Style`, массив `Style[]` (каскад), функция `(theme) => Style`, `StyleSheet.create`.
