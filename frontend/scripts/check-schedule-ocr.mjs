// Local diagnostics only. Source images and results stay in the ignored samples.local folder.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker, PSM } from 'tesseract.js'

const args = process.argv.slice(2)
if (!args.length || args.includes('--help')) {
  console.log('Usage: node scripts/check-schedule-ocr.mjs IMAGE [LEFT TOP WIDTH HEIGHT]')
  process.exit(args.includes('--help') ? 0 : 1)
}
if (![1,5].includes(args.length)) throw new Error('Supply an image and optionally four rectangle coordinates.')
const imagePath = path.resolve(args[0])
const root = fileURLToPath(new URL('../../', import.meta.url))
const output = path.join(root, 'samples.local', 'ocr-results')
const langPath = fileURLToPath(new URL('../public/ocr/lang/', import.meta.url))
const rectangle = args.length === 5 ? {
  left: Number(args[1]), top: Number(args[2]), width: Number(args[3]), height: Number(args[4]),
} : undefined
if (rectangle && (!Object.values(rectangle).every(Number.isInteger) || rectangle.left<0 || rectangle.top<0 || rectangle.width<1 || rectangle.height<1)) {
  throw new Error('Rectangle coordinates must be integers within the image.')
}
const image = await readFile(imagePath)
await mkdir(output,{recursive:true})
const worker = await createWorker(['rus','eng'],1,{langPath,cacheMethod:'none'})
try {
  const cases = [
    {name:'table-auto',psm:PSM.AUTO,rectangle,whitelist:''},
    ...(rectangle ? [
      {name:'time-column-sparse',psm:PSM.SPARSE_TEXT,rectangle:{...rectangle,width:Math.min(45,rectangle.width)},whitelist:'0123456789:.-'},
      {name:'time-column-block',psm:PSM.SINGLE_BLOCK,rectangle:{...rectangle,width:Math.min(45,rectangle.width)},whitelist:'0123456789:.-'},
    ] : []),
  ]
  for (const variant of cases) {
    await worker.setParameters({tessedit_pageseg_mode:variant.psm,tessedit_char_whitelist:variant.whitelist,preserve_interword_spaces:'1'})
    const {data} = await worker.recognize(image,variant.rectangle ? {rectangle:variant.rectangle} : {},{text:true,blocks:true})
    await writeFile(path.join(output,`${variant.name}.txt`),data.text,'utf8')
    await writeFile(path.join(output,`${variant.name}.json`),JSON.stringify({confidence:data.confidence,text:data.text,blocks:data.blocks},null,2),'utf8')
    console.log(`${variant.name}: confidence=${data.confidence}, characters=${data.text.length}`)
  }
  console.log(`Results: ${output}`)
} finally { await worker.terminate() }
