import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { api } from '../api/client'
import { can, type CommunityEvent, type EventKind, type User } from '../api/types'
import { Badge, Button, ErrorText, Field, inputClass, Modal } from '../components/ui'
import { buildingClock, fromBuildingInput, toBuildingInput } from '../calendarZone'
import { fmt } from '../format'

const COLORS: Record<EventKind, string> = { community: '#3f6b4f', maintenance: '#b7791f' }


export function CalendarPage({ user }: { user: User }) {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [selected, setSelected] = useState<CommunityEvent | null>(null)
  const [draftStart, setDraftStart] = useState<Date | null>(null)
  const events = useQuery({
    queryKey: ['events', range],
    queryFn: () => api.events(range!.from, range!.to),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Calendar</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone="moss">Community</Badge> <Badge tone="lamp">Maintenance</Badge>
            {can.manageEvents(user) && <span>Click a day to add an event.</span>}
          </p>
        </div>
        {can.manageEvents(user) && <Button onClick={() => setDraftStart(nextHour())}>+ New event</Button>}
      </div>
      <ErrorText error={events.error} />
      <div className="rounded-xl border border-line bg-white p-3 shadow-sm">
        <FullCalendar
          plugins={[buildingClock.luxonPlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
          timeZone={buildingClock.timeZone}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
          height="auto"
          events={(events.data ?? []).map((e) => ({
            id: String(e.id),
            title: e.title,
            start: e.startsAt,
            end: e.endsAt,
            backgroundColor: COLORS[e.kind],
            classNames: e.status === 'canceled' ? ['ev-canceled'] : [],
            extendedProps: { event: e },
          }))}
          datesSet={(arg: DatesSetArg) => setRange({ from: arg.start.toISOString(), to: arg.end.toISOString() })}
          eventClick={(arg: EventClickArg) => setSelected(arg.event.extendedProps.event as CommunityEvent)}
          dateClick={(arg: DateClickArg) => {
            if (!can.manageEvents(user)) return
            const d = new Date(arg.date)
            if (arg.allDay) d.setHours(18)
            setDraftStart(d)
          }}
        />
      </div>
      <EventDetails user={user} event={selected} onClose={() => setSelected(null)} />
      <NewEvent user={user} start={draftStart} onClose={() => setDraftStart(null)} />
    </div>
  )
}

function nextHour() {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return d
}

function EventDetails({ user, event, onClose }: { user: User; event: CommunityEvent | null; onClose: () => void }) {
  const qc = useQueryClient()
  const cancel = useMutation({
    mutationFn: (id: number) => api.cancelEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
  })
  return (
    <Modal open={event !== null} onClose={onClose} title={event?.title ?? ''}>
      {event && (
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            <Badge tone={event.kind === 'maintenance' ? 'lamp' : 'moss'}>{event.kind === 'maintenance' ? 'Maintenance' : 'Community'}</Badge>
            {event.status === 'canceled' && <Badge tone="alert">Canceled</Badge>}
          </div>
          <p>
            <strong>When:</strong> {fmt.range(event.startsAt, event.endsAt)}
          </p>
          {event.location && (
            <p>
              <strong>Where:</strong> {event.location}
            </p>
          )}
          {event.description && <p className="text-ink/80">{event.description}</p>}
          <ErrorText error={cancel.error} />
          {can.manageEvents(user) && event.status === 'scheduled' && (event.kind === 'community' || can.scheduleMaintenance(user)) && (
            <div className="flex justify-end">
              <Button variant="danger" onClick={() => cancel.mutate(event.id)} disabled={cancel.isPending}>
                Cancel this event
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function NewEvent({ user, start, onClose }: { user: User; start: Date | null; onClose: () => void }) {
  return (
    <Modal open={start !== null} onClose={onClose} title="New event">
      {start && <NewEventForm key={start.getTime()} user={user} start={start} onDone={onClose} />}
    </Modal>
  )
}

function NewEventForm({ user, start, onDone }: { user: User; start: Date; onDone: () => void }) {
  const qc = useQueryClient()
  const [kind, setKind] = useState<EventKind>('community')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('Clubhouse')
  const [description, setDescription] = useState('')
  const [from, setFrom] = useState(toBuildingInput(start))
  const [to, setTo] = useState(toBuildingInput(new Date(start.getTime() + 2 * 3_600_000)))
  const create = useMutation({
    mutationFn: () =>
      api.createEvent({ kind, title, location, description, startsAt: fromBuildingInput(from).toISOString(), endsAt: fromBuildingInput(to).toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onDone()
    },
  })
  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        create.mutate()
      }}
    >
      <Field label="Type">
        <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
          <option value="community">Community event</option>
          {can.scheduleMaintenance(user) && <option value="maintenance">Building maintenance</option>}
        </select>
      </Field>
      <Field label="Title">
        <input className={inputClass} required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">
          <input className={inputClass} type="datetime-local" required value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Ends">
          <input className={inputClass} type="datetime-local" required value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Field label="Where">
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <Field label="Details">
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <ErrorText error={create.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Add to calendar
        </Button>
      </div>
    </form>
  )
}
