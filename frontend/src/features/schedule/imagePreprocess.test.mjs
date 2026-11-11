import { test } from 'node:test'
import assert from 'node:assert/strict'
import { removeTableLines } from './imagePreprocess.ts'

test('removes long horizontal/vertical rules, retains short glyphs and the source pixels',()=>{
  const width=100,height=100,pixels=new Uint8ClampedArray(width*height*4).fill(255)
  const black=(x,y)=>{const i=(y*width+x)*4; pixels[i]=pixels[i+1]=pixels[i+2]=0}
  for(let x=0;x<width;x++)black(x,20)
  for(let y=0;y<height;y++)black(30,y)
  for(let y=60;y<68;y++)black(60,y)
  const result=removeTableLines(pixels,width,height)
  assert.equal(result[(20*width+80)*4],255)
  assert.equal(result[(80*width+30)*4],255)
  assert.equal(result[(63*width+60)*4],0)
  assert.equal(pixels[(20*width+80)*4],0)
  assert.equal(result[(63*width+60)*4+3],255)
})
