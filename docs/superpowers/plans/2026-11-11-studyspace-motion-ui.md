# StudySpace Motion UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести утверждённый motion-концепт в существующий React-фронтенд StudySpace, адаптировать оболочку к Telegram Mini App и показывать Telegram username с сокращением после 12 символов.

**Architecture:** Существующая бизнес-логика расписания, авторизации и импорта остаётся без изменений. Новый визуальный слой строится на CSS-токенах Tailwind 4, небольшом локальном наборе SVG-иконок и переиспользуемых представлениях занятий; Telegram-специфика сосредоточена в текущем сервисе `telegram.ts` и CSS-переменных контейнера.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Tailwind CSS 4, Telegram WebApp API, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-11-11-studyspace-motion-design.md`

## Global Constraints

- Не менять backend, API, модель расписания, Telegram-аутентификацию и внутреннюю логику административного импорта.
- Сохранить текущие незакоммиченные изменения Этапа 3A; не откатывать и не переформатировать их вне файлов плана.
- Не добавлять UI-библиотеки, motion-библиотеки, пакеты иконок или шрифты.
- Основной контейнер остаётся мобильным с `max-w-lg`; поддерживаемая ширина начинается с 320 px.
- Все пять вкладок остаются видимыми в общей плавающей навигации; детально перерабатываются только главная и расписание.
- Тема этого прохода только тёмная: `base #111210`, `surface #1a1b18`, `raised #292a26`, `ink #f2f3ed`, `dim #96988e`, `accent #e7ff62`, `accent-ink #15170d`.
- Telegram username сокращается только когда длиннее 12 символов без `@`: первые 12 символов + `…`; при отсутствии username используется `first_name`, вне Telegram — «Привет!».
- Использовать `var(--tg-viewport-stable-height, 100dvh)`, `--tg-content-safe-area-inset-*` и fallback `env(safe-area-inset-*)`; плавающая навигация не должна перекрывать контент.
- Press feedback: `scale(.96) 150ms ease-out`; вход групп: opacity + `translateY(12px)` + blur `4px`, 300ms; смена недели: не более 12 px, 200ms.
- При `prefers-reduced-motion: reduce` отключить scale, transform и blur, оставив opacity до 150ms.
- Не использовать `transition-all`; перечислять изменяемые свойства.
- Не запускать тесты, сборку, линтеры или ручную приёмку до отдельного согласия пользователя по правилам `AGENTS.md`.
- Не выполнять `git add`, commit, push, merge или удаление stash без отдельного явного поручения пользователя.

## Review Focus

- Telegram username ровно из 12 символов не сокращается, а из 13 — сокращается до 12 символов и `…`; закрепить unit-тестами Task 1.
- Пользователь Telegram без username всё равно получает приветствие по `first_name`, а запуск вне Telegram не падает; закрепить unit-тестами Task 1 и ручным сценарием Task 5.
- На 320 px семь переключателей дней, заголовки и плавающая навигация не перекрываются и не создают горизонтальный scroll страницы; проверить в Task 5.
- На iOS/Android safe area и при изменении стабильной высоты viewport нижняя панель остаётся доступной, а последний элемент страницы прокручивается выше неё; проверить в Task 5.
- При `prefers-reduced-motion: reduce` вкладки и недели остаются понятными без transform/blur и без потери текущего состояния; проверить в Task 5.

---

### Task 1: Telegram-имя и Mini App shell

**Files:**
- Create: `frontend/src/services/telegram-display.ts`
- Create: `frontend/src/services/telegram-display.test.mjs`
- Modify: `frontend/src/services/telegram.ts`
- Modify: `frontend/src/styles/index.css`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `getTelegramUser()` и существующий `TelegramWebAppUser` из `frontend/src/types/telegram.d.ts`.
- Produces: `TelegramGreetingUser`; `telegramGreetingName(user: TelegramGreetingUser | null, maxUsernameLength?: number): string | null`; CSS-классы `app-shell`, `page-enter`, `ui-press` и Telegram-safe-area оболочка.

- [ ] **Step 1: Write the failing username tests**

В `telegram-display.test.mjs` проверить:

```js
assert.equal(telegramGreetingName({ username: 'short_name', first_name: 'Алексей' }), '@short_name')
assert.equal(telegramGreetingName({ username: 'abcdefghijkl', first_name: 'Алексей' }), '@abcdefghijkl')
assert.equal(telegramGreetingName({ username: 'abcdefghijklm', first_name: 'Алексей' }), '@abcdefghijkl…')
assert.equal(telegramGreetingName({ first_name: 'Алексей' }), 'Алексей')
assert.equal(telegramGreetingName(null), null)
```

- [ ] **Step 2: Run the focused test to verify RED**

Run only after user approves checks:

`cd frontend; node --test src/services/telegram-display.test.mjs`

Expected: FAIL because `telegram-display.ts` does not exist.

- [ ] **Step 3: Implement `telegramGreetingName`**

