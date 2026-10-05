import { supabase } from './supabaseClient'
import type { Orden } from '../types'
import { traducirError } from './helpers'
import { ordenService } from './ordenService'

// ============================================================
// Servicio de Abonos
// ============================================================

export const abonoService = {
  async createAbono(data: { orden_id: number; monto: number; descripcion?: string; _montoTotal?: number; _montoPendiente?: number }): Promise<{ abono: any; orden: Orden }> {
    if (data.monto <= 0) {
      throw new Error('El monto del abono debe ser mayor a cero.')
    }

    // Validar contra datos locales pasados por el caller (evita round-trip)
    const montoPendiente = data._montoPendiente ?? null
    const montoTotal = data._montoTotal ?? null

    if (montoTotal !== null && montoTotal <= 0) {
      throw new Error('Esta orden no tiene ítems con valor. Asigne precio a los ítems antes de registrar abonos.')
    }
    if (montoPendiente !== null && data.monto > montoPendiente + 0.01) {
      throw new Error(`El abono ($${data.monto.toFixed(2)}) excede el monto pendiente ($${montoPendiente.toFixed(2)}).`)
    }

    const insertData = { orden_id: data.orden_id, monto: data.monto, descripcion: data.descripcion }
    const { data: newAbono, error } = await supabase
      .from('abonos')
      .insert([insertData])
      .select()
      .single()

    if (error) throw new Error(traducirError(error))

    // Recalcular y obtener orden
    await ordenService.recalcularOrden(data.orden_id)

    const [ordenRes, itemsRes, abonosRes, clienteRes] = await Promise.all([
      supabase.from('ordenes').select('*').eq('id', data.orden_id).single(),
      supabase.from('items').select('*').eq('orden_id', data.orden_id),
      supabase.from('abonos').select('monto').eq('orden_id', data.orden_id),
      supabase.from('clientes').select('nombre').eq('id', 0).single(), // placeholder, se resolverá abajo
    ])

    if (ordenRes.error) throw ordenRes.error
    const o = ordenRes.data

    // Obtener nombre del cliente
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('nombre')
      .eq('id', o.cliente_id)
      .single()

    return {
      abono: newAbono,
      orden: {
        ...o,
        cliente_nombre: clienteData?.nombre || null,
        monto_abonado: o.monto_abonado,
        monto_total: o.monto_total,
        monto_pendiente: o.monto_pendiente,
        pagado_completo: o.pagado_completo,
        items: itemsRes.data || [],
      } as Orden,
    }
  },

  async getAbonos(orden_id: number): Promise<any[]> {
    const { data, error } = await supabase
      .from('abonos')
      .select('*')
      .eq('orden_id', orden_id)
      .order('fecha', { ascending: false })

    if (error) throw error
    return data || []
  },
}
