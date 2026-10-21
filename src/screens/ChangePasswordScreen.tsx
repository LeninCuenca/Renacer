import { useState } from 'react'
import { authService } from '../services/authService'
import type { Perfil } from '../types'

export default function MiPerfilModal({ perfil, onClose }: { perfil: Perfil, onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setMsg(null)
    if (password.length < 6) { setError('Usa al menos 6 caracteres.'); return }
    if (password !== confirmacion) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try { 
      await authService.cambiarPasswordActual(password); 
      setMsg('Contraseña actualizada correctamente.'); 
      setPassword(''); setConfirmacion(''); 
      setShowPasswordForm(false);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-navy-700/60 p-4" onClick={onClose}>
      <div onClick={event => event.stopPropagation()} className="my-8 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-xl font-bold text-navy-500">Mi Perfil</h2>
          <button type="button" onClick={onClose} className="text-xl text-navy-300 hover:text-navy-500">×</button>
        </div>

        <div className="mb-6 space-y-3 rounded-lg border border-navy-100 bg-navy-50 p-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-navy-300">Nombre completo</p><p className="font-semibold text-navy-500">{perfil.nombres || perfil.nombre} {perfil.apellidos || ''}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-navy-300">Cédula</p><p className="font-semibold text-navy-500">{perfil.cedula || 'N/A'}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-navy-300">Correo</p><p className="font-semibold text-navy-500">{perfil.correo}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-navy-300">Rol</p><p className="font-semibold capitalize text-navy-500">{perfil.rol.replace('_', ' ')}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-navy-300">Teléfono</p><p className="font-semibold text-navy-500">{perfil.telefono || 'N/A'}</p></div>
        </div>

        {msg && <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">{msg}</p>}
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!showPasswordForm ? (
          <button type="button" onClick={() => setShowPasswordForm(true)} className="w-full rounded-lg border border-primary-400 bg-white px-4 py-2.5 font-bold text-navy-500 hover:bg-primary-50 transition">
            Cambiar mi contraseña
          </button>
        ) : (
          <form onSubmit={guardar} className="mt-4 rounded-lg border border-navy-100 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-navy-500">Nueva contraseña</h3>
            <input required minLength={6} type="password" placeholder="Escribe la nueva contraseña" value={password} onChange={e => setPassword(e.target.value)} className="mb-3 w-full rounded-lg border border-navy-100 px-3 py-2.5 text-sm" autoComplete="new-password" />
            <input required minLength={6} type="password" placeholder="Repetir nueva contraseña" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} className="w-full rounded-lg border border-navy-100 px-3 py-2.5 text-sm" autoComplete="new-password" />
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-400 py-2.5 text-sm font-bold text-navy-500 disabled:opacity-60 transition">{saving ? 'Guardando...' : 'Guardar'}</button>
              <button type="button" disabled={saving} onClick={() => { setShowPasswordForm(false); setError(null); }} className="flex-1 rounded-lg border border-navy-100 bg-white py-2.5 text-sm font-bold text-navy-400 hover:bg-navy-50 transition">Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}