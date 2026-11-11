import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root=path.dirname(fileURLToPath(import.meta.url))
const target=path.join(root,'public','ocr')
await mkdir(path.join(target,'core'),{recursive:true})
await mkdir(path.join(target,'lang'),{recursive:true})
await copyFile(path.join(root,'node_modules/tesseract.js/dist/worker.min.js'),path.join(target,'worker.min.js'))
for(const name of await readdir(path.join(root,'node_modules/tesseract.js-core'))) {
  if(name.endsWith('.wasm') || name.endsWith('.wasm.js')) await copyFile(path.join(root,'node_modules/tesseract.js-core',name),path.join(target,'core',name))
}
for(const language of ['rus','eng']) {
  await copyFile(path.join(root,'node_modules/@tesseract.js-data',language,'4.0.0_best_int',`${language}.traineddata.gz`),path.join(target,'lang',`${language}.traineddata.gz`))
}
console.log('Local OCR assets prepared in public/ocr')
