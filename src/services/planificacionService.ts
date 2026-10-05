import { supabase } from './supabaseClient'
import type { EdicionPlanificacion, PlanificacionSemanal } from '../types'

export const DIAS_PLANIFICACION = [
  { dia: 1, nombre: 'Lunes' },
  { dia: 2, nombre: 'Martes' },
  { dia: 3, nombre: 'Miércoles' },
  { dia: 4, nombre: 'Jueves' },
  { dia: 5, nombre: 'Viernes' },
]

export function inicioDeSemana(fecha = new Date()): string {
  const date = new Date(fecha)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

export const planificacionService = {
  async getPorVendedor(vendedorId: string, semanaInicio = inicioDeSemana()): Promise<PlanificacionSemanal[]> {
    const { data, error } = await supabase.from('planificaciones_semanales').select('*').eq('vendedor_id', vendedorId).eq('semana_inicio', semanaInicio).order('dia')
    if (error) throw error
    return (data || []) as PlanificacionSemanal[]
  },

  async guardar(vendedorId: string, semanaInicio: string, filas: Array<{ dia: number; ubicacion: string; notas: string }>) {
    const registros = filas.filter(fila => fila.ubicacion.trim()).map(fila => ({ vendedor_id: vendedorId, semana_inicio: semanaInicio, dia: fila.dia, ubicacion: fila.ubicacion.trim(), notas: fila.notas.trim() }))
    const { error: deleteError } = await supabase.from('planificaciones_semanales').delete().eq('vendedor_id', vendedorId).eq('semana_inicio', semanaInicio)
    if (deleteError) throw deleteError
    if (registros.length) {
      const { error } = await supabase.from('planificaciones_semanales').insert(registros)
      if (error) throw error
    }
    const { data: ultima } = await supabase.from('ediciones_planificacion').select('version').eq('vendedor_id', vendedorId).eq('semana_inicio', semanaInicio).order('version', { ascending: false }).limit(1).maybeSingle()
    const { error: historialError } = await supabase.from('ediciones_planificacion').insert({ vendedor_id: vendedorId, editado_por: vendedorId, semana_inicio: semanaInicio, version: (ultima?.version || 0) + 1, snapshot: registros.map(({ dia, ubicacion, notas }) => ({ dia, ubicacion, notas })) })
    if (historialError) throw historialError
  },

  async getHistorial(vendedorId: string, semanaInicio: string): Promise<EdicionPlanificacion[]> {
    const { data, error } = await supabase.from('ediciones_planificacion').select('*').eq('vendedor_id', vendedorId).eq('semana_inicio', semanaInicio).order('version', { ascending: false })
    if (error) throw error
    return (data || []) as EdicionPlanificacion[]
  },
}

export function rangoDeSemana(semanaInicio: string): string {
  const inicio = new Date(`${semanaInicio}T12:00:00`)
  const fin = new Date(inicio)
  fin.setDate(inicio.getDate() + 4)
  return `${inicio.toLocaleDateString('es-EC', { day: '2-digit', month: 'long' })} al ${fin.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}`
}