import { tg } from './telegram'

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (tg?.initData) {
    headers.set('Authorization', `tma ${tg.initData}`)
  }
  const response = await fetch(`/api${path}`, { ...options, headers })
  if (!response.ok) {
    let code = `http_${response.status}`
    try {
      const data = (await response.json()) as { error?: unknown }
      if (typeof data.error === 'string') code = data.error
    } catch {
      // тело не JSON — оставляем код по статусу
    }
    throw new Error(code)
  }
  return response.json() as Promise<T>
}

function authHeaders(): Headers {
  const headers = new Headers()
  if (tg?.initData) headers.set('Authorization', `tma ${tg.initData}`)
  return headers
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`/api${path}`, { method: 'POST', headers: authHeaders(), body: form })
  if (!response.ok) {
    let code = `http_${response.status}`
    try {
      const data = (await response.json()) as { error?: unknown }
      if (typeof data.error === 'string') code = data.error
    } catch {
      // тело не JSON
    }
    throw new Error(code)
  }
  return response.json() as Promise<T>
}

export async function apiDownload(path: string, fileName: string): Promise<void> {
  const response = await fetch(`/api${path}`, { headers: authHeaders() })
  if (!response.ok) {
    let code = `http_${response.status}`
    try {
      const data = (await response.json()) as { error?: unknown }
      if (typeof data.error === 'string') code = data.error
    } catch {
      // тело не JSON
    }
    throw new Error(code)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}