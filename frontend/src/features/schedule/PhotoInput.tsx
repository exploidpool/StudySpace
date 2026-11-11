import { useRef, useState } from 'react'

interface Props {
  disabled: boolean
  onFile: (file: File) => void
}

export function PhotoInput({ disabled, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const pasteTarget = useRef<HTMLTextAreaElement>(null)
  const [hint, setHint] = useState('')

  function accept(file: File | undefined) {
    if (disabled) return
    if (!file) {
      setHint('Скопируйте само изображение, а не ссылку или текст, и вставьте сюда.')
      return
    }
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setHint('Нужен файл PNG или JPG. Сохраните изображение в одном из этих форматов.')
      return
    }
    setHint(`Выбрано: ${file.name}`)
    onFile(file)
  }

  function chooseFile() {
    setHint('Если окно выбора не открылось, используйте вставку изображения ниже или перетащите файл.')
    // Keep the native picker call inside the direct click gesture (WebView requirement).
    try {
      if (input.current?.showPicker) input.current.showPicker()
      else input.current?.click()
    } catch {
      input.current?.click()
    }
  }

  async function readClipboard() {
    setHint('')
    if (!navigator.clipboard?.read) {
      setHint('Нажмите поле ниже и вставьте скопированное изображение через Ctrl+V (на Mac — ⌘V).')
      pasteTarget.current?.focus()
      return
    }
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find(value => value === 'image/png' || value === 'image/jpeg')
        if (type) {
          const blob = await item.getType(type)
          accept(new File([blob], `clipboard.${type === 'image/png' ? 'png' : 'jpg'}`, { type }))
          return
        }
      }
      accept(undefined)
    } catch {
      setHint('Чтение буфера недоступно. Нажмите поле ниже и вставьте изображение через Ctrl+V (на Mac — ⌘V).')
      pasteTarget.current?.focus()
    }
  }

  return <section className="space-y-3 rounded-lg border border-line p-3"
    aria-label="Фото расписания"
    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy' }}
    onDrop={event => { event.preventDefault(); if (!disabled) accept(event.dataTransfer.files[0]) }}>
    <p className="font-medium">Фото или скриншот PNG/JPG</p>
    <input ref={input} type="file" accept="image/png,image/jpeg" className="sr-only" tabIndex={-1}
      aria-label="Файл расписания" disabled={disabled}
      onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) accept(file) }} />
    <div className="flex flex-wrap gap-2">
      <button type="button" className="rounded bg-accent px-3 py-2 text-white disabled:opacity-40" disabled={disabled} onClick={chooseFile}>Выбрать фото</button>
      <button type="button" className="rounded border border-line bg-raised px-3 py-2 disabled:opacity-40" disabled={disabled} onClick={() => void readClipboard()}>Вставить из буфера</button>
    </div>
    <label className="block text-sm text-dim">Или скопируйте изображение и вставьте в это поле
      <textarea ref={pasteTarget} rows={2} value="" onChange={() => {}} disabled={disabled}
        aria-label="Вставка изображения расписания"
        placeholder="Нажмите здесь и вставьте фото: Ctrl+V / ⌘V"
        className="mt-2 w-full resize-none rounded border border-line bg-base p-2 text-ink"
        onPaste={event => { event.preventDefault(); if (!disabled) accept(event.clipboardData.files[0]) }} />
    </label>
    <p className="text-sm text-dim">Также можно перетащить сюда PNG/JPG с компьютера.</p>
    {hint && <p role="status" className="break-words text-sm">{hint}</p>}
  </section>
}
