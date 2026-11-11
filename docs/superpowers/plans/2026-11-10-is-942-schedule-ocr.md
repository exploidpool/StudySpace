# IS-942 Schedule OCR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в существующий StudySpace подтверждаемое администратором расписание ИС-942: импорт одной фотографии с несколькими группами, поиск блока ИС-942, редактирование черновика, публикацию и вывод занятий на сегодня/неделю.

**Architecture:** OCR выполняется в браузере с помощью Tesseract.js; исходное изображение не отправляется на backend. Клиент передаёт структурированный черновик, а Cloudflare Worker валидирует роль и данные, сохраняет версии недели и атомарно публикует одну активную версию в D1. Существующие пять вкладок и структура каталогов сохраняются.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Tesseract.js, Vitest + Testing Library, Cloudflare Workers, Hono, D1, `@cloudflare/vitest-plugin`.

**Spec:** `docs/superpowers/specs/2026-11-10-is-942-schedule-ocr-design.md`

## Global Constraints

- Целевая группа пилота — ровно `ИС-942`; архитектура не должна препятствовать добавлению других групп позже.
- До этапа учебных групп все авторизованные пользователи пилота считаются участниками ИС-942.
- Администратор выбирает понедельник недели вручную; текущая неделя подставляется по умолчанию, дата с фото не распознаётся.
- Одна фотография относится к одной выбранной неделе; чётность и временные изменения отражаются содержимым этой публикации, без повторяющихся шаблонов и таблицы исключений.
- Часовой пояс пилота — `Asia/Novosibirsk`.
- Обязательны день, время начала и предмет; время окончания, кабинет и преподаватель могут быть пустыми.
- Занятие имеет `subgroup: 1|2|null`; две записи одного времени допустимы для разных подгрупп, а студентам пилота показываются обе.
- Навигация остаётся: «Главная», «Расписание», «Задания», «Материалы», «Профиль».
- Одна фотография может содержать несколько групп и произвольное расположение таблиц.
- Ни один результат OCR не публикуется без явного подтверждения администратора.
- Только пользователь с серверной ролью `admin` создаёт, изменяет и публикует черновики; студент только читает опубликованное расписание.
- Исходная фотография обрабатывается в браузере, не загружается на backend и не сохраняется.
- Только бесплатные open-source зависимости; платные OCR/AI API и SaaS запрещены.
- Реальные секреты не помещаются в Git или frontend.
- По правилам проекта проверки запускаются только после отдельного согласия пользователя.
- По правилам проекта коммиты не создаются без явного поручения; шаги ниже заканчиваются подготовленным изменением и отчётом, а не автоматическим коммитом.

## Review Focus

- Заголовок другой группы похож на `ИС-942`: область не выбирается автоматически без достаточной уверенности, администратору предлагается ручной выбор.
- Фото низкого качества, повёрнуто или слишком велико: интерфейс сообщает ограничение и не зависает без обратной связи.
- Две публикации одной недели: в D1 остаётся ровно одна активная опубликованная версия.
- Переход даты через воскресенье/понедельник и часовой пояс профиля: главная выбирает правильный день и неделю.
- Студент вызывает административный endpoint напрямую: сервер отвечает `403`, не изменяя D1.

---

### Task 1: Зафиксировать тестовую основу и обезличенные OCR-примеры

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/test/apply-migrations.ts`
- Create: `backend/test/env.d.ts`
- Create: `frontend/src/features/schedule/__fixtures__/ocr-is-942.json`
- Create: `docs/schedule-photo-fixtures.md`

**Interfaces:**
- Consumes: существующие Vite, Workers и D1-конфигурации.
- Produces: команды `npm test` в обоих пакетах; локальная D1 для backend-тестов; обезличенный массив OCR-слов с координатами.

- [ ] **Step 1: Подготовить 3–5 репрезентативных фотографий**

Попросить пользователя предоставить примеры разных форматов. Не передавать их сторонним сервисам и не добавлять оригиналы в Git без отдельного согласия. В `docs/schedule-photo-fixtures.md` описать только формат, разрешение, поворот и особенности таблицы.

По примерам проверить запись `первая подгруппа / вторая подгруппа` и добавить отдельные обезличенные OCR-строки для обеих половин. Для каждого примера записать выбранный `week_start`; не пытаться выводить дату или чётность недели из содержимого фотографии.

- [ ] **Step 2: Установить тестовые зависимости frontend**

Из `frontend` установить Vitest, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` и `jsdom` как devDependencies. Добавить скрипт `"test": "vitest run"`.

