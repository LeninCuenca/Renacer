import { supabase } from './supabaseClient'
import type { Perfil, Rol } from '../types'

export const authService = {
  async errorDeFuncion(error: { message?: string; context?: Response }): Promise<Error> {
    if (error.context) {
      try {
        const body = await error.context.clone().json()
        if (body?.error) return new Error(body.error)
      } catch { /* respuesta no JSON */ }
    }
    return new Error(error.message || 'No se pudo completar la operación.')
  },

  async solicitarRecuperacion(correo: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
      redirectTo: window.location.origin,
    })
    if (error) throw new Error('No se pudo enviar el enlace de recuperación.')
  },

  async cambiarPassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error('No se pudo actualizar la contraseña.')
  },

  async iniciarSesion(correo: string, password: string): Promise<Perfil> {
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password })
    if (error) throw new Error('Correo o contraseña incorrectos.')
    return this.getPerfilActual()
  },

  async cerrarSesion() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getPerfilActual(): Promise<Perfil> {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw new Error('La sesión no es válida.')

    const { data, error } = await supabase.from('perfiles').select('*').eq('id', userData.user.id).single()
    if (error) throw new Error('Tu usuario todavía no tiene un perfil habilitado.')
    if (!data.activo) throw new Error('Tu usuario está desactivado.')
    return data as Perfil
  },

  async getUsuarios(): Promise<Perfil[]> {
    const { data, error } = await supabase.from('perfiles').select('*').order('nombre')
    if (error) throw error
    return (data || []) as Perfil[]
  },

  async getVendedores(): Promise<Perfil[]> {
    const { data, error } = await supabase.from('perfiles').select('*').eq('rol', 'vendedor').order('nombre')
    if (error) throw error
    return (data || []) as Perfil[]
  },

  async getVendedoresYSupervisores(): Promise<Perfil[]> {
    const { data, error } = await supabase.from('perfiles').select('*').in('rol', ['vendedor', 'supervisor']).order('nombre')
    if (error) throw error
    return (data || []) as Perfil[]
  },

  async crearUsuario(datos: { nombres: string; apellidos: string; cedula: string; correo: string; telefono: string; password: string; rol: Rol }) {
    const { error } = await supabase.functions.invoke('admin-create-user', {
      body: { ...datos, correo: datos.correo.trim().toLowerCase(), cedula: datos.cedula.trim(), telefono: datos.telefono.trim() },
    })
    if (error) throw await this.errorDeFuncion(error)
  },

  async cambiarPasswordActual(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  },

  async actualizarUsuario(datos: { id: string; nombres: string; apellidos: string; cedula: string; correo: string; telefono: string; rol: Rol; activo: boolean }) {
    const { error } = await supabase.functions.invoke('admin-update-user', {
      body: { ...datos, correo: datos.correo.trim().toLowerCase(), cedula: datos.cedula.trim(), telefono: datos.telefono.trim() },
    })
    if (error) throw await this.errorDeFuncion(error)
  },
}