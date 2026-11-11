import { useEffect, useState } from 'react'
import { apiFetch } from '../services/api'
import { isTelegram } from '../services/telegram'

export function useSchedule<T>(path: string, revision = 0) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({ data: null, loading: isTelegram, error: false })
  useEffect(() => {
    if (!isTelegram) return
    let cancelled = false
    setState({ data: null, loading: true, error: false })
    apiFetch<T>(path).then(data => {
      if (!cancelled) setState({ data, loading: false, error: false })
    }).catch(() => {
      if (!cancelled) setState({ data: null, loading: false, error: true })
    })
    return () => { cancelled = true }
  }, [path, revision])
  return state
}
