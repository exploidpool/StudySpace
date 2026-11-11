import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
const expect=value=>({toBe:expected=>assert.equal(value,expected),toBeNull:()=>assert.equal(value,null),toEqual:expected=>assert.deepEqual(value,expected),toHaveLength:length=>assert.equal(value.length,length),toMatchObject:expected=>{for(const key in expected)assert.deepEqual(value[key],expected[key])}})
import { detectRegion, normalizeGroup, parseSchedule } from './importModel.ts'

const word=(text,x0,y0,confidence=90)=>({text,confidence,bbox:{x0,y0,x1:x0+35,y1:y0+10}})
describe('schedule import safeguards',()=>{
 it('normalizes mixed script and dash',()=>expect(normalizeGroup('ИC — 942')).toBe('ИС942'))
 it('does not choose another group or ambiguous match',()=>{
   expect(detectRegion([word('ИС-943',100,0)],600,1000)).toBeNull()
   expect(detectRegion([word('ИС-942',100,0),word('ИС-942',300,0)],600,1000)).toBeNull()
 })
 it('never invents days without date boundaries',()=>expect(parseSchedule([word('КОМП.СЕТИ',80,10)],'2026-11-02').lessons).toEqual([]))
 it('splits subgroup lessons and keeps Saturday times from source',()=>{
   const words=[]
   for(let d=0;d<6;d++){
     const y=d*100
     words.push(word(d===5?'12:00-':'08:30-',0,y),word(d===5?'13:35':'10:05',0,y+15),word('ОС.ПРОЕКТ/---',80,y+5),word(`0${d+2}.11.2026`,80,y+75))
   }
   const result=parseSchedule(words,'2026-11-02')
   expect(result.lessons).toHaveLength(6)
   expect(result.lessons[5]).toMatchObject({day_of_week:6,start_time:'12:00',end_time:'13:35',subgroup:1})
 })
 it('low confidence rows require manual input',()=>{
   const words=Array.from({length:6},(_,d)=>[word('08:30',0,d*100),word('10:05',0,d*100+15),word('НЕЯСНО',80,d*100+5,20),word(`0${d+2}.11.2026`,80,d*100+75)]).flat()
   expect(parseSchedule(words,'2026-11-02').lessons).toEqual([])
 })
 it('joins date fragments on a single line',()=>{
   const words=[]
   for(let d=0;d<6;d++) {
     const y=d*100
     words.push(word('08:30',0,y),word('10:05',0,y+15),word('АЛГЕБРА',80,y+5),word(`0${d+2}.`,80,y+75),word('11.',120,y+75),word('2026',160,y+75))
   }
   assert.equal(parseSchedule(words,'2026-11-02').lessons.length,6)
 })
 it('keeps unambiguous days when a middle date is missing without shifting lessons',()=>{
   const words=[]
   for(let d=0;d<6;d++) {
     const y=d*100
     words.push(word('08:30',0,y),word('10:05',0,y+15),word('АЛГЕБРА',80,y+5))
     if(d!==2) words.push(word(`0${d+2}.11.2026`,80,y+75))
   }
   assert.deepEqual(parseSchedule(words,'2026-11-02').lessons.map(l=>l.day_of_week),[1,2,5,6])
 })
 it('rejects repeated day boundaries from multiple group columns',()=>{
   const words=[word('02.11.2026',80,75),word('02.11.2026',280,77),word('03.11.2026',80,175)]
   const result=parseSchedule(words,'2026-11-02')
   assert.equal(result.lessons.length,0)
   assert.match(result.warnings[0],/повторяются/)
 })
 it('rejects dates from another week',()=>{
   const result=parseSchedule([word('09.11.2026',80,75)],'2026-11-02')
   assert.equal(result.lessons.length,0)
   assert.match(result.warnings[0],/2026-11-02/)
 })
 it('does not shift clock pairs when the first clock is unreadable',()=>{
   const result=parseSchedule([
     word('£30-',0,0),word('10:05',0,15),word('КУРС А',80,5),
     word('10:15',0,35),word('11:50',0,50),word('КУРС Б',80,40),word('02.11.2026',80,80),
   ],'2026-11-02')
   assert.deepEqual(result.lessons.map(l=>[l.start_time,l.end_time,l.subject_name]),[['10:15','11:50','КУРС Б']])
   assert.ok(result.warnings.some(w=>w.includes('£30-')))
   assert.equal(result.review.length,1)
   assert.equal(result.review[0].lesson.start_time,'')
   assert.equal(result.review[0].lesson.subject_name,'КУРС А')
 })
 it('does not join clocks across missing tokens from different lesson rows',()=>{
   const result=parseSchedule([
     word('08:30',0,0),word('КУРС А',80,5),word('11:50',0,50),
     word('12:30',0,70),word('14:05',0,85),word('КУРС Б',80,75),word('02.11.2026',80,115),
   ],'2026-11-02')
   assert.deepEqual(result.lessons.map(l=>l.start_time),['12:30'])
 })
})