- [ ] **Step 3: Установить официальный тестовый плагин Workers**

Из `backend` установить `vitest@^4.1.0` и `@cloudflare/vitest-plugin` как devDependencies. Добавить скрипт `"test": "vitest run"`; настроить `cloudflareTest()` на `wrangler.jsonc` и применение миграций из `../database/migrations`.

- [ ] **Step 4: Создать обезличенную OCR-фикстуру**

Зафиксировать только текст, confidence и bbox для примера, содержащего `ИС-942`, соседние группы, дни, время, предмет, кабинет и преподавателя. Личные данные и исходное изображение не сохранять.

- [ ] **Step 5: После согласия запустить пустую тестовую основу**

Run: `cd frontend; npm test`

Run: `cd backend; npm test`

Expected: оба раннера запускаются без ошибок конфигурации; отсутствие тестов обрабатывается выбранной настройкой явно.

---

### Task 2: Добавить схему версий расписания и доменные типы

**Files:**
- Create: `database/migrations/0002_schedule.sql`
- Create: `backend/src/domain/schedule.ts`
- Create: `frontend/src/types/schedule.ts`
- Create: `backend/test/schedule-migration.test.ts`

**Interfaces:**
- Consumes: `users.id`, роль `users.role`, D1.
- Produces: таблицы `schedule_weeks` и `lessons`; типы `ScheduleWeekStatus`, `LessonInput`, `ScheduleDraftInput`, `ScheduleLesson`, `ScheduleWeekResponse`.

- [ ] **Step 1: Написать падающий тест миграции**

`schedule-migration.test.ts` проверяет внешние ключи, допустимые статусы, дни 1–7, формат группы `ИС-942`, индекс чтения по `group_code + week_start + status` и невозможность иметь две опубликованные версии одной недели.

- [ ] **Step 2: После согласия подтвердить падение**

Run: `cd backend; npm test -- schedule-migration.test.ts`

Expected: FAIL — таблицы расписания ещё отсутствуют.

- [ ] **Step 3: Создать миграцию**

`schedule_weeks`: `id`, `group_code`, `week_start`, `status`, `created_by`, `created_at`, `updated_at`, `published_at`. Несколько черновиков разрешены; опубликованные строки не редактируются напрямую.

`lessons`: `id`, `schedule_week_id`, `day_of_week`, `start_time`, `end_time`, `subject_name`, `classroom`, `teacher`, `subgroup` (`NULL|1|2`), `position`.

Добавить ограничения CHECK, внешние ключи и частичный уникальный индекс активной публикации.

- [ ] **Step 4: Определить одинаковые wire-типы frontend/backend**

`LessonInput` содержит `dayOfWeek: 1|2|3|4|5|6|7`, `startTime`, `endTime|null`, `subjectName`, `classroom|null`, `teacher|null`, `subgroup: 1|2|null`, `position`. Поля числителя/знаменателя добавляются только если оставшийся открытый вопрос design подтверждён до начала Task 2.

`ScheduleDraftInput` содержит `groupCode: 'ИС-942'`, `weekStart: string`, `lessons: LessonInput[]`.

Не добавлять `weekParity`, повторяющиеся шаблоны или исключения: отдельная опубликованная запись `schedule_weeks` уже представляет фактическое расписание конкретной недели со всеми изменениями.

- [ ] **Step 5: После согласия проверить миграцию**

Run: `cd backend; npm test -- schedule-migration.test.ts`

Expected: PASS.

---

### Task 3: Реализовать серверную валидацию, права и API расписания

**Files:**
- Create: `backend/src/middleware/require-admin.ts`
- Create: `backend/src/validators/schedule.ts`
- Create: `backend/src/services/schedule.ts`
- Create: `backend/src/routes/schedule.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/types.ts`
- Create: `backend/test/schedule-api.test.ts`

**Interfaces:**
- Consumes: `authMiddleware`, D1-таблицы Task 2, `ScheduleDraftInput`.
- Produces: `requireAdmin`; `validateScheduleDraft(value: unknown): ScheduleDraftInput`; API `GET /api/schedule/today`, `GET /api/schedule/week`, `POST /api/schedule/drafts`, `PUT /api/schedule/drafts/:id`, `POST /api/schedule/drafts/:id/publish`.

