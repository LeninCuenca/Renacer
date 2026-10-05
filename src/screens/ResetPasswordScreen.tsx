import { useState } from 'react'
import { authService } from '../services/authService'

export default function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null)
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirmacion) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try { await authService.cambiarPassword(password); onDone() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar la contraseña.') }
    finally { setLoading(false) }
  }

  return <main className="flex min-h-screen items-center justify-center bg-navy-700 px-4 py-8">
    <form onSubmit={guardar} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
      <h1 className="mb-2 text-xl font-bold text-navy-500">Crear nueva contraseña</h1>
      <p className="mb-6 text-sm text-navy-200">Escribe una contraseña nueva para acceder a Renacer.</p>
      <label className="mb-4 block text-sm font-semibold text-navy-400">Nueva contraseña
        <input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-navy-100 px-3 py-2.5 outline-none focus:border-primary-500" autoComplete="new-password" />
      </label>
      <label className="mb-4 block text-sm font-semibold text-navy-400">Repetir contraseña
        <input required minLength={6} type="password" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} className="mt-1 w-full rounded-lg border border-navy-100 px-3 py-2.5 outline-none focus:border-primary-500" autoComplete="new-password" />
      </label>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={loading} className="w-full rounded-lg bg-primary-400 px-4 py-3 font-bold text-navy-500 disabled:opacity-60">{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
    </form>
  </main>
}