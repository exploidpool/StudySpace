import { useEffect, useState, type ReactNode } from 'react'
import { TabBar, type TabId } from './components/TabBar'
import { HomePage } from './pages/HomePage'
import { SchedulePage } from './pages/SchedulePage'
import { TasksPage } from './pages/TasksPage'
import { MaterialsPage } from './pages/MaterialsPage'
import { ProfilePage } from './pages/ProfilePage'
import { initTelegram } from './services/telegram'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')

  useEffect(() => {
    initTelegram()
  }, [])

  const pages: Record<TabId, ReactNode> = {
    home: <HomePage />,
    schedule: <SchedulePage />,
    tasks: <TasksPage />,
    materials: <MaterialsPage />,
    profile: <ProfilePage />,
  }

  return (
    <div className="app-shell mx-auto max-w-lg">
      <main key={tab} className="page-enter">
        {pages[tab]}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