- [ ] **Step 1: Написать падающие API-тесты чтения**

Проверить: студент получает опубликованную неделю; черновик не виден; неизвестная неделя возвращает пустой результат; `today` выбирает только нужный день.

- [ ] **Step 2: Написать падающие API-тесты прав**

Проверить ответы `401` без Telegram-контекста, `403` для студента на каждом write-endpoint и отсутствие изменений D1 после отказа.

- [ ] **Step 3: Написать падающие тесты валидации**

Проверить отклонение другой группы, даты не-понедельника, дня вне 1–7, пустого предмета, неверного времени, окончания раньше начала, слишком длинных строк и чрезмерного числа занятий.

- [ ] **Step 4: После согласия подтвердить падение**

Run: `cd backend; npm test -- schedule-api.test.ts`

Expected: FAIL — маршруты отсутствуют.

- [ ] **Step 5: Реализовать middleware и validator**

`requireAdmin` читает только `c.get('user').role`. `validateScheduleDraft` возвращает нормализованный ввод или бросает типизированную ошибку `400` с полями, которые нужно исправить.

- [ ] **Step 6: Реализовать сервис версий**

Определить `getPublishedWeek(db, groupCode, weekStart)`, `saveDraft(db, adminId, input, draftId?)` и `publishDraft(db, adminId, draftId)`. Публикация одним `DB.batch()` архивирует прежнюю опубликованную неделю и публикует выбранный черновик.

- [ ] **Step 7: Подключить маршруты**

Все маршруты используют текущего авторизованного пользователя; административные маршруты дополнительно используют `requireAdmin`. Группа на пилоте задаётся сервером как `ИС-942`, а не принимается как полномочие клиента.

- [ ] **Step 8: После согласия проверить API**

Run: `cd backend; npm test -- schedule-api.test.ts`

Expected: PASS, включая конкурентную/повторную публикацию и `403` для студента.

---

