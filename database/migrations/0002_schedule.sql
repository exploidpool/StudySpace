CREATE TABLE schedule_weeks (
  id TEXT PRIMARY KEY,
  group_code TEXT NOT NULL CHECK (group_code = 'ИС-942'),
  week_start TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE UNIQUE INDEX schedule_one_published ON schedule_weeks(group_code, week_start) WHERE status = 'published';
CREATE INDEX schedule_lookup ON schedule_weeks(group_code, week_start, status);
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_week_id TEXT NOT NULL REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TEXT NOT NULL,
  end_time TEXT,
  subject_name TEXT NOT NULL,
  classroom TEXT,
  teacher TEXT,
  subgroup INTEGER CHECK (subgroup IN (1, 2)),
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX lessons_week ON lessons(schedule_week_id, day_of_week, start_time, position);
