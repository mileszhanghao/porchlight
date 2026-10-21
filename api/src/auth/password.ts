import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>
// N=2^15, r=8, p=1: about 50 ms and 32 MiB per hash (OWASP's minimum is N=2^17 for scrypt;
// tuned down so the demo and tests stay fast; raise via SCRYPT_N in production).
const N = Number(process.env.SCRYPT_N ?? 2 ** 15)
const PARAMS = { N, r: 8, p: 1, maxmem: 128 * N * 8 * 2 }

/** Format: scrypt$N$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, 32, PARAMS)
  return `scrypt$${N}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, saltB64, hashB64] = stored.split('$')
  if (algo !== 'scrypt' || !n || !saltB64 || !hashB64) return false
  const cost = Number(n)
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: cost,
    r: 8,
    p: 1,
    maxmem: 128 * cost * 8 * 2,
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