Create a pure helper with default `maxUsernameLength = 12`. Telegram supplies username without `@`; prepend it only for display. Do not read `initDataUnsafe` inside the helper so it stays deterministic and testable.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run only after user approves checks:

`cd frontend; node --test src/services/telegram-display.test.mjs`

Expected: 5 passing assertions.

- [ ] **Step 5: Apply the shared palette, viewport and safe-area shell**

In `index.css`, replace the violet palette with the exact Global Constraints colors, add stable viewport sizing and combine Telegram content insets with browser safe-area fallbacks. Add the exact motion primitives without `transition-all`.

In `telegram.ts`, keep `ready()` and `expand()`, and change Telegram header/background synchronization from `#0b0d14` to `#111210`. Do not alter init data or authorization headers.

In `App.tsx`, keep the current tab state and pages, add a keyed page container for entry motion, and reserve enough bottom padding for the floating navigation plus safe area.

- [ ] **Step 6: Stop at the commit boundary**

Do not stage or commit. Suggested future commit: `feat: adapt shell to Telegram mini app`.

### Task 2: Shared visual primitives and floating navigation

**Files:**
- Create: `frontend/src/components/AppIcon.tsx`
- Create: `frontend/src/components/LessonCard.tsx`
- Modify: `frontend/src/components/TabBar.tsx`
- Modify: `frontend/src/components/PageHeader.tsx`
- Modify: `frontend/src/components/EmptyState.tsx`
- Modify: `frontend/src/components/DevBanner.tsx`
- Modify: `frontend/src/components/LessonList.tsx`

**Interfaces:**
- Consumes: `Lesson` from `frontend/src/types/schedule.ts`; `ui-press` and palette tokens from Task 1.
- Produces: `AppIcon({ name, className?, title? })`; `IconName`; `LessonCard({ lesson, variant, stateLabel? })`; `LessonList({ lessons, variant? })` where `variant` is `'home' | 'compact' | 'timeline'`; extended `PageHeader({ title, subtitle?, eyebrow? })`.

- [ ] **Step 1: Create the local icon set**

Move the five existing navigation glyphs into `AppIcon.tsx` and add only icons needed by the approved screens: chevrons, map pin, users, clock and check. Every icon uses `currentColor`, a shared `viewBox`, stroke width 1.8 and `aria-hidden` unless `title` is provided.

- [ ] **Step 2: Rebuild `TabBar` as a floating capsule**

Keep all existing `TabId` values and labels. Use a fixed, `max-w-lg` graphite capsule with safe-area-aware bottom offset, 44 px minimum targets, lime active container, readable inactive labels and `aria-current="page"` on the selected item.

- [ ] **Step 3: Restyle the shared header and status surfaces**

Extend `PageHeader` without breaking existing callers. Restyle `EmptyState` and `DevBanner` using concentric radii, shadow-rings and the new colors; preserve `role` semantics supplied by page content.

- [ ] **Step 4: Add reusable lesson presentation**

`LessonCard` owns time, subject, classroom, teacher and subgroup formatting. `LessonList` keeps the existing stable sort by `start_time` then `position`; it maps the requested variant without changing lesson data.

`home` renders the first sorted lesson as the raised focal card and later lessons as compact rows. `timeline` separates time from the card and adds the small lime marker. `compact` remains appropriate for unfinished secondary tabs if reused later.

- [ ] **Step 5: Perform the type/build checkpoint**

Run only after user approves checks:

`cd frontend; npm.cmd run build`

Expected: TypeScript and Vite complete without errors. This is a structural checkpoint, not final visual acceptance.

- [ ] **Step 6: Stop at the commit boundary**

Do not stage or commit. Suggested future commit: `feat: add motion ui primitives`.

### Task 3: Redesign the home screen around real Telegram and schedule data

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `telegramGreetingName` from Task 1; `PageHeader`, `LessonList`, `EmptyState`, `DevBanner` from Task 2; existing `/schedule/today` response.
- Produces: home data/loading/empty/error/outside-Telegram states in the approved visual system; no new API or state contract.

- [ ] **Step 1: Replace the first-name greeting**

Pass `getTelegramUser()` to `telegramGreetingName`. Render `Привет, ${displayName}` when non-null and `Привет!` outside Telegram. Do not expose the full long username in the visible heading or invent a local nickname.

- [ ] **Step 2: Build the real home hierarchy**

Keep the Novosibirsk date and `/schedule/today`. Present the first sorted lesson as the main focal card, remaining lessons as compact rows, and preserve the honest empty tasks section. Do not add notification, search or task actions that lack product behavior.

- [ ] **Step 3: Normalize async states without layout jumps**

Give loading, API error, empty and outside-Telegram states the same outer geometry as data cards. Preserve `role="status"` and `role="alert"`; `DevBanner` remains visible only outside Telegram.

- [ ] **Step 4: Perform the build checkpoint**

Run only after user approves checks:

`cd frontend; npm.cmd run build`

Expected: TypeScript and Vite complete without errors.

- [ ] **Step 5: Stop at the commit boundary**

Do not stage or commit. Suggested future commit: `feat: redesign studyspace home`.

