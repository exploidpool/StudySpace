export interface ImportLesson {
  day_of_week: number
  start_time: string
  end_time: string | null
  subject_name: string
  classroom: string | null
  teacher: string | null
  subgroup: 1 | 2 | null
  position: number
}
export interface OcrWord { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }
export interface Region { left: number; top: number; width: number; height: number }
export interface ReviewRow { lesson: ImportLesson; reason: string }
export const normalizeGroup = (text: string) => text.toUpperCase().replace(/[IІ]/g, 'И').replace(/C/g, 'С').replace(/[\s‐‑–—−-]/g, '')
export function detectRegion(words: OcrWord[], width: number, height: number): Region | null {
  const headers = words.filter(w => /[ИIІ][СC][\s‐‑–—−-]*94\d/i.test(w.text))
  const targets = headers.filter(w => normalizeGroup(w.text) === 'ИС942' && w.confidence >= 65)
  if (targets.length !== 1) return null
  const target = targets[0], center = (target.bbox.x0 + target.bbox.x1) / 2
  const peers = headers.filter(w => Math.abs(w.bbox.y0 - target.bbox.y0) < 60)
  const left = peers.filter(w => w.bbox.x1 < center).sort((a,b) => b.bbox.x1-a.bbox.x1)[0]
  const right = peers.filter(w => w.bbox.x0 > center).sort((a,b) => a.bbox.x0-b.bbox.x0)[0]
  const x0 = left ? ((left.bbox.x0 + left.bbox.x1)/2 + center)/2 : Math.max(0, center - (right ? ((right.bbox.x0+right.bbox.x1)/2-center)/2 : width/4))
  const x1 = right ? (center+(right.bbox.x0+right.bbox.x1)/2)/2 : Math.min(width, center+(center-x0))
  return { left: Math.round(x0), top: Math.max(0,target.bbox.y0-10), width: Math.round(x1-x0), height: Math.round(height-target.bbox.y0-10) }
}
function time(text: string) {
  const match = text.match(/^(\d{1,2})[:.](\d{2})[-–—.:]?$/)
  return match && +match[1] < 24 && +match[2] < 60 ? `${match[1].padStart(2,'0')}:${match[2]}` : null
}

// OCR may split a date into several words. Only join words on the same visual line.
export function ocrLines(words: OcrWord[]): OcrWord[][] {
  const lines: OcrWord[][] = []
  for (const word of [...words].sort((a,b) => a.bbox.y0-b.bbox.y0 || a.bbox.x0-b.bbox.x0)) {
    const center = (word.bbox.y0+word.bbox.y1)/2
    const line = lines.find(items => {
      const first = items[0]
      return Math.abs(center-(first.bbox.y0+first.bbox.y1)/2) <= Math.max(2, Math.min(word.bbox.y1-word.bbox.y0, first.bbox.y1-first.bbox.y0)*0.5)
    })
    if (line) line.push(word)
    else lines.push([word])
  }
  return lines.map(line => line.sort((a,b) => a.bbox.x0-b.bbox.x0))
}

