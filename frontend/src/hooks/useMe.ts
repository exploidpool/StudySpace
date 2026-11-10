import { useEffect, useState } from 'react'
import { apiFetch } from '../services/api'
import { isTelegram } from '../services/telegram'
import type { MeResponse } from '../types/api'

interface MeState {
  data: MeResponse | null
  loading: boolean
  error: boolean
}

export function useMe(): MeState {
  const [state, setState] = useState<MeState>({ data: null, loading: isTelegram, error: false })

  useEffect(() => {
    if (!isTelegram) return
    let cancelled = false
    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: false })
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}