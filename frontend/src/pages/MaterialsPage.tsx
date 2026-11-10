import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { SubjectsPage } from './SubjectsPage'
import { NotesPage } from './NotesPage'
import { FilesPage } from './FilesPage'
import { LibraryPage } from './LibraryPage'

type Section = 'subjects' | 'notes' | 'files' | 'library' | 'groups'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'subjects', label: 'Предметы' },
  { id: 'notes', label: 'Конспекты' },
  { id: 'files', label: 'Файлы' },
  { id: 'library', label: 'Библиотека' },
  { id: 'groups', label: 'Группы' },
]

export function MaterialsPage() {
  const [section, setSection] = useState<Section>('subjects')

  return (
    <div>
      <PageHeader title="Материалы" subtitle="Предметы, конспекты и файлы" />
      <div className="mb-5 flex gap-1 overflow-x-auto">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm ${section === id ? 'bg-accent/20 font-semibold text-accent' : 'text-dim'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {section === 'subjects' && <SubjectsPage />}
      {section === 'notes' && <NotesPage />}
      {section === 'files' && <FilesPage />}
      {section === 'library' && <LibraryPage />}
      {section === 'groups' && (
        <EmptyState title="Групповые материалы">Материалы учебных групп появятся на Этапе 5.</EmptyState>
      )}
    </div>
  )
}