import type { DateSelectArg, DatesSetArg } from '@fullcalendar/core'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Amenity } from '../api/types'
import { Button, Card, Empty, ErrorText, Field, inputClass, Loading, Modal, SectionTitle } from '../components/ui'
import { fmt } from '../format'

const pad = (h: number) => `${String(h).padStart(2, '0')}:00:00`

export function BookPage() {
  const amenities = useQuery({ queryKey: ['amenities'], queryFn: api.amenities })
  const [amenityId, setAmenityId] = useState<number | null>(null)
  if (amenities.isPending) return <Loading />
  if (amenities.isError) return <ErrorText error={amenities.error} />
  const amenity = amenities.data.find((a) => a.id === amenityId) ?? amenities.data[0]!

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Book a room</h1>
        <p className="text-muted">Drag across free time on the calendar to request it. Bookings are first come, first served.</p>
      </div>
      <div role="tablist" aria-label="Rooms" className="grid gap-3 sm:grid-cols-3">
        {amenities.data.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={a.id === amenity.id}
            onClick={() => setAmenityId(a.id)}
            className={`rounded-xl border p-4 text-left transition ${a.id === amenity.id ? 'border-night bg-white shadow-sm ring-2 ring-lamp/40' : 'border-line bg-white/60 hover:bg-white'}`}
          >
            <p className="font-serif text-lg font-semibold">{a.name}</p>
            <p className="text-sm text-muted">{a.description}</p>
            <p className="mt-2 text-xs text-muted">
              Up to {a.capacity} people · {a.openHour}:00–{a.closeHour}:00 · max {a.maxHours} h
            </p>
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RoomCalendar key={amenity.id} amenity={amenity} />
        </div>
        <MyBookings />
      </div>
    </div>
  )
}

function RoomCalendar({ amenity }: { amenity: Amenity }) {
  const qc = useQueryClient()
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [draft, setDraft] = useState<{ start: Date; end: Date } | null>(null)
  const [note, setNote] = useState('')
  const schedule = useQuery({
    queryKey: ['schedule', amenity.id, range],
    queryFn: () => api.schedule(amenity.id, range!.from, range!.to),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  })
  const book = useMutation({
    mutationFn: () => api.book({ amenityId: amenity.id, startsAt: draft!.start.toISOString(), endsAt: draft!.end.toISOString(), note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      qc.invalidateQueries({ queryKey: ['myBookings'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDraft(null)
      setNote('')
    },
    // A 409 means someone else got there first: refresh so the slot shows as taken.
    onError: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  })

  return (
    <div className="rounded-xl border border-line bg-white p-3 shadow-sm">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
        allDaySlot={false}
        height="auto"
        slotMinTime={pad(amenity.openHour)}
        slotMaxTime={pad(amenity.closeHour)}
        snapDuration="00:30:00"
        selectable
        selectMirror
        selectOverlap={false}
        selectAllow={(s) => s.start >= new Date() && s.end.getTime() - s.start.getTime() <= amenity.maxHours * 3_600_000}
        events={(schedule.data ?? []).map((b) => ({
          id: String(b.id),
          start: b.startsAt,
          end: b.endsAt,
          title: b.mine ? `Yours${b.note ? ` · ${b.note}` : ''}` : `Reserved${b.unit ? ` · ${b.unit}` : ''}${b.name ? ` (${b.name})` : ''}`,
          backgroundColor: b.mine ? '#f6b73c' : '#9aa0ad',
          textColor: b.mine ? '#3b2a00' : '#fff',
        }))}
        datesSet={(arg: DatesSetArg) => setRange({ from: arg.start.toISOString(), to: arg.end.toISOString() })}
        select={(arg: DateSelectArg) => {
          book.reset()
          setDraft({ start: arg.start, end: arg.end })
        }}
      />
      <Modal open={draft !== null} onClose={() => setDraft(null)} title={`Book the ${amenity.name}`}>
        {draft && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              book.mutate()
            }}
          >
            <p className="rounded-lg bg-paper p-3 text-sm font-medium">{fmt.range(draft.start.toISOString(), draft.end.toISOString())}</p>
            <Field label="What’s it for? (optional)" hint="Only you and the building manager see this.">
              <input className={inputClass} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <ErrorText error={book.error} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={book.isPending}>
                Confirm booking
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

function MyBookings() {
  const qc = useQueryClient()
  const mine = useQuery({ queryKey: ['myBookings'], queryFn: api.myBookings })
  const cancel = useMutation({
    mutationFn: api.cancelBooking,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myBookings'] })
      qc.invalidateQueries({ queryKey: ['schedule'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  return (
    <Card>
      <SectionTitle>My upcoming bookings</SectionTitle>
      <ErrorText error={mine.error ?? cancel.error} />
      {mine.data?.length === 0 && <Empty>None yet. You can hold up to 3 at a time.</Empty>}
      <ul className="space-y-2">
        {mine.data?.map((b) => (
          <li key={b.id} className="rounded-lg bg-paper p-3 text-sm">
            <p className="font-semibold">{b.amenityName}</p>
            <p className="text-muted">{fmt.range(b.startsAt, b.endsAt)}</p>
            {b.note && <p className="text-muted">“{b.note}”</p>}
            <button className="mt-1 text-sm font-medium text-alert underline disabled:opacity-50" onClick={() => cancel.mutate(b.id)} disabled={cancel.isPending}>
              Cancel booking
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
