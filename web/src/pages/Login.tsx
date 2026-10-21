import { type FormEvent, useState } from 'react'
import { IS_DEMO } from '../api/client'
import { Button, ErrorText, Field, inputClass } from '../components/ui'
import { DEMO_PEOPLE } from '../demo/people'
import { useLogin } from '../auth'

export function Login() {
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ email, password })
  }
  return (
    <div className="grid min-h-screen place-items-center bg-night px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div aria-hidden className="mx-auto mb-3 h-4 w-4 rounded-full bg-lamp shadow-[0_0_24px_8px_rgba(246,183,60,.6)]" />
          <h1 className="font-serif text-4xl font-semibold">Porchlight</h1>
          <p className="mt-1 text-white/70">The community board for Larkspur Court</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          {IS_DEMO && (
            <div className="mb-5">
              <p className="mb-2 text-sm text-muted">This is a demo with made-up neighbors. Pick someone to sign in as:</p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_PEOPLE.map((p) => (
                  <button
                    key={p.email}
                    onClick={() => login.mutate({ email: p.email, password: p.password })}
                    className="rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-night"
                  >
                    <span className="block font-semibold">{p.name}</span>
                    <span className="text-muted">{p.label}</span>
                  </button>
                ))}
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                or sign in with email
                <span className="h-px flex-1 bg-line" />
              </div>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <ErrorText error={login.error} />
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted">Accounts are set up by the building office.</p>
        </div>
      </div>
    </div>
  )
}
