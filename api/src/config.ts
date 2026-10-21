export interface AppConfig {
  databaseUrl: string
  jwtSecret: string
  cookieSecure: boolean
  port: number
  webDistDir?: string
  /** Off only in tests that sign in many times from one address. */
  rateLimit?: boolean
}

export function loadConfig(env = process.env): AppConfig {
  const jwtSecret = env.JWT_SECRET ?? ''
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters (e.g. openssl rand -base64 48)')
  }
  return {
    databaseUrl: env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/porchlight',
    jwtSecret,
    cookieSecure: env.COOKIE_SECURE !== 'false',
    port: Number(env.PORT ?? 3000),
    webDistDir: env.WEB_DIST_DIR,
    rateLimit: env.RATE_LIMIT !== 'false',
  }
}

export const CONFIG = Symbol('CONFIG')
