import { useEffect, useState } from 'react'
import { authService } from '../services/authService'
import type { Perfil, Rol } from '../types'

const roles: Rol[] = ['vendedor', 'supervisor', 'jefe', 'contador', 'administrador_planta']

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [form, setForm] = useState({ nombres: '', apellidos: '', cedula: '', correo: '', telefono: '', password: '', rol: 'vendedor' as Rol })
  const [seleccionado, setSeleccionado] = useState<Perfil | null>(null)
  const [editForm, setEditForm] = useState({ nombres: '', apellidos: '', cedula: '', correo: '', telefono: '', rol: 'vendedor' as Rol, activo: true })
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const cargar = () => authService.getUsuarios().then(setUsuarios).catch(e => setError(e.message))
  useEffect(() => { cargar() }, [])

  const crear = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setMensaje(null); setSaving(true)
    try {
      await authService.crearUsuario(form)
      setForm({ nombres: '', apellidos: '', cedula: '', correo: '', telefono: '', password: '', rol: 'vendedor' }); setMensaje('Usuario creado. Entrégale el correo y la contraseña inicial.'); cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el usuario.') }
    finally { setSaving(false) }
  }

  const abrirDetalle = (usuario: Perfil) => {
    setSeleccionado(usuario)
    setEditForm({ nombres: usuario.nombres || '', apellidos: usuario.apellidos || '', cedula: usuario.cedula, correo: usuario.correo, telefono: usuario.telefono || '', rol: usuario.rol, activo: usuario.activo })
    setError(null)
  }

  const guardarCambios = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setMensaje(null); setSaving(true)
    try {
      if (!seleccionado) return
      await authService.actualizarUsuario({ id: seleccionado.id, ...editForm })
      setMensaje('Usuario actualizado correctamente.')
      setSeleccionado(null)
      await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar el usuario.') }
    finally { setSaving(false) }
  }

  return <section className="space-y-5">
    <div><h2 className="text-xl font-bold text-navy-500">Usuarios</h2><p className="text-sm text-navy-200">Crea cuentas y asigna permisos al equipo.</p></div>
    <form onSubmit={crear} className="rounded-xl border border-navy-50 bg-white p-5 shadow-sm">
      <h3 className="mb-1 font-bold text-navy-500">Crear usuario</h3><p className="mb-4 text-xs text-navy-200">La contraseña inicial no se guarda en el perfil; solo se usa para crear la cuenta.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required placeholder="Nombres" value={form.nombres} onChange={e => setForm({ ...form, nombres: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" />
        <input required placeholder="Apellidos" value={form.apellidos} onChange={e => setForm({ ...form, apellidos: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" />
        <input required placeholder="Cédula" value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" />
        <input required type="email" placeholder="Correo" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" />
        <input required type="tel" placeholder="Número de teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" />
        <input required minLength={6} type="password" placeholder="Contraseña inicial" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" autoComplete="new-password" />
        <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value as Rol })} className="rounded-lg border border-navy-100 px-3 py-2">
          {roles.map(rol => <option key={rol} value={rol}>{rol[0].toUpperCase() + rol.slice(1)}</option>)}
        </select>
      </div>
      {mensaje && <p className="mt-3 text-sm text-green-700">{mensaje}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button disabled={saving} className="mt-4 rounded-lg bg-primary-400 px-4 py-2 font-bold text-navy-500 disabled:opacity-60">{saving ? 'Enviando...' : 'Enviar invitación'}</button>
    </form>
    <div className="overflow-hidden rounded-xl border border-navy-50 bg-white shadow-sm">
      {usuarios.map(usuario => <button type="button" key={usuario.id} onClick={() => abrirDetalle(usuario)} className="flex w-full items-center justify-between border-b border-navy-50 px-5 py-4 text-left transition hover:bg-navy-50 last:border-0"><div><p className="font-semibold text-navy-500">{usuario.nombres || usuario.nombre} {usuario.apellidos || ''}</p><p className="text-sm text-navy-200">{usuario.correo} · {usuario.telefono || 'Sin teléfono'}</p></div><span className={usuario.activo ? 'rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700' : 'rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700'}>{usuario.activo ? 'Activo' : 'Inactivo'}</span></button>)}
    </div>
    {seleccionado && <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-navy-700/60 p-4" onClick={() => setSeleccionado(null)}>
      <form onSubmit={guardarCambios} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-navy-200">Editar usuario</p><h3 className="text-xl font-bold text-navy-500">{seleccionado.nombres || seleccionado.nombre} {seleccionado.apellidos || ''}</h3></div><button type="button" onClick={() => setSeleccionado(null)} className="text-xl text-navy-300" aria-label="Cerrar detalle">×</button></div>
        <div className="grid gap-3 sm:grid-cols-2"><input required placeholder="Nombres" value={editForm.nombres} onChange={e => setEditForm({ ...editForm, nombres: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" /><input required placeholder="Apellidos" value={editForm.apellidos} onChange={e => setEditForm({ ...editForm, apellidos: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" /><input required placeholder="Cédula" value={editForm.cedula} onChange={e => setEditForm({ ...editForm, cedula: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" /><input required type="email" placeholder="Correo" value={editForm.correo} onChange={e => setEditForm({ ...editForm, correo: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" /><input required type="tel" placeholder="Teléfono" value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} className="rounded-lg border border-navy-100 px-3 py-2" /><select value={editForm.rol} onChange={e => setEditForm({ ...editForm, rol: e.target.value as Rol })} className="rounded-lg border border-navy-100 px-3 py-2">{roles.map(rol => <option key={rol} value={rol}>{rol[0].toUpperCase() + rol.slice(1)}</option>)}</select></div>
        <label className="mt-4 flex items-center gap-3 rounded-lg bg-navy-50 p-3 text-sm font-semibold text-navy-500"><input type="checkbox" checked={editForm.activo} onChange={e => setEditForm({ ...editForm, activo: e.target.checked })} className="h-4 w-4" /> Usuario activo</label>
        <p className="mt-3 text-xs text-navy-200">Al desactivar un usuario, ya no podrá operar en el sistema. Al activarlo, recuperará el acceso.</p>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={saving} className="mt-4 w-full rounded-lg bg-primary-400 px-4 py-2.5 font-bold text-navy-500 disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
      </form>
    </div>}
  </section>
}