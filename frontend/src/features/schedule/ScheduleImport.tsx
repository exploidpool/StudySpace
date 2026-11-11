import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../services/api'
import { mondayOf, todayInNovosibirsk } from '../../services/schedule-date'
import { detectRegion, parseSchedule, ocrLines } from './importModel'
import type { ImportLesson, Region, ReviewRow } from './importModel'
import { loadPhoto, recognize } from './ocr'
import { PhotoInput } from './PhotoInput'
const days=['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const field='rounded border border-line bg-base p-2 text-ink w-full'
const button='rounded bg-accent px-3 py-2 text-white disabled:opacity-40'
const blank=():ImportLesson=>({day_of_week:1,start_time:'08:30',end_time:null,subject_name:'',classroom:null,teacher:null,subgroup:null,position:0})
export function ScheduleImport({onPublished}:{onPublished:()=>void}) {
  const [week,setWeek]=useState(mondayOf(todayInNovosibirsk()))
  const [photo,setPhoto]=useState<HTMLCanvasElement|null>(null)
  const [preview,setPreview]=useState('')
  const [region,setRegion]=useState<Region>({left:0,top:0,width:1,height:1})
  const [lessons,setLessons]=useState<ImportLesson[]>([])
  const [warnings,setWarnings]=useState<string[]>([])
  const [recognizedText,setRecognizedText]=useState<string|null>(null)
  const [review,setReview]=useState<ReviewRow[]>([])
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [draft,setDraft]=useState<string|null>(null)
  const [dirty,setDirty]=useState(true)
  const [confirmed,setConfirmed]=useState(false)
  const alive=useRef(true)
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false}},[])
  async function run(task:()=>Promise<void>) {
    setBusy(true); setMessage('')
    try {await task()} catch(e) {if(alive.current)setMessage(e instanceof Error ? e.message : 'Операция не выполнена. Повторите попытку.')} finally {if(alive.current)setBusy(false)}
  }
  const change=(items:ImportLesson[])=>{setLessons(items);setDirty(true);setConfirmed(false)}
  const overlaps=lessons.flatMap((a,i)=>lessons.slice(i+1).filter(b=>a.day_of_week===b.day_of_week && !(a.subgroup!==null && b.subgroup!==null && a.subgroup!==b.subgroup) && a.start_time<(b.end_time??b.start_time+'~') && b.start_time<(a.end_time??a.start_time+'~')).map(b=>`${days[a.day_of_week-1]}: ${a.subject_name} / ${b.subject_name}`))
  async function select(file:File) {
    await run(async()=>{
      setMessage('Подготавливаю изображение…')
      setRecognizedText(null)
      setReview([])
      const canvas=await loadPhoto(file)
      setPhoto(canvas);setPreview(canvas.toDataURL('image/jpeg'));setDraft(null);change([])
      setRegion({left:0,top:0,width:canvas.width,height:canvas.height})
      setWarnings(['Обведите только таблицу ИС-942, без соседних групп и списка преподавателей.'])
      const words=await recognize(canvas,undefined,setMessage)
      if(!alive.current)return
      const found=detectRegion(words,canvas.width,canvas.height)
      if(found)setRegion(found)
      setMessage(found ? 'Найдена предполагаемая область ИС-942. Проверьте и поправьте её перед распознаванием.' : 'Заголовок ИС-942 не найден однозначно. Выделите таблицу вручную.')
    })
  }
  function update(index:number,value:Partial<ImportLesson>) {change(lessons.map((l,i)=>i===index?{...l,...value}:l))}
  function moveRegion(key:keyof Region,value:number) {
    if(!photo)return
    const r={...region,[key]:Math.max(0,Math.round(value))}
    r.left=Math.min(r.left,photo.width-1);r.top=Math.min(r.top,photo.height-1)
    r.width=Math.max(1,Math.min(r.width,photo.width-r.left));r.height=Math.max(1,Math.min(r.height,photo.height-r.top));setRegion(r)
  }
  return <details className="rounded-xl border border-line bg-surface p-4"><summary className="cursor-pointer font-semibold">Импорт и публикация · администратор</summary>
    <div className="mt-4 space-y-4">
      <p className="text-sm text-dim">Фото обрабатывается на устройстве. На сервер отправляются только исправленные занятия. Публикация заменит расписание выбранной недели.</p>
      <label className="block">Понедельник недели<input aria-label="Понедельник недели" className={field} type="date" value={week} disabled={busy} onChange={e=>{setWeek(e.target.value);setDraft(null);setDirty(true);setConfirmed(false)}} /></label>
      <PhotoInput disabled={busy} onFile={file => void select(file)} />
      {photo&&<>
        <p className="text-sm">Выделите таблицу ИС-942 двумя касаниями: левый верхний и правый нижний углы. Можно также задать координаты ниже.</p>
        <CropPreview preview={preview} photo={photo} region={region} disabled={busy} onChange={setRegion}/>
        <div className="grid grid-cols-2 gap-2">{(['left','top','width','height'] as const).map((key,i)=><label key={key}>{['Слева','Сверху','Ширина','Высота'][i]}<input className={field} type="number" min={key==='width'||key==='height'?1:0} value={region[key]} disabled={busy} onChange={e=>moveRegion(key,+e.target.value)}/></label>)}</div>
        <button className={button} disabled={busy} onClick={()=>void run(async()=>{const words=await recognize(photo,region,setMessage);setRecognizedText(ocrLines(words).map(line=>line.map(word=>word.text).join(' ')).join('\n'));const parsed=parseSchedule(words,week);change(parsed.lessons);setReview(parsed.review??[]);setWarnings(parsed.warnings);setMessage(`В редакторе: ${parsed.lessons.length}. Требуют проверки: ${parsed.review?.length??0}. Сверьте результат с фото.`)})}>Распознать выбранную область</button>
      </>}
      {message&&<p role="status" className="text-sm">{message}</p>}
      {warnings.length>0&&<ul className="list-disc pl-5 text-sm text-amber-300">{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}
      {recognizedText!==null&&<details className="rounded border border-line p-3"><summary className="cursor-pointer">Распознанный текст</summary><p className="my-2 text-sm text-dim">Неделя: {week}. Это исходный результат OCR до разбора занятий.</p><textarea aria-label="Распознанный текст" readOnly value={recognizedText || 'Текст не распознан. Уточните область или выберите более чёткое изображение.'} rows={12} className="w-full rounded bg-base p-2 text-sm text-ink"/></details>}
      {review.length>0&&<section className="space-y-3"><h3 className="font-semibold">Строки для проверки · {review.length}</h3><p className="text-sm text-dim">Для каждой строки выберите действие. При переносе заполните пустое время и исправьте текст в редакторе ниже.</p>{review.map((item,index)=><article key={index} className="space-y-2 rounded border border-line p-3"><p>{days[item.lesson.day_of_week-1]} · {item.lesson.subject_name}{item.lesson.subgroup ? ` · Подгруппа ${item.lesson.subgroup}` : ''}</p><p className="text-sm text-amber-300">{item.reason}</p><div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={()=>{change([...lessons,item.lesson]);setReview(review.filter((_,i)=>i!==index))}}>Перенести в редактор</button><button className="rounded border border-line px-3 py-2" disabled={busy} onClick={()=>{setReview(review.filter((_,i)=>i!==index));setDirty(true);setConfirmed(false)}}>Пропустить</button></div></article>)}</section>}
      {overlaps.length>0&&<p className="text-sm text-amber-300">Проверьте пересечения занятий: {overlaps.join('; ')}</p>}
      <p className="text-sm text-dim">Можно заполнить расписание вручную. Для пустой недели удалите все занятия и сохраните черновик.</p>
      {lessons.map((l,i)=><fieldset key={i} disabled={busy} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-3"><legend>Занятие {i+1}</legend>
        <label>День<select className={field} value={l.day_of_week} onChange={e=>update(i,{day_of_week:+e.target.value})}>{days.map((d,n)=><option key={d} value={n+1}>{d}</option>)}</select></label>
        <label>Подгруппа<select className={field} value={l.subgroup??''} onChange={e=>update(i,{subgroup:e.target.value?+e.target.value as 1|2:null})}><option value="">Общее занятие</option><option value="1">Первая</option><option value="2">Вторая</option></select></label>
        <label>Начало<input className={field} type="time" value={l.start_time} onChange={e=>update(i,{start_time:e.target.value})}/></label>
        <label>Окончание<input className={field} type="time" value={l.end_time??''} onChange={e=>update(i,{end_time:e.target.value||null})}/></label>
        <label className="col-span-2">Предмет<input className={field} maxLength={200} value={l.subject_name} onChange={e=>update(i,{subject_name:e.target.value})}/></label>
        <label>Кабинет<input className={field} value={l.classroom??''} onChange={e=>update(i,{classroom:e.target.value||null})}/></label>
        <label>Преподаватель<input className={field} value={l.teacher??''} onChange={e=>update(i,{teacher:e.target.value||null})}/></label>
        <button className="text-left text-sm text-red-300" onClick={()=>change(lessons.filter((_,n)=>n!==i))}>Удалить занятие</button>
      </fieldset>)}
      <button className={button} disabled={busy} onClick={()=>change([...lessons,blank()])}>Добавить занятие</button>
      {review.length>0&&<p className="text-sm text-amber-300">Перед сохранением перенесите в редактор или явно пропустите каждую строку для проверки.</p>}
      <button className={`${button} ml-2`} disabled={busy||!week||review.length>0} onClick={()=>void run(async()=>{if(review.length)throw new Error('Разберите строки для проверки.');if(mondayOf(week)!==week)throw new Error('Выберите понедельник.');if(lessons.some(l=>!l.start_time||!l.subject_name.trim()))throw new Error('Заполните время начала и предмет во всех занятиях.');const body=JSON.stringify({week_start:week,lessons:lessons.map((l,i)=>({...l,position:i}))});const result=await apiFetch<{id:string}>(draft?`/schedule/drafts/${draft}`:'/schedule/drafts',{method:draft?'PUT':'POST',headers:{'Content-Type':'application/json'},body});setDraft(result.id);setDirty(false);setMessage('Черновик сохранён. Проверьте данные и подтвердите публикацию.')})}>Сохранить черновик</button>
      {draft&&!dirty&&<div className="space-y-3 border-t border-line pt-3"><label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>Я сверил(а) все занятия и подтверждаю замену опубликованной недели</label><button className={button} disabled={busy||!confirmed} onClick={()=>void run(async()=>{await apiFetch(`/schedule/drafts/${draft}/publish`,{method:'POST'});setDraft(null);setConfirmed(false);setDirty(true);setMessage('Расписание опубликовано.');onPublished()})}>Опубликовать неделю</button></div>}
    </div>
  </details>
}
function CropPreview({preview,photo,region,disabled,onChange}:{preview:string;photo:HTMLCanvasElement;region:Region;disabled:boolean;onChange:(r:Region)=>void}) {
  const [anchor,setAnchor]=useState<{x:number;y:number}|null>(null)
  return <div className="relative touch-manipulation" onPointerDown={e=>{if(disabled)return;const b=e.currentTarget.getBoundingClientRect();const p={x:Math.round((e.clientX-b.left)/b.width*photo.width),y:Math.round((e.clientY-b.top)/b.height*photo.height)};if(!anchor){setAnchor(p)}else{onChange({left:Math.min(p.x,anchor.x),top:Math.min(p.y,anchor.y),width:Math.max(1,Math.abs(p.x-anchor.x)),height:Math.max(1,Math.abs(p.y-anchor.y))});setAnchor(null)}}}>
    <img src={preview} alt="Исходное расписание; рамка обозначает область распознавания" className="block w-full" draggable={false}/>
    <div className="pointer-events-none absolute border-2 border-violet-500 bg-violet-500/10" style={{left:`${region.left/photo.width*100}%`,top:`${region.top/photo.height*100}%`,width:`${region.width/photo.width*100}%`,height:`${region.height/photo.height*100}%`}}/>
    {anchor&&<span className="absolute left-0 top-0 bg-base p-1 text-sm">Теперь нажмите противоположный угол</span>}
  </div>
}
