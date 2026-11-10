import { tg } from './telegram'

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (tg?.initData) {
    headers.set('Authorization', `tma ${tg.initData}`)
  }
  const response = await fetch(`/api${path}`, { ...options, headers })
  if (!response.ok) {
    throw new Error(`API error ${response.status}`)
  }
  return response.json() as Promise<T>
}