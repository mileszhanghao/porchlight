import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, desc, eq, isNull, lt, type SQL, sql } from 'drizzle-orm'
import { Can, type SessionUser } from '../auth/auth.types'
import { DB, type Db } from '../db/db'
import { comments, postCategory, postLikes, posts, users } from '../db/schema'

type Category = (typeof postCategory.enumValues)[number]
export const PAGE_SIZE = 20

@Injectable()
export class BoardService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Keyset-paginated by id: pass the last page's nextBefore to get the next page. */
  async list(viewer: SessionUser, opts: { category?: Category; before?: number }) {
    const rows = await this.selectPosts(
      viewer,
      and(opts.category ? eq(posts.category, opts.category) : undefined, opts.before ? lt(posts.id, opts.before) : undefined),
      PAGE_SIZE + 1,
    )
    return { posts: rows.slice(0, PAGE_SIZE), nextBefore: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1]!.id : null }
  }

  async get(viewer: SessionUser, id: number) {
    const moderator = Can.moderate.includes(viewer.role)
    const [post] = await this.selectPosts(viewer, eq(posts.id, id), 1)
    if (!post) throw new NotFoundException('Post not found')
    const thread = await this.db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        hidden: sql<boolean>`${comments.hiddenAt} is not null`,
        authorId: comments.authorId,
        authorName: users.name,
        authorUnit: users.unit,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(eq(comments.postId, id))
      .orderBy(asc(comments.createdAt))
    return {
      ...post,
      thread: thread.map((c) => (c.hidden && !moderator ? { ...c, body: '[removed by a moderator]' } : c)),
    }
  }

  /**
   * Newest first. Like and comment counts come from correlated subqueries, so
   * a page is one query (no N+1). Hidden posts are left out, except for
   * moderators, who see them flagged.
   */
  private selectPosts(viewer: SessionUser, where: SQL | undefined, limit: number) {
    const moderator = Can.moderate.includes(viewer.role)
    return this.db
      .select({
        id: posts.id,
        category: posts.category,
        title: posts.title,
        body: posts.body,
        createdAt: posts.createdAt,
        hidden: sql<boolean>`${posts.hiddenAt} is not null`,
        hiddenReason: posts.hiddenReason,
        authorId: posts.authorId,
        authorName: users.name,
        authorUnit: users.unit,
        likes: sql<number>`(select count(*)::int from ${postLikes} where ${postLikes.postId} = ${posts.id})`,
        comments: sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id} and ${comments.hiddenAt} is null)`,
        likedByMe: sql<boolean>`exists(select 1 from ${postLikes} where ${postLikes.postId} = ${posts.id} and ${postLikes.userId} = ${viewer.id})`,
      })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(and(where, moderator ? undefined : isNull(posts.hiddenAt)))
      .orderBy(desc(posts.id))
      .limit(limit)
  }

  async create(user: SessionUser, input: { category: Category; title: string; body: string }) {
    const [row] = await this.db.insert(posts).values({ ...input, authorId: user.id }).returning()
    return row
  }

  async remove(user: SessionUser, id: number) {
    const post = await this.find(id)
    if (post.authorId !== user.id && !Can.moderate.includes(user.role)) throw new ForbiddenException('You can only delete your own posts')
    await this.db.delete(posts).where(eq(posts.id, id))
  }

  async comment(user: SessionUser, postId: number, body: string) {
    const post = await this.find(postId)
    if (post.hiddenAt) throw new ForbiddenException('This post has been hidden')
    const [row] = await this.db.insert(comments).values({ postId, authorId: user.id, body }).returning()
    return { ...row, hidden: false, authorName: user.name, authorUnit: user.unit }
  }

  /** Idempotent: liking twice is still one like (primary key on post_id, user_id). */
  async setLike(user: SessionUser, postId: number, liked: boolean) {
    await this.find(postId)
    if (liked) await this.db.insert(postLikes).values({ postId, userId: user.id }).onConflictDoNothing()
    else await this.db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, user.id)))
    const [{ likes } = { likes: 0 }] = await this.db
      .select({ likes: sql<number>`count(*)::int` })
      .from(postLikes)
      .where(eq(postLikes.postId, postId))
    return { liked, likes }
  }

  async setPostHidden(postId: number, hidden: boolean, reason?: string) {
    await this.find(postId)
    await this.db
      .update(posts)
      .set(hidden ? { hiddenAt: new Date(), hiddenReason: reason ?? null } : { hiddenAt: null, hiddenReason: null })
      .where(eq(posts.id, postId))
  }

  async hideComment(commentId: number) {
    const [row] = await this.db.update(comments).set({ hiddenAt: new Date() }).where(eq(comments.id, commentId)).returning()
    if (!row) throw new NotFoundException('Comment not found')
  }

  private async find(id: number) {
    const [post] = await this.db.select().from(posts).where(eq(posts.id, id))
    if (!post) throw new NotFoundException('Post not found')
    return post
  }
}
