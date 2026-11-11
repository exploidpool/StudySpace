export interface Lesson {
  day_of_week: number
  start_time: string
  end_time: string | null
  subject_name: string
  classroom: string | null
  teacher: string | null
  subgroup: 1 | 2 | null
  position: number
}

export interface ScheduleWeek {
  id: string
  week_start: string
  status: string
  lessons: Lesson[]
}
