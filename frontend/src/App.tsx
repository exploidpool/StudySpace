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
    <div className="mx-auto min-h-full max-w-lg px-4 pb-24 pt-6">
      {pages[tab]}
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}