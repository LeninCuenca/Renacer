import { supabase } from './supabaseClient'
import type { Cliente } from '../types'
import { traducirError } from './helpers'

// ============================================================
// Servicio de Clientes — CRUD
// ============================================================

export const clienteService = {
  async getClientes(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createCliente(data: { nombre: string; cedula: string; telefono?: string | null; direccion?: string | null }): Promise<Cliente> {
    // Verificar cédula duplicada antes de insertar
    const cedulaNorm = data.cedula.trim()
    const { data: existente } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('cedula', cedulaNorm)
      .maybeSingle()

    if (existente) {
      throw new Error(`Ya existe el cliente "${existente.nombre}" registrado con la cédula ${cedulaNorm}. No se pueden duplicar cédulas.`)
    }

    const { data: newCliente, error } = await supabase
      .from('clientes')
      .insert([{ ...data, cedula: cedulaNorm }])
      .select()
      .single()

    if (error) throw new Error(traducirError(error))
    return newCliente
  },

  async updateCliente(id: number, data: Partial<Cliente>): Promise<Cliente> {
    // Si se está actualizando la cédula, verificar que no exista en otro cliente
    if (data.cedula) {
      const cedulaNorm = data.cedula.trim()
      const { data: existente } = await supabase
        .from('clientes')
        .select('id, nombre')
        .eq('cedula', cedulaNorm)
        .neq('id', id)
        .maybeSingle()

      if (existente) {
        throw new Error(`Ya existe el cliente "${existente.nombre}" registrado con la cédula ${cedulaNorm}. No se pueden duplicar cédulas.`)
      }
      data = { ...data, cedula: cedulaNorm }
    }

    const { data: updated, error } = await supabase
      .from('clientes')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(traducirError(error))
    return updated
  },

  async deleteCliente(id: number): Promise<void> {
    // Verificar que el cliente no tenga órdenes activas
    const { data: ordenesActivas } = await supabase
      .from('ordenes')
      .select('id')
      .eq('cliente_id', id)
      .limit(1)

    if (ordenesActivas && ordenesActivas.length > 0) {
      throw new Error('No se puede eliminar el cliente porque tiene órdenes registradas. Elimine primero las órdenes asociadas.')
    }

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id)

    if (error) throw new Error(traducirError(error))
  },

  async toggleActivoCliente(id: number, activo: boolean): Promise<Cliente> {
    const { data: updated, error } = await supabase
      .from('clientes')
      .update({ activo })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(traducirError(error))
    return updated
  },
}
