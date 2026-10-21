import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import { CATEGORY_LABEL, type PostCategory, type PostSummary } from '../api/types'
import { Badge, Button, Empty, ErrorText, Field, inputClass, Loading, Modal } from '../components/ui'
import { fmt } from '../format'

const CATEGORIES = Object.keys(CATEGORY_LABEL) as PostCategory[]

export function BoardPage() {
  const [category, setCategory] = useState<PostCategory | undefined>()
  const [composing, setComposing] = useState(false)
  const feed = useInfiniteQuery({
    queryKey: ['posts', category],
    queryFn: ({ pageParam }) => api.posts(category, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  })
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Neighbor board</h1>
          <p className="text-muted">Report a problem, find a lost thing, give away a couch.</p>
        </div>
        <Button onClick={() => setComposing(true)}>+ New post</Button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {[undefined, ...CATEGORIES].map((c) => (
          <button
            key={c ?? 'all'}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`rounded-full border px-3 py-1 text-sm ${category === c ? 'border-night bg-night text-white' : 'border-line bg-white hover:border-night'}`}
          >
            {c ? CATEGORY_LABEL[c] : 'Everything'}
          </button>
        ))}
      </div>
      <ErrorText error={feed.error} />
      {feed.isPending ? (
        <Loading />
      ) : posts.length === 0 ? (
        <Empty>No posts here yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <PostRow key={p.id} p={p} />
          ))}
        </ul>
      )}
      {feed.hasNextPage && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
            Load older posts
          </Button>
        </div>
      )}
      <NewPost open={composing} onClose={() => setComposing(false)} />
    </div>
  )
}

function PostRow({ p }: { p: PostSummary }) {
  return (
    <li className={`rounded-xl border border-line bg-white p-4 shadow-sm ${p.hidden ? 'border-dashed opacity-70' : ''}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge tone={p.category === 'issue' ? 'lamp' : 'neutral'}>{CATEGORY_LABEL[p.category]}</Badge>
        {p.hidden && <Badge tone="alert">Hidden: {p.hiddenReason}</Badge>}
      </div>
      <Link to={`/board/${p.id}`} className="font-serif text-lg font-semibold hover:underline">
        {p.title}
      </Link>
      <p className="line-clamp-2 text-sm text-ink/80">{p.body}</p>
      <p className="mt-2 text-xs text-muted">
        {p.authorName}
        {p.authorUnit ? ` · ${p.authorUnit}` : ''} · {fmt.ago(p.createdAt)} · ♥ {p.likes} · {p.comments} {p.comments === 1 ? 'reply' : 'replies'}
      </p>
    </li>
  )
}

function NewPost({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [category, setCategory] = useState<PostCategory>('general')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const create = useMutation({
    mutationFn: () => api.createPost({ category, title, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setTitle('')
      setBody('')
      onClose()
    },
  })
  return (
    <Modal open={open} onClose={onClose} title="New post">
      <form
        className="space-y-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <Field label="Category">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as PostCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input className={inputClass} required minLength={3} maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Details">
          <textarea className={inputClass} rows={4} required value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
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