### Task 4: Реализовать OCR-адаптер и поиск заголовка ИС-942

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/features/schedule/ocr/types.ts`
- Create: `frontend/src/features/schedule/ocr/normalizeGroupCode.ts`
- Create: `frontend/src/features/schedule/ocr/detectGroupRegion.ts`
- Create: `frontend/src/features/schedule/ocr/createOcrWorker.ts`
- Create: `frontend/src/features/schedule/ocr/detectGroupRegion.test.ts`

**Interfaces:**
- Consumes: выбранный пользователем `File`, Tesseract.js blocks/bbox output, фикстуру Task 1.
- Produces: `OcrWord`, `ImageRegion`, `GroupDetection`; `normalizeGroupCode(text: string): string`; `detectGroupRegion(words: OcrWord[], image: ImageSize, target: 'ИС-942'): GroupDetection`; `recognizeImage(file, region?, onProgress?): Promise<OcrPage>`.

- [ ] **Step 1: Написать тесты нормализации заголовка**

Проверить `ИС-942`, разные тире/пробелы/регистр и допустимые смешения латинских `I/C` с кириллицей; не принимать `ИС-941`, `ИС-9420` и соседние группы.

- [ ] **Step 2: Написать тесты выбора области**

Проверить уверенное нахождение единственного заголовка, неоднозначность двух совпадений, отсутствие заголовка, ограничение bbox размерами изображения и сохранение соседних блоков за пределами выбранной области.

- [ ] **Step 3: После согласия подтвердить падение**

Run: `cd frontend; npm test -- detectGroupRegion.test.ts`

Expected: FAIL — OCR-модули отсутствуют.

- [ ] **Step 4: Установить и закрепить Tesseract.js**

Добавить `tesseract.js` в frontend dependencies. Разместить worker/core и языковые данные `rus+eng` как статические ресурсы проекта с указанием источника и лицензии; не загружать их с внешнего CDN во время работы.

- [ ] **Step 5: Реализовать адаптер OCR**

Создавать один worker на сеанс импорта, включать `blocks` output, поддерживать `rotateAuto`, прогресс и корректное `terminate()`. Для выбранной области использовать rectangle recognition.

- [ ] **Step 6: Реализовать детектор области**

Автоматический результат возвращать только при единственном уверенном совпадении; иначе возвращать причину `not_found|ambiguous|low_confidence`, чтобы интерфейс перешёл к ручному выделению.

- [ ] **Step 7: После согласия проверить чистую логику**

Run: `cd frontend; npm test -- detectGroupRegion.test.ts`

Expected: PASS.

---

### Task 5: Преобразовать OCR блока в редактируемый черновик

**Files:**
- Create: `frontend/src/features/schedule/ocr/parseSchedule.ts`
- Create: `frontend/src/features/schedule/ocr/parseSchedule.test.ts`
- Create: `frontend/src/features/schedule/components/ScheduleDraftEditor.tsx`
- Create: `frontend/src/features/schedule/components/ScheduleDraftEditor.test.tsx`

**Interfaces:**
- Consumes: `OcrPage` выбранной области.
- Produces: `ScheduleParseResult { lessons: LessonInput[]; unparsedLines: string[]; warnings: ParseWarning[] }`; редактируемый `ScheduleDraftEditor`.

- [ ] **Step 1: Написать тесты парсера по обезличенным OCR-данным**

Проверить русские названия дней, время `HH:MM`, многострочные предметы, пустой кабинет/преподавателя, пару `первая подгруппа / вторая подгруппа`, неизвестные строки и сохранение исходного текста в предупреждении вместо молчаливой потери.

- [ ] **Step 2: Написать UI-тесты редактора**

Проверить добавление/удаление строки, изменение всех полей, отображение ошибок, предупреждений и блокировку публикации при невалидных данных.

- [ ] **Step 3: После согласия подтвердить падение**

Run: `cd frontend; npm test -- parseSchedule.test.ts ScheduleDraftEditor.test.tsx`

Expected: FAIL.

- [ ] **Step 4: Реализовать консервативный парсер**

Автоматически создавать занятие только когда день и время определены однозначно. Подтверждённый формат подгрупп преобразовывать в две записи с одинаковыми днём и временем и разными `subgroup`; сомнительные фрагменты помещать в `unparsedLines`, не угадывая кабинет или преподавателя.

- [ ] **Step 5: Реализовать редактор**

Администратор может полностью исправить распознанные строки и вручную добавить пропущенные. Редактор формирует ровно `ScheduleDraftInput` из Task 2.

- [ ] **Step 6: После согласия проверить парсер и редактор**

Run: `cd frontend; npm test -- parseSchedule.test.ts ScheduleDraftEditor.test.tsx`

Expected: PASS.

---

### Task 6: Встроить административный импорт в существующую вкладку «Расписание»

**Files:**
- Create: `frontend/src/features/schedule/components/SchedulePhotoImport.tsx`
- Create: `frontend/src/features/schedule/components/GroupRegionSelector.tsx`
- Create: `frontend/src/features/schedule/hooks/useScheduleImport.ts`
- Create: `frontend/src/features/schedule/components/SchedulePhotoImport.test.tsx`
- Modify: `frontend/src/pages/SchedulePage.tsx`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Consumes: OCR Task 4, editor Task 5, `/api/schedule/drafts*`, текущего пользователя из `useMe()`.
- Produces: административный поток `select → recognize → confirm region → review → save draft → publish` внутри существующей страницы.

- [ ] **Step 1: Написать UI-тесты полного потока с mock OCR/API**

Проверить допустимые PNG/JPEG, отклонение неверного типа/размера, прогресс, автоматическую область, ручной fallback, обязательный просмотр, сохранение черновика и отдельное подтверждение публикации.

- [ ] **Step 2: Написать тест видимости по роли**

Студент не видит импорт; администратор видит. Тест отдельно фиксирует, что UI-скрытие не заменяет серверный `403` из Task 3.

- [ ] **Step 3: После согласия подтвердить падение**

Run: `cd frontend; npm test -- SchedulePhotoImport.test.tsx`

Expected: FAIL.

- [ ] **Step 4: Реализовать ручной выбор области**

`GroupRegionSelector` отображает изображение и изменяемый прямоугольник в нормализованных координатах 0–1; при изменении размера экрана координаты не теряются.

- [ ] **Step 5: Реализовать state machine импорта**

Недопустимые переходы блокируются. При размонтировании worker завершается, object URL освобождается, повторная загрузка сбрасывает предыдущий черновик только после подтверждения.

- [ ] **Step 6: Встроить поток без изменения навигации**

Изменять только содержимое `SchedulePage`; `TabBar` и `TabId` не менять.

- [ ] **Step 7: После согласия проверить поток**

Run: `cd frontend; npm test -- SchedulePhotoImport.test.tsx`

Expected: PASS.

---

### Task 7: Показать опубликованное расписание на неделю и сегодня

**Files:**
- Create: `frontend/src/features/schedule/components/WeekSchedule.tsx`
- Create: `frontend/src/features/schedule/components/TodaySchedule.tsx`
- Create: `frontend/src/features/schedule/hooks/useSchedule.ts`
- Create: `frontend/src/features/schedule/date.ts`
- Create: `frontend/src/features/schedule/date.test.ts`
- Create: `frontend/src/features/schedule/components/WeekSchedule.test.tsx`
- Modify: `frontend/src/pages/SchedulePage.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `GET /api/schedule/today`, `GET /api/schedule/week`, профиль `timezone`.
- Produces: карточки занятий на главной и недельное представление в существующей вкладке.

