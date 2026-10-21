import { type DynamicModule, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AnnouncementsController } from './announcements/announcements.controller'
import { AuthController, SESSION_HOURS } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { CsrfGuard, RolesGuard, SessionGuard } from './auth/guards'
import { BoardController } from './board/board.controller'
import { BoardService } from './board/board.service'
import { BookingsController } from './bookings/bookings.controller'
import { BookingsService } from './bookings/bookings.service'
import { CONFIG, type AppConfig } from './config'
import { DashboardController } from './dashboard/dashboard.controller'
import { DbModule } from './db/db.module'
import { EventsController } from './events/events.controller'
import { HealthController } from './health.controller'
import { UsersController } from './users/users.controller'

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        { module: ConfigHolder, global: true, providers: [{ provide: CONFIG, useValue: config }], exports: [CONFIG] },
        DbModule,
        JwtModule.register({ secret: config.jwtSecret, signOptions: { expiresIn: `${SESSION_HOURS}h` } }),
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 300 }], skipIf: () => config.rateLimit === false }),
      ],
      controllers: [
        HealthController,
        AuthController,
        UsersController,
        AnnouncementsController,
        EventsController,
        BookingsController,
        BoardController,
        DashboardController,
      ],
      providers: [
        AuthService,
        BookingsService,
        BoardService,
        // Order matters: rate limit, then CSRF header, then session, then role.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }
  }
}

@Module({})
class ConfigHolder {}
