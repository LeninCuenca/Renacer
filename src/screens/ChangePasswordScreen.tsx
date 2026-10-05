import { useState } from 'react'
import { authService } from '../services/authService'

export default function ChangePasswordScreen({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null)
    if (password.length < 6) { setError('Usa al menos 6 caracteres.'); return }
    if (password !== confirmacion) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try { await authService.cambiarPasswordActual(password); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.') }
    finally { setSaving(false) }
  }

  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy-700/60 p-4" onClick={onClose}>
    <form onSubmit={guardar} onClick={event => event.stopPropagation()} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-start justify-between"><h2 className="text-xl font-bold text-navy-500">Cambiar contraseña</h2><button type="button" onClick={onClose} className="text-xl text-navy-300" aria-label="Cerrar">×</button></div>
      <input required minLength={6} type="password" placeholder="Nueva contraseña" value={password} onChange={e => setPassword(e.target.value)} className="mb-3 w-full rounded-lg border border-navy-100 px-3 py-2.5" autoComplete="new-password" />
      <input required minLength={6} type="password" placeholder="Repetir contraseña" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} className="w-full rounded-lg border border-navy-100 px-3 py-2.5" autoComplete="new-password" />
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={saving} className="mt-4 w-full rounded-lg bg-primary-400 px-4 py-2.5 font-bold text-navy-500 disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar contraseña'}</button>
    </form>
  </div>
}