- [ ] **Step 1: Написать тесты определения недели и дня**

Проверить понедельник, воскресенье, переход месяца/года и часовой пояс из профиля. При отсутствии корректного timezone использовать явно документированный fallback `Asia/Novosibirsk` для пилота ИС-942.

- [ ] **Step 2: Написать UI-тесты расписания**

Проверить сортировку по времени/position, совместный вывод подгрупп 1 и 2 с метками, пустую неделю, состояние загрузки, ошибку API, отсутствие фиктивных данных и переключение недель.

- [ ] **Step 3: После согласия подтвердить падение**

Run: `cd frontend; npm test -- date.test.ts WeekSchedule.test.tsx`

Expected: FAIL.

- [ ] **Step 4: Реализовать hook и компоненты чтения**

`useSchedule` отменяет устаревший запрос при смене недели. Компоненты показывают предмет, время, кабинет и преподавателя только если поле заполнено.

- [ ] **Step 5: Подключить существующие страницы**

На `HomePage` заменить заглушку «Ближайшие занятия» реальными занятиями текущего дня. На `SchedulePage` заменить основную заглушку недельным расписанием, сохранив admin-блок Task 6.

- [ ] **Step 6: После согласия проверить отображение**

Run: `cd frontend; npm test -- date.test.ts WeekSchedule.test.tsx`

Expected: PASS.

---

### Task 8: Документация, ручная приёмка и границы этапа

**Files:**
- Modify: `README.md`
- Create: `docs/schedule-admin-guide.md`
- Create: `docs/tz-status.md`

**Interfaces:**
- Consumes: завершённые Tasks 1–7.
- Produces: инструкции администратора, актуальный статус исходного ТЗ и команды проверки.

- [ ] **Step 1: Обновить README**

Описать пилот ИС-942, локальную установку OCR-ресурсов, миграцию D1, назначение администратора вручную и отсутствие хранения исходного фото. Зафиксировать, что файлы этапа 4 будут храниться в выбранном приватном Telegram-канале через Bot API; не смешивать их с локальной OCR-обработкой фото расписания.

- [ ] **Step 2: Написать инструкцию администратора**

Пошагово: выбрать фото, проверить найденный блок, исправить строки, сохранить черновик, подтвердить публикацию и проверить главную/неделю.

- [ ] **Step 3: Зафиксировать соответствие ТЗ**

В `docs/tz-status.md` отметить этапы 1–2 выполненными, расписание ИС-942 как подэтап 3A, а остальные модули как не реализованные. Отдельно отметить принятое отклонение от исходного предложения R2: этап 4 использует приватный Telegram-канал через Bot API.

- [ ] **Step 4: После согласия выполнить автоматические проверки**

Run: `cd backend; npm test; npm run typecheck`

Run: `cd frontend; npm test; npm run build`

Expected: все тесты PASS, typecheck/build завершаются с exit code 0.

- [ ] **Step 5: После согласия выполнить ручной сценарий**

Проверить Telegram Mobile и Desktop на нескольких реальных фотографиях: найденная/не найденная/неоднозначная ИС-942, подгруппы, чётная и нечётная конкретные недели, разовые изменения, ручное выделение, исправление OCR, `403` студенту, публикация и замена недели.

- [ ] **Step 6: Подготовить отчёт без автоматического коммита**

Перечислить изменённые файлы, фактически выполненные проверки и ограничения распознавания. Коммит, push и PR выполнять только по отдельному поручению пользователя.
