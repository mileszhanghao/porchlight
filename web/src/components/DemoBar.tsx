import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import type { User } from '../api/types'
import { DEMO_PEOPLE, resetDemo } from '../demo/people'
import { useLogin } from '../auth'

/** Demo only: switch between the four roles to see what each one can do. */
export function DemoBar({ user }: { user: User }) {
  const login = useLogin()
  const qc = useQueryClient()
  const navigate = useNavigate()
  return (
    <div className="bg-lamp-soft text-sm text-[#5c3d00]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
        <strong>Demo</strong>
        <span className="hidden md:inline">Everything runs in your browser. View as:</span>
        {DEMO_PEOPLE.map((p) => (
          <button
            key={p.email}
            onClick={() => login.mutate({ email: p.email, password: p.password }, { onSuccess: () => navigate('/') })}
            aria-pressed={user.name === p.name}
            className={`rounded-full border px-2.5 py-0.5 ${user.name === p.name ? 'border-[#8a5a00] bg-white font-semibold' : 'border-lamp/50 hover:bg-white/60'}`}
          >
            {p.label}
          </button>
        ))}
        <button
          className="ml-auto underline"
          onClick={() => {
            resetDemo()
            qc.clear()
            window.location.reload()
          }}
        >
          Reset demo
        </button>
      </div>
    </div>
  )
}
