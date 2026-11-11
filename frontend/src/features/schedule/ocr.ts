import { createWorker, PSM } from 'tesseract.js'
import type { OcrWord, Region } from './importModel'
import { removeTableLines } from './imagePreprocess'
export async function recognize(image: HTMLCanvasElement, region: Region | undefined, progress: (text: string)=>void): Promise<OcrWord[]> {
  let source = image
  if (region) {
    // Crop before deskewing so rotation cannot move the selected rectangle.
    const left = Math.max(0, Math.round(region.left)), top = Math.max(0, Math.round(region.top))
    const width = Math.min(Math.round(region.width), image.width - left)
    const height = Math.min(Math.round(region.height), image.height - top)
    if (width < 1 || height < 1) throw new Error('Выберите область внутри изображения.')
    const scale = Math.min(3, 1200 / width, Math.sqrt(24000000 / (width * height)))
    source = document.createElement('canvas')
    source.width = Math.max(1, Math.round(width * scale)); source.height = Math.max(1, Math.round(height * scale))
    const context = source.getContext('2d')!
    context.fillStyle = '#fff'; context.fillRect(0, 0, source.width, source.height)
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high'
    context.drawImage(image, left, top, width, height, 0, 0, source.width, source.height)
    const pixels=context.getImageData(0,0,source.width,source.height)
    pixels.data.set(removeTableLines(pixels.data,source.width,source.height))
    context.putImageData(pixels,0,0)
  }
  const worker = await createWorker(['rus','eng'], 1, {
    workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath:'/ocr/lang',
    logger: m => progress(`${m.status}: ${Math.round((m.progress ?? 0)*100)}%`),
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: region ? PSM.SPARSE_TEXT : PSM.AUTO, preserve_interword_spaces:'1' })
    const {data} = await worker.recognize(source, {rotateAuto:!!region}, {blocks:true,text:true})
    return (data.blocks ?? []).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words.map(w=>({text:w.text,confidence:w.confidence,bbox:w.bbox})))))
  } finally { await worker.terminate() }
}
export async function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  if(!['image/png','image/jpeg'].includes(file.type)) throw new Error('Выберите PNG или JPG.')
  if(file.size>15*1024*1024) throw new Error('Фото больше 15 МБ. Уменьшите файл.')
  const bitmap = await createImageBitmap(file)
  try {
    if(bitmap.width*bitmap.height>24000000) throw new Error('Фото больше 24 мегапикселей. Уменьшите разрешение.')
    if(Math.min(bitmap.width,bitmap.height)<400) throw new Error('Слишком маленькое изображение: нужно не менее 400 пикселей по короткой стороне.')
    const scale=Math.min(1,3000/Math.max(bitmap.width,bitmap.height))
    const canvas=document.createElement('canvas')
    canvas.width=Math.round(bitmap.width*scale); canvas.height=Math.round(bitmap.height*scale)
    canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height)
    return canvas
  } finally { bitmap.close() }
}
