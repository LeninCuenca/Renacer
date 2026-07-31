import { supabase } from './supabaseClient'
import type { Cliente, Orden, Item, EstadoOrden, TipoPago, ResumenReporte } from './types'
import { ESTADOS, calcularFechaVencimiento, diasDeCredito } from './types'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
// ============================================================
// Helpers
// ============================================================

/** Traduce errores de Supabase/Postgres a mensajes amigables en español */
function traducirError(error: any): string {
  if (!error) return 'Error desconocido'
  const msg = error.message || error.details || String(error)
  const code = error.code || ''

  // Violación de unicidad (duplicate key)
  if (code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint')) {
    if (msg.includes('cedula') || msg.includes('clientes_cedula')) {
      return 'Ya existe un cliente registrado con esa cédula o RUC. Verifique el número ingresado.'
    }
    if (msg.includes('numero') || msg.includes('ordenes_numero')) {
      return 'Ya existe una orden con ese número. Use un número diferente.'
    }
    return 'Ya existe un registro con esos datos. Verifique la información e intente de nuevo.'
  }

  // Violación de llave foránea
  if (code === '23503' || msg.includes('foreign key')) {
    return 'El registro referenciado no existe. Verifique los datos seleccionados.'
  }

  // Violación de NOT NULL
  if (code === '23502' || msg.includes('null value')) {
    return 'Hay campos obligatorios vacíos. Complete toda la información requerida.'
  }

  // Violación de check constraint
  if (code === '23514' || msg.includes('check constraint')) {
    return 'Los datos ingresados no son válidos. Verifique los valores e intente de nuevo.'
  }

  // Error de conexión / timeout
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('Failed to fetch')) {
    return 'Error de conexión. Verifique su conexión a internet e intente de nuevo.'
  }

  // Row Level Security / permisos
  if (code === '42501' || msg.includes('permission denied') || msg.includes('RLS')) {
    return 'No tiene permisos para realizar esta acción.'
  }

  // Error genérico de Supabase, devolver el mensaje original si es legible
  if (msg && msg.length < 200) return msg
  return 'Ocurrió un error inesperado. Intente de nuevo.'
}

/** Convierte el buffer del Excel a base64, que es lo que espera Filesystem */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunk = 8192 // evita superar el limite de argumentos de fromCharCode
  let binario = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binario += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binario)
}

/** Recalcula montos excluyendo items rechazados */
function recalcular(orden: Orden): Orden {
  const itemsValidos = orden.items.filter(it => !it.rechazo)
  const monto_total = Math.round(itemsValidos.reduce((s, it) => s + (it.cantidad * it.valor_unitario), 0) * 100) / 100
  const monto_abonado = orden.monto_abonado
  const monto_pendiente = Math.round((monto_total - monto_abonado) * 100) / 100
  const pagado_completo = monto_pendiente <= 0 && monto_total > 0

  return {
    ...orden,
    monto_total,
    monto_abonado,
    monto_pendiente,
    pagado_completo,
    activo_vigente: pagado_completo,
  }
}

/** Diferencia en dias enteros entre dos fechas */
function diffDias(a?: string | null, b?: string | null): number | null {
  if (a && b) {
    const ms = new Date(b).getTime() - new Date(a).getTime()
    return Math.round(ms / 86400000)
  }
  return null
}

/** Valida la trazabilidad secuencial */
function validarTransicion(orden: Orden, nuevoEstado: EstadoOrden): void {
  const idxActual = ESTADOS.indexOf(orden.estado)
  const idxNuevo = ESTADOS.indexOf(nuevoEstado)
  if (idxNuevo <= idxActual) {
    throw new Error('No se puede retroceder en la trazabilidad. El estado debe avanzar secuencialmente.')
  }
  if (idxNuevo !== idxActual + 1) {
    throw new Error(`Debe avanzar al estado siguiente: "${ESTADOS[idxActual + 1]}". No puede saltar pasos.`)
  }
}

/** Verifica pago completado antes de entrega */
function verificarEntrega(orden: Orden): void {
  if (!orden.pagado_completo) {
    throw new Error('No se puede entregar la orden: el pago no está completado. Registre el abono pendiente primero.')
  }
}

