import { useState } from 'react'
import { authService } from '../services/authService'

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)

  const ingresar = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authService.iniciarSesion(correo, password)
      onLogin()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  const recuperar = async () => {
    if (!correo.trim()) { setError('Escribe tu correo para enviarte el enlace.'); return }
    setError(null); setLoading(true)
    try {
      await authService.solicitarRecuperacion(correo)
      setError('Revisa tu correo. El enlace abrirá esta aplicación para cambiar la contraseña.')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo recuperar la contraseña.') }
    finally { setLoading(false) }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-700 px-4 py-8">
      <form onSubmit={ingresar} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-7 flex items-center gap-3">
          <img src="/logoparaelbanner.png" alt="Renacer" className="h-14 w-14 object-contain" />
          <div><h1 className="text-xl font-bold text-navy-500">Renacer</h1><p className="text-sm text-navy-200">Registro Operativo</p></div>
        </div>
        <h2 className="mb-1 text-lg font-bold text-navy-500">Iniciar sesión</h2>
        <p className="mb-6 text-sm text-navy-200">Ingresa con las credenciales de tu cuenta.</p>
        <label className="mb-4 block text-sm font-semibold text-navy-400">Correo
          <input required type="email" value={correo} onChange={e => setCorreo(e.target.value)} className="mt-1 w-full rounded-lg border border-navy-100 px-3 py-2.5 outline-none focus:border-primary-500" autoComplete="email" />
        </label>
        <label className="mb-4 block text-sm font-semibold text-navy-400">Contraseña
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-navy-100 px-3 py-2.5 outline-none focus:border-primary-500" autoComplete="current-password" />
        </label>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-primary-400 px-4 py-3 font-bold text-navy-500 transition hover:bg-primary-500 disabled:opacity-60">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
        <button type="button" onClick={recuperar} disabled={loading} className="mt-4 w-full text-sm font-semibold text-navy-400 underline disabled:opacity-60">
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </main>
  )
}