function dateBoundaries(words: OcrWord[], weekStart: string) {
  const found: { word: OcrWord; day: number }[] = []
  for (const line of ocrLines(words)) {
    for (let start=0; start<line.length; start++) {
      for (let length=1; length<=5 && start+length<=line.length; length++) {
        const parts = line.slice(start,start+length)
        if (parts.some((part,i) => i>0 && part.bbox.x0-parts[i-1].bbox.x1 > Math.max(12,(part.bbox.y1-part.bbox.y0)*2))) break
        const value = parts.map(word=>word.text).join('').replace(/\s/g,'')
        const match = value.match(/^(\d{2})[.,/](\d{2})[.,/](\d{4})$/)
        if (!match) continue
        const date = `${match[3]}-${match[2]}-${match[1]}`
        const parsed = new Date(`${date}T00:00:00Z`)
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date) continue
        const offset = (parsed.getTime()-Date.parse(`${weekStart}T00:00:00Z`))/86400000
        if (offset<0 || offset>=6 || !Number.isInteger(offset)) continue
        const bbox = {x0:Math.min(...parts.map(w=>w.bbox.x0)), x1:Math.max(...parts.map(w=>w.bbox.x1)), y0:Math.min(...parts.map(w=>w.bbox.y0)), y1:Math.max(...parts.map(w=>w.bbox.y1))}
        if (!found.some(item=>item.day===offset+1 && Math.abs(item.word.bbox.y0-bbox.y0)<3 && Math.abs(item.word.bbox.x0-bbox.x0)<3)) found.push({day:offset+1,word:{text:date,confidence:Math.min(...parts.map(w=>w.confidence)),bbox}})
      }
    }
  }
  return found.sort((a,b)=>a.word.bbox.y0-b.word.bbox.y0)
}
// Dates close the day blocks in the supplied college layout. Never infer a day from row order.
export function parseSchedule(words: OcrWord[], weekStart: string): { lessons: ImportLesson[]; warnings: string[]; review?: ReviewRow[] } {
  const lessons: ImportLesson[] = [], warnings: string[] = []
  const review: ReviewRow[] = []
  const dates = dateBoundaries(words,weekStart)
  if (!dates.length) return { lessons, warnings:[`В выбранной области не найдены даты выбранной недели (${weekStart}). Проверьте неделю, рамку и распознанный текст ниже.`] }
  if (dates.some((d,i)=>i>0 && d.day<=dates[i-1].day)) return {lessons,warnings:['Даты повторяются или идут не по порядку. Выделите только одну таблицу ИС-942.']}
  if (dates.length<6) warnings.push(`Найдены границы ${dates.length} из 6 дней. Сомнительные блоки пропущены; проверьте отсутствующие дни вручную.`)
  let previous = 0, previousDay = 0
  for (const {word:date,day} of dates) {
    const blockTop=previous
    const block = words.filter(w => w.bbox.y0 >= previous && w.bbox.y1 < date.bbox.y0)
    previous = date.bbox.y1
    const consecutive = day===previousDay+1
    previousDay = day
    if (!consecutive) { warnings.push(`День ${day}: нет границы предыдущего дня, занятия этого блока не определены.`); continue }
    const times = block.filter(w=>time(w.text)).sort((a,b)=>a.bbox.y0-b.bbox.y0)
    if (times.length < 2) { warnings.push(`День ${day}: не распознано время.`); continue }
    const left = Math.min(...times.map(w=>w.bbox.x0))
    const heights=times.map(w=>w.bbox.y1-w.bbox.y0).sort((a,b)=>a-b)
    const lineHeight=heights[Math.floor(heights.length/2)]
    const widths=times.filter(w=>w.bbox.x0<left+35).map(w=>w.bbox.x1-w.bbox.x0).sort((a,b)=>a-b)
    const columnWidth=widths[Math.floor(widths.length/2)]
    // Keep unreadable clock tokens in place; dropping one would shift every subsequent pair.
    const clockWords=ocrLines(block.filter(w=>w.bbox.x0<left+columnWidth*.6 && w.bbox.x1<left+columnWidth*1.7 && w.bbox.y0>=times[0].bbox.y0-lineHeight*1.6))
      .map(items=>({text:items.map(w=>w.text).join(''),confidence:Math.min(...items.map(w=>w.confidence)),bbox:{x0:Math.min(...items.map(w=>w.bbox.x0)),x1:Math.max(...items.map(w=>w.bbox.x1)),y0:Math.min(...items.map(w=>w.bbox.y0)),y1:Math.max(...items.map(w=>w.bbox.y1))}}))
    // A date is printed in the final bell slot. Its trailing end-time may enter the next block.
    if(blockTop>0 && clockWords[0] && clockWords[0].bbox.y0<blockTop+lineHeight*.8) clockWords.shift()
    if(clockWords.length % 2) {
      warnings.push(`День ${day}: время распознано неоднозначно. Заполните день вручную.`)
      continue
    }
    for(let i=0;i+1<clockWords.length;i+=2) {
      const start = clockWords[i], end = clockWords[i+1]
      const startTime=time(start.text),endTime=time(end.text)
      const reliableTime=!!startTime && !!endTime && startTime<endTime && end.bbox.y0-start.bbox.y0<=lineHeight*2.5 && Math.min(start.confidence,end.confidence)>=60
      const next = Math.min(clockWords[i+2]?.bbox.y0 ?? date.bbox.y0,end.bbox.y1+lineHeight*.3)
      const row = block.filter(w=>w.bbox.x0 > start.bbox.x1+3 && (w.bbox.y0+w.bbox.y1)/2 >= start.bbox.y0-5 && (w.bbox.y0+w.bbox.y1)/2 < next-3).sort((a,b)=>a.bbox.x0-b.bbox.x0)
      if (!row.length) continue
      const text = row.map(w=>w.text).join(' ')
      if (/предмет|замена|ауд|ИС.?94/i.test(text)) continue
      const roomWord = row.at(-1)
      const room = roomWord && /^\d{3,5}(\/\d{3,5})?$/.test(roomWord.text) ? roomWord.text : null
      const subject = (room ? row.slice(0,-1) : row).map(w=>w.text).join(' ').trim()
      if(!subject || /^[-—–\s/]+$/.test(subject)) continue
      if(!/[A-Za-zА-Яа-яЁё]/.test(subject) && !/\d{2}[.,]\d{2}/.test(subject)) continue
      const reliableText=row.every(w=>w.confidence>=60)
      const halves = subject.split('/')
      if(halves.length>2) { warnings.push(`Проверьте строку: ${text}`); continue }
      const rooms = room?.split('/') ?? []
      const reason=[!reliableTime ? `Проверьте время: «${start.text} / ${end.text}»` : '',!reliableText ? `Низкая уверенность текста: ${text}` : ''].filter(Boolean).join('. ')
      if(reason) warnings.push(`День ${day}: ${reason}. Строка помещена в список для проверки.`)
      halves.forEach((value,index)=> {
        if (!value.trim() || /^[-—–\s]+$/.test(value)) return
        const lesson:ImportLesson={day_of_week:day,start_time:reliableTime ? startTime! : '',end_time:reliableTime ? endTime : null,subject_name:value.trim(),classroom:rooms[index] ?? rooms[0] ?? null,teacher:null,subgroup:halves.length===2 ? (index+1) as 1|2 : null,position:lessons.length}
        if(reason) review.push({lesson,reason})
        else lessons.push(lesson)
      })
    }
  }
  warnings.push('Проверьте все дни, подгруппы, колонку «замена» и рукописные исправления по исходному фото. Нераспознанные строки могут отсутствовать.')
  return {lessons,warnings,review}
}
