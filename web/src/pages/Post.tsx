import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api/client'
import { can, CATEGORY_LABEL, type User } from '../api/types'
import { Badge, Button, Card, ErrorText, Field, inputClass, Loading, Modal } from '../components/ui'
import { fmt } from '../format'

export function PostPage({ user }: { user: User }) {
  const id = Number(useParams().id)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const post = useQuery({ queryKey: ['post', id], queryFn: () => api.post(id) })
  const [reply, setReply] = useState('')
  const [hiding, setHiding] = useState(false)
  const [reason, setReason] = useState('')
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['post', id] })
    qc.invalidateQueries({ queryKey: ['posts'] })
  }
  const like = useMutation({ mutationFn: (liked: boolean) => api.like(id, liked), onSuccess: refresh })
  const comment = useMutation({
    mutationFn: () => api.comment(id, reply),
    onSuccess: () => {
      setReply('')
      refresh()
    },
  })
  const hide = useMutation({
    mutationFn: () => api.hidePost(id, reason),
    onSuccess: () => {
      setHiding(false)
      refresh()
    },
  })
  const unhide = useMutation({ mutationFn: () => api.unhidePost(id), onSuccess: refresh })
  const hideComment = useMutation({ mutationFn: api.hideComment, onSuccess: refresh })
  const remove = useMutation({
    mutationFn: () => api.deletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      navigate('/board')
    },
  })

  if (post.isPending) return <Loading />
  if (post.isError) return <ErrorText error={post.error} />
  const p = post.data
  const moderator = can.moderate(user)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/board" className="text-sm text-muted hover:text-ink">
        ← Back to the board
      </Link>
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={p.category === 'issue' ? 'lamp' : 'neutral'}>{CATEGORY_LABEL[p.category]}</Badge>
          {p.hidden && <Badge tone="alert">Hidden from residents: {p.hiddenReason}</Badge>}
        </div>
        <h1 className="font-serif text-2xl font-semibold">{p.title}</h1>
        <p className="mb-3 text-sm text-muted">
          {p.authorName}
          {p.authorUnit ? ` · ${p.authorUnit}` : ''} · {fmt.ago(p.createdAt)}
        </p>
        <p className="whitespace-pre-line">{p.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant={p.likedByMe ? 'primary' : 'secondary'}
            aria-pressed={p.likedByMe}
            onClick={() => like.mutate(!p.likedByMe)}
            disabled={like.isPending}
          >
            ♥ {p.likes}
          </Button>
          {(p.authorId === user.id || moderator) && (
            <Button variant="ghost" onClick={() => remove.mutate()}>
              Delete
            </Button>
          )}
          {moderator &&
            (p.hidden ? (
              <Button variant="secondary" onClick={() => unhide.mutate()}>
                Unhide
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setHiding(true)}>
                Hide post
              </Button>
            ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-serif text-lg font-semibold">
          {p.thread.length} {p.thread.length === 1 ? 'reply' : 'replies'}
        </h2>
        <ul className="space-y-3">
          {p.thread.map((c) => (
            <li key={c.id} className={`rounded-lg bg-paper p-3 text-sm ${c.hidden ? 'opacity-60' : ''}`}>
              <p className="mb-1 text-xs text-muted">
                {c.authorName}
                {c.authorUnit ? ` · ${c.authorUnit}` : ''} · {fmt.ago(c.createdAt)}
                {c.hidden && ' · hidden'}
              </p>
              <p className={c.hidden && !moderator ? 'italic text-muted' : ''}>{c.body}</p>
              {moderator && !c.hidden && (
                <button className="mt-1 text-xs text-alert underline" onClick={() => hideComment.mutate(c.id)}>
                  Hide reply
                </button>
              )}
            </li>
          ))}
        </ul>
        {!p.hidden && (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              comment.mutate()
            }}
          >
            <label className="sr-only" htmlFor="reply">
              Reply
            </label>
            <textarea id="reply" className={inputClass} rows={2} placeholder="Write a reply…" required value={reply} onChange={(e) => setReply(e.target.value)} />
            <ErrorText error={comment.error} />
            <div className="text-right">
              <Button type="submit" disabled={comment.isPending}>
                Reply
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Modal open={hiding} onClose={() => setHiding(false)} title="Hide this post">
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            hide.mutate()
          }}
        >
          <Field label="Reason" hint="Shown to other moderators and the building manager.">
            <input className={inputClass} required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <ErrorText error={hide.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setHiding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={hide.isPending}>
              Hide post
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