// ============================================================
// API Supabase
// ============================================================

export const supabaseApi = {
  // --- Clientes ---
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

  // --- Ordenes ---
  async getOrdenes(): Promise<Orden[]> {
    const { data: ordenes, error: ordenesError } = await supabase
      .from('ordenes')
      .select('*')
      .order('created_at', { ascending: false })

    if (ordenesError) throw ordenesError

    const result: Orden[] = []
    for (const orden of ordenes || []) {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('orden_id', orden.id)

      if (itemsError) throw itemsError

      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nombre')
        .eq('id', orden.cliente_id)
        .single()

      // Obtener total de abonos
      const { data: abonos } = await supabase
        .from('abonos')
        .select('monto')
        .eq('orden_id', orden.id)

      const totalAbonos = (abonos || []).reduce((s, a) => s + Number(a.monto), 0)

      const itemsValidos = (items || []).filter(it => !it.rechazo)
      const monto_total = Math.round(itemsValidos.reduce((s, it) => s + (it.cantidad * Number(it.valor_unitario)), 0) * 100) / 100
      const monto_pendiente = Math.round((monto_total - totalAbonos) * 100) / 100

      result.push({
        ...orden,
        cliente_nombre: clienteData?.nombre || null,
        monto_total,
        monto_abonado: totalAbonos,
        monto_pendiente,
        pagado_completo: monto_pendiente <= 0 && monto_total > 0,
        items: items || [],
      })
    }
    return result
  },

  async createOrden(data: { numero: string; cliente_id: number; observaciones?: string; items?: Item[] }): Promise<Orden> {
    // Verificar número de orden duplicado
    const numeroNorm = data.numero.trim().toUpperCase()
    const { data: ordenExistente } = await supabase
      .from('ordenes')
      .select('id, numero')
      .ilike('numero', numeroNorm)
      .maybeSingle()

    if (ordenExistente) {
      throw new Error(`Ya existe una orden con el número "${numeroNorm}". Use un número diferente.`)
    }

    const { data: newOrden, error } = await supabase
      .from('ordenes')
      .insert([{
        numero: numeroNorm,
        cliente_id: data.cliente_id,
        estado: 'Recepcion',
        observaciones: data.observaciones || '',
        monto_total: 0,
        monto_abonado: 0,
        monto_pendiente: 0,
      }])
      .select()
      .single()

    if (error) throw new Error(traducirError(error))

    // Agregar items si existen
    if (data.items && data.items.length > 0) {
      const { error: itemsError } = await supabase
        .from('items')
        .insert(data.items.map(item => ({ ...item, orden_id: newOrden.id })))

      if (itemsError) throw itemsError
    }

    // Recalcular montos
    const items = data.items || []
    const itemsValidos = items.filter(it => !it.rechazo)
    const monto_total = Math.round(itemsValidos.reduce((s, it) => s + (it.cantidad * it.valor_unitario), 0) * 100) / 100

    const { data: clienteData } = await supabase
      .from('clientes')
      .select('nombre')
      .eq('id', data.cliente_id)
      .single()

    return {
      ...newOrden,
      cliente_nombre: clienteData?.nombre || null,
      monto_total,
      monto_abonado: 0,
      monto_pendiente: monto_total,
      pagado_completo: false,
      activo_vigente: false,
      items,
    }
  },

  async updateOrdenEstado(id: number, nuevoEstado: EstadoOrden): Promise<Orden> {
    const { data: orden, error: getError } = await supabase
      .from('ordenes')
      .select('*, items(*)')
      .eq('id', id)
      .single()

    if (getError) throw getError

    validarTransicion(orden, nuevoEstado)
    if (nuevoEstado === 'Entregado al cliente') {
      verificarEntrega(orden)
    }

    const fechaKey = {
      'Recepcion': 'fecha_rc',
      'Envio a fabrica': 'fecha_ef',
      'Retorno de fabrica': 'fecha_rf',
      'En bodega': 'fecha_bodega',
      'Entregado al cliente': 'fecha_ec',
    }[nuevoEstado] as keyof Orden

    const updateData: any = {
      estado: nuevoEstado,
      [fechaKey]: new Date().toISOString(),
    }

    if (nuevoEstado === 'Entregado al cliente') {
      updateData.activo_vigente = orden.pagado_completo
    }

    const { data: updated, error } = await supabase
      .from('ordenes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    const { data: items } = await supabase
      .from('items')
      .select('*')
      .eq('orden_id', id)

    const { data: clienteData } = await supabase
      .from('clientes')
      .select('nombre')
      .eq('id', updated.cliente_id)
      .single()

    return {
      ...updated,
      cliente_nombre: clienteData?.nombre || null,
      items: items || [],
    } as Orden
  },

  async addItemToOrden(orden_id: number, item: Item): Promise<Item> {
    if (item.cantidad <= 0) {
      throw new Error('La cantidad debe ser mayor a cero.')
    }
    if (item.valor_unitario < 0) {
      throw new Error('El valor unitario no puede ser negativo.')
    }

    const { data: newItem, error } = await supabase
      .from('items')
      .insert([{ ...item, orden_id }])
      .select()
      .single()

    if (error) throw new Error(traducirError(error))

    // Recalcular montos de la orden
    await this.recalcularOrden(orden_id)

    return newItem
  },

  async recalcularOrden(orden_id: number): Promise<void> {
    const { data: items } = await supabase
      .from('items')
      .select('*')
      .eq('orden_id', orden_id)

    const { data: abonos } = await supabase
      .from('abonos')
      .select('monto')
      .eq('orden_id', orden_id)

    const itemsValidos = (items || []).filter(it => !it.rechazo)
    const monto_total = Math.round(itemsValidos.reduce((s, it) => s + (it.cantidad * Number(it.valor_unitario)), 0) * 100) / 100
    const totalAbonos = (abonos || []).reduce((s, a) => s + Number(a.monto), 0)
    const monto_pendiente = Math.round((monto_total - totalAbonos) * 100) / 100

    await supabase
      .from('ordenes')
      .update({
        monto_total,
        monto_abonado: totalAbonos,
        monto_pendiente,
        pagado_completo: monto_pendiente <= 0 && monto_total > 0,
      })
      .eq('id', orden_id)
  },

  // --- Abonos ---
  async createAbono(data: { orden_id: number; monto: number; descripcion?: string }): Promise<Orden> {
    if (data.monto <= 0) {
      throw new Error('El monto del abono debe ser mayor a cero.')
    }

    // Recalcular montos reales desde los items (el campo monto_total en BD puede estar desactualizado)
    await this.recalcularOrden(data.orden_id)

    // Leer montos ya recalculados
    const { data: ordenActual } = await supabase
      .from('ordenes')
      .select('monto_pendiente, monto_total, numero')
      .eq('id', data.orden_id)
      .single()

    if (ordenActual) {
      const montoTotal = Number(ordenActual.monto_total)
      const montoPendiente = Number(ordenActual.monto_pendiente)

      if (montoTotal <= 0) {
        // Verificar directamente en items por si acaso
        const { data: itemsOrden } = await supabase
          .from('items')
          .select('cantidad, valor_unitario, rechazo')
          .eq('orden_id', data.orden_id)
        const totalReal = (itemsOrden || [])
          .filter(it => !it.rechazo)
          .reduce((s, it) => s + it.cantidad * Number(it.valor_unitario), 0)
        if (totalReal <= 0) {
          throw new Error('Esta orden no tiene ítems con valor. Asigne precio a los ítems antes de registrar abonos.')
        }
      }

      if (data.monto > montoPendiente + 0.01) {
        throw new Error(`El abono ($${data.monto.toFixed(2)}) excede el monto pendiente ($${montoPendiente.toFixed(2)}) de la orden ${ordenActual.numero}.`)
      }
    }

    const { data: newAbono, error } = await supabase
      .from('abonos')
      .insert([data])
      .select()
      .single()

    if (error) throw new Error(traducirError(error))

    // Recalcular orden
    await this.recalcularOrden(data.orden_id)

    // Retornar la orden actualizada
    const { data: ordenActualizada, error: ordenError } = await supabase
      .from('ordenes')
      .select('*')
      .eq('id', data.orden_id)
      .single()

    if (ordenError) throw ordenError

    const { data: items } = await supabase
      .from('items')
      .select('*')
      .eq('orden_id', data.orden_id)

    const { data: clienteData } = await supabase
      .from('clientes')
      .select('nombre')
      .eq('id', ordenActualizada.cliente_id)
      .single()

    return {
      ...ordenActualizada,
      cliente_nombre: clienteData?.nombre || null,
      items: items || [],
    } as Orden
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

  // --- Tipo de Pago ---
  async setPagoPago(orden_id: number, tipo_pago: TipoPago): Promise<Orden> {
    const { data: diasCredito } = await supabase
      .from('ordenes')
      .select('*')
      .eq('id', orden_id)
      .single()

    // Calcular fecha de vencimiento basada en el tipo de pago
    let fecha_vencimiento: string | null = null
    const diasMap: { [key in TipoPago]: number } = {
      'Contado': 0,
      'Diferido en efectivo': 0,
      'Credito 30 dias': 30,
      'Credito 60 dias': 60,
      'Credito 90 dias': 90,
      'Cheque': 0,
      'Transferencia': 0,
    }

    const dias = diasMap[tipo_pago] || 0
    if (dias > 0) {
      const fechaVenc = new Date()
      fechaVenc.setDate(fechaVenc.getDate() + dias)
      fecha_vencimiento = fechaVenc.toISOString()
    }

    const { data: updated, error } = await supabase
      .from('ordenes')
      .update({ tipo_pago, fecha_vencimiento })
      .eq('id', orden_id)
      .select()
      .single()

    if (error) throw error

    const { data: items } = await supabase
      .from('items')
      .select('*')
      .eq('orden_id', orden_id)

    const { data: clienteData } = await supabase
      .from('clientes')
      .select('nombre')
      .eq('id', updated.cliente_id)
      .single()

    return {
      ...updated,
      cliente_nombre: clienteData?.nombre || null,
      items: items || [],
    } as Orden
  },

  // --- Reportes ---
  async getCreditosPorVencer(): Promise<Array<{ orden: Orden; diasRestantes: number; porVencer: boolean; vencido: boolean }>> {
    const { data: ordenes, error } = await supabase
      .from('ordenes')
      .select('*')
      .neq('estado', 'Entregado al cliente')
      .neq('pagado_completo', true)
      .not('fecha_vencimiento', 'is', null)
      .order('fecha_vencimiento', { ascending: true })

    if (error) throw error

    const result: Array<{ orden: Orden; diasRestantes: number; porVencer: boolean; vencido: boolean }> = []
    
    for (const o of ordenes || []) {
      const { data: items } = await supabase
        .from('items')
        .select('*')
        .eq('orden_id', o.id)

      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nombre')
        .eq('id', o.cliente_id)
        .single()

      const ahora = new Date()
      const venc = new Date(o.fecha_vencimiento)
      const diffMs = venc.getTime() - ahora.getTime()
      const dias = Math.ceil(diffMs / 86400000)

      result.push({
        orden: {
          ...o,
          cliente_nombre: clienteData?.nombre || null,
          items: items || [],
        } as Orden,
        diasRestantes: dias,
        porVencer: dias >= 0 && dias <= 7,
        vencido: dias < 0,
      })
    }

    return result.sort((a, b) => a.diasRestantes - b.diasRestantes)
  },

  async getResumenMensual(anio: number, mes: number): Promise<ResumenReporte | null> {
    const { data: ordenes, error } = await supabase
      .from('ordenes')
      .select('*')
      .gte('created_at', `${anio}-${String(mes).padStart(2, '0')}-01`)
      .lt('created_at', `${anio}-${String(mes + 1).padStart(2, '0')}-01`)

    if (error) throw error

    if (!ordenes || ordenes.length === 0) return null

    let total_cantidad = 0
    let suma_rc_rf = 0
    let suma_ef_rf = 0
    let suma_rc_ec = 0
    let count_rc_rf = 0
    let count_ef_rf = 0
    let count_rc_ec = 0

    for (const orden of ordenes) {
      const { data: items } = await supabase
        .from('items')
        .select('cantidad')
        .eq('orden_id', orden.id)
        .not('rechazo', 'is', true)

      total_cantidad += (items || []).reduce((s, i) => s + i.cantidad, 0)

      if (orden.fecha_rc && orden.fecha_rf) {
        suma_rc_rf += diffDias(orden.fecha_rc, orden.fecha_rf) || 0
        count_rc_rf++
      }

      if (orden.fecha_ef && orden.fecha_rf) {
        suma_ef_rf += diffDias(orden.fecha_ef, orden.fecha_rf) || 0
        count_ef_rf++
      }

      if (orden.fecha_rc && orden.fecha_ec) {
        suma_rc_ec += diffDias(orden.fecha_rc, orden.fecha_ec) || 0
        count_rc_ec++
      }
    }

    return {
      anio,
      mes,
      total_ordenes: ordenes.length,
      total_cantidad,
      promedio_rc_rf_dias: count_rc_rf > 0 ? Math.round(suma_rc_rf / count_rc_rf) : null,
      promedio_ef_rf_dias: count_ef_rf > 0 ? Math.round(suma_ef_rf / count_ef_rf) : null,
      promedio_rc_ec_dias: count_rc_ec > 0 ? Math.round(suma_rc_ec / count_rc_ec) : null,
    }
  },

  async exportarExcelMensual(anio: number, mes: number): Promise<void> {
    try {
      // El mes siguiente puede caer en el año siguiente (diciembre -> enero)
      const anioSiguiente = mes === 12 ? anio + 1 : anio
      const mesSiguiente = mes === 12 ? 1 : mes + 1

      const { data: ordenes, error } = await supabase
        .from('ordenes')
        .select('*')
        .gte('created_at', `${anio}-${String(mes).padStart(2, '0')}-01`)
        .lt('created_at', `${anioSiguiente}-${String(mesSiguiente).padStart(2, '0')}-01`)

      if (error) throw error
      if (!ordenes || ordenes.length === 0) {
        throw new Error('No hay ordenes registradas en el periodo seleccionado.')
      }

      // Agrupar órdenes por cliente
      interface OrdenyCliente {
        orden: any
        cliente: any
        items: any[]
      }
      
      const ordenesPorCliente: Map<string, OrdenyCliente[]> = new Map()

      // Se traen items y clientes en dos consultas, no una por orden:
      // en movil con red lenta el bucle anterior tardaba demasiado.
      const ordenIds = ordenes.map(o => o.id)
      const clienteIds = [...new Set(ordenes.map(o => o.cliente_id).filter(Boolean))]

      const [{ data: todosItems }, { data: todosClientes }] = await Promise.all([
        supabase.from('items').select('*').in('orden_id', ordenIds),
        supabase.from('clientes').select('*').in('id', clienteIds),
      ])

      const itemsPorOrden = new Map<string, any[]>()
      for (const it of todosItems || []) {
        if (!itemsPorOrden.has(it.orden_id)) itemsPorOrden.set(it.orden_id, [])
        itemsPorOrden.get(it.orden_id)!.push(it)
      }
      const clientePorId = new Map((todosClientes || []).map(c => [c.id, c]))

      for (const orden of ordenes) {
        const clienteData = clientePorId.get(orden.cliente_id) || null
        const clienteKey = clienteData?.id || 'desconocido'
        if (!ordenesPorCliente.has(clienteKey)) {
          ordenesPorCliente.set(clienteKey, [])
        }
        ordenesPorCliente.get(clienteKey)!.push({
          orden,
          cliente: clienteData,
          items: itemsPorOrden.get(orden.id) || []
        })
      }

      // Crear workbook con ExcelJS
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(`Reporte ${String(mes).padStart(2, '0')}-${anio}`.substring(0, 31))

      let currentRow = 1

      // Estilos predefinidos
      const estiloTitulo: any = {
        font: { bold: true, size: 14, color: { argb: 'FF1a3a5e' } },
        alignment: { horizontal: 'left', vertical: 'center' }
      }

      const estiloSubtitulo: any = {
        font: { size: 10, color: { argb: 'FF1a3a5e' } },
        alignment: { horizontal: 'left', vertical: 'center' }
      }

      const estiloClienteHeader: any = {
        font: { bold: true, size: 11, color: { argb: 'FF1a3a5e' } },
        alignment: { horizontal: 'left', vertical: 'center' }
      }

      const estiloHeaderTabla: any = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3a5e' } },
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          left: { style: 'thin' },
          right: { style: 'thin' },
          top: { style: 'thin' },
          bottom: { style: 'thin' }
        }
      }

      const estiloDatosNormales: any = {
        border: {
          left: { style: 'thin' },
          right: { style: 'thin' },
          top: { style: 'thin' },
          bottom: { style: 'thin' }
        },
        alignment: { horizontal: 'left', vertical: 'center' }
      }

      const estiloDatosNumeros: any = {
        border: {
          left: { style: 'thin' },
          right: { style: 'thin' },
          top: { style: 'thin' },
          bottom: { style: 'thin' }
        },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: '0.00'
      }

      const estiloTotal: any = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8e8e8' } },
        font: { bold: true, size: 10 },
        border: {
          left: { style: 'thin' },
          right: { style: 'thin' },
          top: { style: 'thin' },
          bottom: { style: 'thin' }
        },
        alignment: { horizontal: 'center', vertical: 'center' }
      }

      // Título principal
      worksheet.getCell(currentRow, 1).value = `Reporte Renacer - ${String(mes).padStart(2, '0')}/${anio}`
      worksheet.getCell(currentRow, 1).style = estiloTitulo
      currentRow++
      currentRow++

      // Subtítulo
      worksheet.getCell(currentRow, 1).value = 'Tiempos expresados en días naturales (enteros)'
      worksheet.getCell(currentRow, 1).style = estiloSubtitulo
      currentRow += 2

      // Procesar cada cliente
      for (const [_clienteKey, ordenesCliente] of ordenesPorCliente) {
        if (ordenesCliente.length === 0) continue

        const primerOrden = ordenesCliente[0]
        const clienteNombre = primerOrden.cliente?.nombre || 'Desconocido'
        const clienteDireccion = primerOrden.cliente?.direccion || 'Sin dirección'

        // Encabezado del cliente
        worksheet.getCell(currentRow, 1).value = `CLIENTE: ${clienteNombre} — Dirección: ${clienteDireccion}`
        worksheet.getCell(currentRow, 1).style = estiloClienteHeader
        currentRow += 2

        // Headers de la tabla
        const headers = [
          'Cliente',
          'Nº Orden',
          'Cant. (válida)',
          'Recepción (RC)',
          'Envío (EF)',
          'Retorno (RF)',
          'Entrega (EC)',
          'Días RC-RF',
          'Días EF-RF',
          'Días RC-EC',
          'Total',
          'Abonado',
          'Pendiente',
          'Estado'
        ]

        for (let i = 0; i < headers.length; i++) {
          worksheet.getCell(currentRow, i + 1).value = headers[i]
          worksheet.getCell(currentRow, i + 1).style = estiloHeaderTabla
        }
        currentRow++

        // Datos de órdenes del cliente
        let totalCliente = 0
        let abonado_cliente = 0
        let pendiente_cliente = 0
        let cantidadTotal = 0

        for (const item of ordenesCliente) {
          const orden = item.orden
          const itemsValidos = item.items.filter((it: any) => !it.rechazo)
          const totalItems = itemsValidos.reduce((s: number, it: any) => s + it.cantidad, 0)

          const rcDate = orden.fecha_rc ? new Date(orden.fecha_rc) : null
          const efDate = orden.fecha_ef ? new Date(orden.fecha_ef) : null
          const rfDate = orden.fecha_rf ? new Date(orden.fecha_rf) : null
          const ecDate = orden.fecha_ec ? new Date(orden.fecha_ec) : null

          const diasRcRf = rcDate && rfDate ? Math.floor((rfDate.getTime() - rcDate.getTime()) / (1000 * 60 * 60 * 24)) : ''
          const diasEfRf = efDate && rfDate ? Math.floor((rfDate.getTime() - efDate.getTime()) / (1000 * 60 * 60 * 24)) : ''
          const diasRcEc = rcDate && ecDate ? Math.floor((ecDate.getTime() - rcDate.getTime()) / (1000 * 60 * 60 * 24)) : ''

          const datosRow = [
            clienteNombre,
            orden.numero,
            totalItems,
            orden.fecha_rc ? new Date(orden.fecha_rc).toLocaleDateString('es-EC') : '',
            orden.fecha_ef ? new Date(orden.fecha_ef).toLocaleDateString('es-EC') : '',
            orden.fecha_rf ? new Date(orden.fecha_rf).toLocaleDateString('es-EC') : '',
            orden.fecha_ec ? new Date(orden.fecha_ec).toLocaleDateString('es-EC') : '',
            diasRcRf,
            diasEfRf,
            diasRcEc,
            Number(orden.monto_total),
            Number(orden.monto_abonado),
            Number(orden.monto_pendiente),
            orden.estado
          ]

          for (let i = 0; i < datosRow.length; i++) {
            worksheet.getCell(currentRow, i + 1).value = datosRow[i]
            // Aplicar estilo de números a columnas de montos
            if (i >= 10 && i <= 12) {
              worksheet.getCell(currentRow, i + 1).style = estiloDatosNumeros
            } else {
              worksheet.getCell(currentRow, i + 1).style = estiloDatosNormales
            }
          }
          currentRow++

          totalCliente += Number(orden.monto_total)
          abonado_cliente += Number(orden.monto_abonado)
          pendiente_cliente += Number(orden.monto_pendiente)
          cantidadTotal += totalItems
        }

        // Total por cliente
        const totalRow = [
          `TOTAL ${clienteNombre}`,
          '',
          cantidadTotal,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          totalCliente,
          abonado_cliente,
          pendiente_cliente,
          ''
        ]

        for (let i = 0; i < totalRow.length; i++) {
          worksheet.getCell(currentRow, i + 1).value = totalRow[i]
          const totalNumStyle: any = i >= 10 && i <= 12 ? { ...estiloTotal, numFmt: '0.00' } : estiloTotal
          worksheet.getCell(currentRow, i + 1).style = totalNumStyle
        }
        currentRow += 2
      }

      // Configurar ancho de columnas
      worksheet.columns = [
        { width: 20 },  // Cliente
        { width: 12 },  // Nº Orden
        { width: 14 },  // Cant. (válida)
        { width: 14 },  // Recepción (RC)
        { width: 14 },  // Envío (EF)
        { width: 14 },  // Retorno (RF)
        { width: 14 },  // Entrega (EC)
        { width: 12 },  // Días RC-RF
        { width: 12 },  // Días EF-RF
        { width: 12 },  // Días RC-EC
        { width: 12 },  // Total
        { width: 12 },  // Abonado
        { width: 12 },  // Pendiente
        { width: 20 }   // Estado
      ]

      // Generar archivo y descargar
      const buffer = await workbook.xlsx.writeBuffer()
      const fileName = `Reporte_Renacer_${String(mes).padStart(2, '0')}_${anio}.xlsx`

      if (Capacitor.isNativePlatform()) {
        const base64Data = arrayBufferToBase64(buffer as ArrayBuffer)

        // Una sola escritura: encadenar writeFile + appendFile por trozos
        // multiplicaba las llamadas al puente nativo sin ninguna ventaja.
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        })

        try {
          // Se usa `files` (no `url`): es la via soportada para compartir
          // archivos y deja que Android resuelva el permiso via FileProvider.
          await Share.share({
            title: 'Reporte Mensual Renacer',
            files: [savedFile.uri],
            dialogTitle: 'Compartir o guardar Excel',
          })
        } catch (shareError) {
          // Cerrar el menu de compartir no es un fallo real
          const msg = shareError instanceof Error ? shareError.message : String(shareError)
          if (!/cancel/i.test(msg)) throw shareError
        }
      } else {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        
        setTimeout(() => {
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
        }, 100)
      }
    } catch (e) {
      throw new Error(`Error al exportar Excel: ${e instanceof Error ? e.message : 'Error desconocido'}`)
    }
  },
}
