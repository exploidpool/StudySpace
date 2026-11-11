// Remove long table rules while retaining short letter/digit strokes.
export function removeTableLines(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(pixels)
  const dark = new Uint8Array(width * height)
  const mask = new Uint8Array(width * height)
  for (let i=0; i<dark.length; i++) dark[i] = (pixels[i*4]+pixels[i*4+1]+pixels[i*4+2])/3 < 170 ? 1 : 0
  function scan(horizontal: boolean) {
    const major = horizontal ? height : width, minor = horizontal ? width : height
    const minimum = horizontal ? Math.max(45, Math.round(width*0.1)) : Math.max(60, Math.round(height*0.025))
    const index = (line: number, position: number) => horizontal ? line*width+position : position*width+line
    for (let line=0;line<major;line++) {
      let start=-1,last=-1
      function flush() {
        if(start>=0 && last-start+1>=minimum) {
          for(let pos=start;pos<=last;pos++) {
            for(let delta=-1;delta<=1;delta++) if(line+delta>=0 && line+delta<major) mask[index(line+delta,pos)]=1
          }
        }
        start=-1;last=-1
      }
      for(let pos=0;pos<minor;pos++) {
        if(dark[index(line,pos)]) {if(start<0)start=pos;last=pos}
        else if(start>=0 && pos-last>2) flush()
      }
      flush()
    }
  }
  scan(true);scan(false)
  for(let i=0;i<mask.length;i++) if(mask[i]) {output[i*4]=255;output[i*4+1]=255;output[i*4+2]=255}
  return output
}
