import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import { BoardPage } from './pages/Board'
import { BookPage } from './pages/Book'
import { CalendarPage } from './pages/Calendar'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { PostPage } from './pages/Post'
import { useMe } from './auth'

export function App() {
  const me = useMe()
  if (me.isPending) return <Loading />
  if (me.isError) return <p className="p-8 text-center text-alert">Could not reach the server: {me.error.message}</p>
  if (!me.data) return <Login />
  const user = me.data
  return (
    <Routes>
      <Route element={<Layout user={user} />}>
        <Route index element={<Dashboard user={user} />} />
        <Route path="calendar" element={<CalendarPage user={user} />} />
        <Route path="book" element={<BookPage />} />
        <Route path="board" element={<BoardPage />} />
        <Route path="board/:id" element={<PostPage user={user} />} />
        <Route path="*" element={<p className="text-muted">Page not found.</p>} />
      </Route>
    </Routes>
  )
}
