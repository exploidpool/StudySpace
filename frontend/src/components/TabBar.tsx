import { AppIcon, type IconName } from './AppIcon'

export type TabId = 'home' | 'schedule' | 'tasks' | 'materials' | 'profile'

const tabs: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'schedule', label: 'Расписание', icon: 'calendar' },
  { id: 'tasks', label: 'Задания', icon: 'tasks' },
  { id: 'materials', label: 'Материалы', icon: 'folder' },
  { id: 'profile', label: 'Профиль', icon: 'profile' },
]

export function TabBar({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav
      className="app-tab-bar ui-surface fixed z-20 max-w-[30.5rem] rounded-card bg-raised/95 p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.38)] backdrop-blur-xl"
      style={{ bottom: 'calc(0.75rem + var(--app-safe-bottom))' }}
      aria-label="Основные разделы"
    >
      <div className="grid grid-cols-5 gap-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-current={active === t.id ? 'page' : undefined}
            className={`ui-press flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-inner px-0.5 py-2 font-medium ${
              active === t.id ? 'bg-accent text-accent-ink' : 'text-dim'
            }`}
          >
            <AppIcon name={t.icon} className="h-5 w-5" />
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
