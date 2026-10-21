import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { AppModule } from './app.module'
import type { AppConfig } from './config'

/** Shared by main.ts and the e2e tests, so tests exercise the real middleware stack. */
export async function createApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { logger: ['error', 'warn', 'log'] })
  app.setGlobalPrefix('api')
  app.use(cookieParser())
  app.set('trust proxy', 1)
  app.enableShutdownHooks()

  // In the Docker image the API also serves the built React app.
  if (config.webDistDir && existsSync(config.webDistDir)) {
    const dir = config.webDistDir
    app.use(express.static(dir, { index: false, maxAge: '1h' }))
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
      res.sendFile(path.join(dir, 'index.html'))
    })
  }
  return app
}