### Task 4: Redesign schedule selection and week motion

**Files:**
- Modify: `frontend/src/services/schedule-date.ts`
- Modify: `frontend/src/services/schedule-date.test.mjs`
- Modify: `frontend/src/pages/SchedulePage.tsx`

**Interfaces:**
- Consumes: `mondayOf`, `shiftDate`, `todayInNovosibirsk`, `LessonList` timeline variant and the existing `/schedule/week` response.
- Produces: `WeekDayOption { dayOfWeek: number; shortLabel: string; longLabel: string; date: string; dayNumber: string }`; `weekDayOptions(weekStart: string): WeekDayOption[]`; `initialScheduleDay(weekStart: string, today: string): number`.

- [ ] **Step 1: Write failing day-selection tests**

Extend `schedule-date.test.mjs` with assertions that:

```js
assert.deepEqual(weekDayOptions('2026-11-09').map(day => [day.dayOfWeek, day.shortLabel, day.dayNumber]), [
  [1, 'Пн', '9'], [2, 'Вт', '10'], [3, 'Ср', '11'], [4, 'Чт', '12'],
  [5, 'Пт', '13'], [6, 'Сб', '14'], [7, 'Вс', '15'],
])
assert.equal(initialScheduleDay('2026-11-09', '2026-11-10'), 2)
assert.equal(initialScheduleDay('2026-11-16', '2026-11-10'), 1)
```

- [ ] **Step 2: Run the focused test to verify RED**

Run only after user approves checks:

`cd frontend; node --test src/services/schedule-date.test.mjs`

Expected: FAIL because the two helpers are not exported.

- [ ] **Step 3: Implement the pure week-day helpers**

Generate all seven dates from `weekStart` using `shiftDate`; use fixed Russian short/long labels and UTC-safe date parsing already established in this file. Select today only when it belongs to the visible week, otherwise Monday.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run only after user approves checks:

`cd frontend; node --test src/services/schedule-date.test.mjs`

Expected: existing date tests plus the new day-option tests pass.

- [ ] **Step 5: Build the schedule controls and states**

Keep `week`, `revision`, `useMe`, `useSchedule` and the unchanged `ScheduleImport` call. Add previous/next week controls with `AppIcon`, a seven-day tablist, selected-day state and a timeline list for only the selected day. Every day remains reachable with one tap; the page itself must not require horizontal scrolling.

When week changes, update the selected day using `initialScheduleDay`; animate the keyed content by at most 12 px in the arrow direction. Loading, error, unpublished week and no-lessons-for-day states keep stable geometry and correct roles.

- [ ] **Step 6: Preserve the administrative import boundary**

Do not edit `ScheduleImport.tsx`, its parser, OCR flow or publish logic. It may inherit global tokens and input borders, but its layout and motion remain for a later pass.

- [ ] **Step 7: Perform the build checkpoint**

Run only after user approves checks:

`cd frontend; npm.cmd run build`

Expected: TypeScript and Vite complete without errors.

- [ ] **Step 8: Stop at the commit boundary**

Do not stage or commit. Suggested future commit: `feat: redesign weekly schedule`.

### Task 5: Focused verification and Telegram acceptance handoff

**Files:**
- Modify only if behavior discovered during approved verification contradicts the spec: files owned by Tasks 1–4.
- Review: `docs/design-preview/studyspace-motion-concept.html`
- Review: `docs/superpowers/specs/2026-11-11-studyspace-motion-design.md`

**Interfaces:**
- Consumes: completed UI from Tasks 1–4.
- Produces: recorded verification results and a concise list of any Telegram-client-only checks left to the user.

- [ ] **Step 1: Ask for verification permission**

Before running anything, name the exact commands and manual scenarios below and wait for user consent as required by `AGENTS.md`.

- [ ] **Step 2: Run the automated checks after consent**

```powershell
Set-Location frontend
npm.cmd test
npm.cmd run build
git diff --check
```

Expected: all frontend tests pass, production build succeeds, and no whitespace errors are reported. `git diff --check` is read-only but remains grouped with the requested verification permission.

- [ ] **Step 3: Inspect responsive layouts after consent**

Check Home and Schedule at 320×568, 390×844 and the existing desktop `max-w-lg` container. Confirm no page-level horizontal overflow, seven visible day targets, readable 12 px secondary text, and content clearance above the floating navigation.

- [ ] **Step 4: Inspect interaction and motion after consent**

Check all five tabs, previous/next week, all seven days, loading/empty/error views and `prefers-reduced-motion: reduce`. Confirm active states are expressed by more than motion, focus remains visible, and rapid repeated taps do not leave stale selected states.

- [ ] **Step 5: Hand off real Telegram checks**

Ask the user to confirm in Telegram Mobile and Desktop: content safe area, compact/expanded viewport, long username, user without username, and admin import visibility. Do not create a public tunnel or deploy without separate permission.

- [ ] **Step 6: Stop before Git history changes**

Report changed files and verification evidence. Commit and push remain separate user decisions.
