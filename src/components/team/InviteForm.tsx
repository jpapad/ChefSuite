import { useState, type FormEvent } from 'react'
import { Mail } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { UserRole } from '../../types/database.types'

interface InviteFormProps {
  submitting?: boolean
  onSubmit: (email: string, role: UserRole) => void | Promise<void>
  onCancel: () => void
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'head_chef', label: 'Head chef' },
  { value: 'sous_chef', label: 'Sous chef' },
  { value: 'cook', label: 'Cook' },
  { value: 'staff', label: 'Staff' },
]

export function InviteForm({ submitting, onSubmit, onCancel }: InviteFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('cook')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit(email.trim(), role)
      setEmail('')
      setRole('cook')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        type="email"
        name="email"
        label="Teammate email"
        placeholder="chef@kitchen.com"
        required
        leftIcon={<Mail className="h-5 w-5" />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <div>
        <span className="mb-2 block text-sm font-medium text-white/80">
          Role
        </span>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={
                'min-h-touch-target rounded-xl px-4 text-left transition ' +
                (role === r.value
                  ? 'bg-brand-orange text-white-fixed'
                  : 'glass text-white/80 hover:bg-white/5')
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/40">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create invite'}
        </Button>
      </div>
    </form>
  )
}
