import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common'
import { z } from 'zod'
import type { SessionUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators'
import { IdPipe } from '../common/id.pipe'
import { ZodPipe } from '../common/zod.pipe'
import { BookingsService } from './bookings.service'

const CreateBooking = z.object({
  amenityId: z.number().int().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  note: z.string().trim().max(200).default(''),
})
const Range = z.object({ from: z.coerce.date(), to: z.coerce.date() })

@Controller()
export class BookingsController {
  constructor(@Inject(BookingsService) private readonly bookings: BookingsService) {}

  @Get('amenities')
  amenities() {
    return this.bookings.listAmenities()
  }

  @Get('amenities/:id/bookings')
  schedule(@Param('id', IdPipe) id: number, @Query(new ZodPipe(Range)) q: z.infer<typeof Range>, @CurrentUser() user: SessionUser) {
    if (q.to.getTime() - q.from.getTime() > 62 * 86_400_000) throw new BadRequestException('Range is limited to about two months')
    return this.bookings.amenitySchedule(id, q.from, q.to, user)
  }

  @Get('bookings/mine')
  mine(@CurrentUser() user: SessionUser) {
    return this.bookings.mine(user)
  }

  @Post('bookings')
  create(@Body(new ZodPipe(CreateBooking)) body: z.infer<typeof CreateBooking>, @CurrentUser() user: SessionUser) {
    return this.bookings.create(user, body)
  }

  @Post('bookings/:id/cancel')
  @HttpCode(204)
  cancel(@Param('id', IdPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.bookings.cancel(user, id)
  }
}
