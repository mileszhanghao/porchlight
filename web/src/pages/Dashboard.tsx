import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import { type Announcement, type AnnouncementKind, can, CATEGORY_LABEL, type User } from '../api/types'
import { Badge, Button, Card, Empty, ErrorText, Field, inputClass, Loading, Modal, SectionTitle } from '../components/ui'
import { fmt } from '../format'

const KIND_LABEL: Record<AnnouncementKind, string> = { news: 'News', alert: 'Alert', newsletter: 'Newsletter', policy: 'Policy' }

export function Dashboard({ user }: { user: User }) {
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const [composing, setComposing] = useState(false)
  if (dash.isPending) return <Loading />
  if (dash.isError) return <ErrorText error={dash.error} />
  const d = dash.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Good to see you, {user.name.split(' ')[0]}</h1>
        <p className="text-muted">Here’s what’s happening around Larkspur Court.</p>
      </div>

      {d.alerts.map((a) => (
        <div key={a.id} role="alert" className="flex gap-3 rounded-xl border border-alert/30 bg-alert-soft p-4 text-alert">
          <span aria-hidden className="text-xl leading-none">⚠</span>
          <div>
            <p className="font-semibold">{a.title}</p>
            <p className="text-sm text-ink/80">{a.body}</p>
            {a.expiresAt && <p className="mt-1 text-xs text-ink/60">Until {fmt.dayTime(a.expiresAt)}</p>}
          </div>
        </div>
      ))}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionTitle
              action={
                can.postAnnouncements(user) && (
                  <Button variant="secondary" onClick={() => setComposing(true)}>
                    + Post a notice
                  </Button>
                )
              }
            >
              Notices
            </SectionTitle>
            {d.news.length === 0 ? (
              <Empty>No notices right now.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {d.news.map((n) => (
                  <Notice key={n.id} n={n} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle action={<Link to="/calendar" className="text-sm font-medium text-night underline">Full calendar</Link>}>
              The next 7 days
            </SectionTitle>
            {d.upcoming.length === 0 ? (
              <Empty>Nothing scheduled this week.</Empty>
            ) : (
              <ul className="space-y-2">
                {d.upcoming.map((e) => (
                  <li key={e.id} className={`flex gap-3 rounded-lg border border-line p-3 ${e.status === 'canceled' ? 'opacity-60' : ''}`}>
                    <div className="w-24 shrink-0 text-sm">
                      <p className="font-semibold">{fmt.day(e.startsAt)}</p>
                      <p className="text-muted">{fmt.time(e.startsAt)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium ${e.status === 'canceled' ? 'line-through' : ''}`}>{e.title}</p>
                      <p className="text-sm text-muted">
                        {e.location}
                        {e.description && ` · ${e.description}`}
                      </p>
                    </div>
                    <div className="ml-auto shrink-0">
                      {e.status === 'canceled' ? (
                        <Badge tone="alert">Canceled</Badge>
                      ) : (
                        <Badge tone={e.kind === 'maintenance' ? 'lamp' : 'moss'}>{e.kind === 'maintenance' ? 'Maintenance' : 'Community'}</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle action={<Link to="/book" className="text-sm font-medium text-night underline">Book</Link>}>My bookings</SectionTitle>
            {d.myBookings.length === 0 ? (
              <Empty>No upcoming bookings.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {d.myBookings.map((b) => (
                  <li key={b.id} className="rounded-lg bg-paper p-3">
                    <p className="font-semibold">{b.amenityName}</p>
                    <p className="text-muted">{fmt.range(b.startsAt, b.endsAt)}</p>
                    {b.note && <p className="text-muted">“{b.note}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <SectionTitle action={<Link to="/board" className="text-sm font-medium text-night underline">Board</Link>}>On the board</SectionTitle>
            <ul className="space-y-3 text-sm">
              {d.latestPosts.map((p) => (
                <li key={p.id}>
                  <Link to={`/board/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-muted">
                    {CATEGORY_LABEL[p.category]} · {p.authorName} · {fmt.ago(p.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <ComposeNotice user={user} open={composing} onClose={() => setComposing(false)} />
    </div>
  )
}

function Notice({ n }: { n: Announcement }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        {n.pinned && <Badge tone="lamp">Pinned</Badge>}
        <Badge>{KIND_LABEL[n.kind]}</Badge>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="text-left font-medium hover:underline">
          {n.title}
        </button>
      </div>
      {open && <p className="mt-2 whitespace-pre-line text-sm text-ink/80">{n.body}</p>}
      <p className="mt-1 text-xs text-muted">
        {n.authorName} · {fmt.ago(n.createdAt)}
      </p>
    </li>
  )
}

function ComposeNotice({ user, open, onClose }: { user: User; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [kind, setKind] = useState<AnnouncementKind>('news')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [until, setUntil] = useState('')
  const create = useMutation({
    mutationFn: () => api.createAnnouncement({ kind, title, body, pinned, expiresAt: until ? new Date(until).toISOString() : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setTitle('')
      setBody('')
      onClose()
    },
  })
  const kinds: AnnouncementKind[] = can.postAlerts(user) ? ['news', 'newsletter', 'policy', 'alert'] : ['news', 'newsletter', 'policy']
  return (
    <Modal open={open} onClose={onClose} title="Post a notice">
      <form
        className="space-y-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <Field label="Type" hint={kind === 'alert' ? 'Alerts show in red at the top of everyone’s home page.' : undefined}>
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as AnnouncementKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input className={inputClass} required minLength={3} maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Message">
          <textarea className={inputClass} rows={4} required value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {kind === 'alert' ? (
          <Field label="Show until">
            <input className={inputClass} type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
          </Field>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to the top
          </label>
        )}
        <ErrorText error={create.error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Post
          </Button>
        </div>
      </form>
    </Modal>
  )
}
