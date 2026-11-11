import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  initialScheduleDay,
  mondayOf,
  shiftDate,
  todayInNovosibirsk,
  weekDayOptions,
} from './schedule-date.ts'

describe('даты расписания', () => {
  it('переключает день по Новосибирску, независимо от часового пояса устройства', () => {
    assert.equal(todayInNovosibirsk(new Date('2026-11-08T16:59:59Z')), '2026-11-08')
    assert.equal(todayInNovosibirsk(new Date('2026-11-08T17:00:00Z')), '2026-11-09')
  })
  it('относит воскресенье к предыдущему понедельнику', () => {
    assert.equal(mondayOf('2026-11-08'), '2026-11-02')
    assert.equal(mondayOf('2026-11-09'), '2026-11-09')
  })
  it('переключает неделю через границу года', () => {
    assert.equal(shiftDate('2026-12-28', 7), '2027-01-04')
  })

  it('строит все семь переключателей недели с календарными числами', () => {
    assert.deepEqual(weekDayOptions('2026-11-09').map(day => [day.dayOfWeek, day.shortLabel, day.dayNumber]), [
      [1, 'Пн', '9'], [2, 'Вт', '10'], [3, 'Ср', '11'], [4, 'Чт', '12'],
      [5, 'Пт', '13'], [6, 'Сб', '14'], [7, 'Вс', '15'],
    ])
  })

  it('выбирает сегодня внутри текущей недели', () => {
    assert.equal(initialScheduleDay('2026-11-09', '2026-11-10'), 2)
  })

  it('выбирает понедельник для другой недели', () => {
    assert.equal(initialScheduleDay('2026-11-16', '2026-11-10'), 1)
  })
})
