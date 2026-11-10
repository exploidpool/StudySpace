import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../services/api'
import type { Subject } from '../types/api'

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    try {
      setSubjects(await apiFetch<Subject[]>('/subjects'))
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { subjects, error, reload }
}