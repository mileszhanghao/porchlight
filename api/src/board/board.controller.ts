import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query } from '@nestjs/common'
import { z } from 'zod'
import { Can, type SessionUser } from '../auth/auth.types'
import { CurrentUser, Roles } from '../auth/decorators'
import { IdPipe } from '../common/id.pipe'
import { ZodPipe } from '../common/zod.pipe'
import { postCategory } from '../db/schema'
import { BoardService } from './board.service'

const CreatePost = z.object({
  category: z.enum(postCategory.enumValues).default('general'),
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(1).max(5000),
})
const ListQuery = z.object({
  category: z.enum(postCategory.enumValues).optional(),
  before: z.coerce.number().int().positive().optional(),
})
const CommentBody = z.object({ body: z.string().trim().min(1).max(2000) })
const HideBody = z.object({ reason: z.string().trim().min(3).max(200) })

@Controller()
export class BoardController {
  constructor(@Inject(BoardService) private readonly board: BoardService) {}

  @Get('posts')
  list(@Query(new ZodPipe(ListQuery)) q: z.infer<typeof ListQuery>, @CurrentUser() user: SessionUser) {
    return this.board.list(user, q)
  }

  @Get('posts/:id')
  get(@Param('id', IdPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.board.get(user, id)
  }

  @Post('posts')
  create(@Body(new ZodPipe(CreatePost)) body: z.infer<typeof CreatePost>, @CurrentUser() user: SessionUser) {
    return this.board.create(user, body)
  }

  @Delete('posts/:id')
  @HttpCode(204)
  remove(@Param('id', IdPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.board.remove(user, id)
  }

  @Post('posts/:id/comments')
  comment(@Param('id', IdPipe) id: number, @Body(new ZodPipe(CommentBody)) body: z.infer<typeof CommentBody>, @CurrentUser() user: SessionUser) {
    return this.board.comment(user, id, body.body)
  }

  @Put('posts/:id/like')
  like(@Param('id', IdPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.board.setLike(user, id, true)
  }

  @Delete('posts/:id/like')
  unlike(@Param('id', IdPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.board.setLike(user, id, false)
  }

  @Post('posts/:id/hide')
  @HttpCode(204)
  @Roles(...Can.moderate)
  hide(@Param('id', IdPipe) id: number, @Body(new ZodPipe(HideBody)) body: z.infer<typeof HideBody>) {
    return this.board.setPostHidden(id, true, body.reason)
  }

  @Post('posts/:id/unhide')
  @HttpCode(204)
  @Roles(...Can.moderate)
  unhide(@Param('id', IdPipe) id: number) {
    return this.board.setPostHidden(id, false)
  }

  @Post('comments/:id/hide')
  @HttpCode(204)
  @Roles(...Can.moderate)
  hideComment(@Param('id', IdPipe) id: number) {
    return this.board.hideComment(id)
  }
}
