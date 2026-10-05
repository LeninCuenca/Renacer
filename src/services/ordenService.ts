import { supabase } from './supabaseClient'
import type { Orden, Item, EstadoOrden, TipoPago, EstadoEvaluacionLlanta } from '../types'
import { ESTADOS, diasDeCredito, calcularFechaVencimiento } from '../types'
import type { AlertaCredito } from '../types'
import { traducirError, validarTransicion, verificarEntrega, getCacheOrdenes, setCacheOrdenes, CACHE_TTL_MS } from './helpers'

// ============================================================
// Servicio de Órdenes — CRUD + trazabilidad + pago
// ============================================================

export const ordenService = {
  async getEvaluaciones(ordenId: number) {
    const { data, error } = await supabase.from('evaluaciones_llantas').select('*').eq('orden_id', ordenId)
    if (error) throw new Error([error.message, error.details, error.hint].filter(Boolean).join(' | '))
    return data || []
  },

  async guardarEvaluacion(datos: { itemId: number; ordenId: number; numeroLlanta: number; estado: Exclude<EstadoEvaluacionLlanta, 'pendiente'>; observaciones: string }) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw new Error('Debe iniciar sesión.')
    const { error } = await supabase.from('evaluaciones_llantas').upsert({ item_id: datos.itemId, orden_id: datos.ordenId, numero_llanta: datos.numeroLlanta, evaluado_por: userData.user.id, estado: datos.estado, observaciones: datos.observaciones.trim(), updated_at: new Date().toISOString() }, { onConflict: 'item_id,numero_llanta' })
    if (error) throw new Error([error.message, error.details, error.hint].filter(Boolean).join(' | '))
  },

  async cambiarAretornoDesdePlanta(ordenId: number) {
    return this.updateOrdenEstado(ordenId, 'Retorno de fabrica')
  },

  async getOrdenes(forzar = false): Promise<Orden[]> {
    // Devolver caché si es reciente y no se fuerza recarga
    const cache = getCacheOrdenes()
    if (!forzar && cache.data && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return cache.data
    }

    // Tres queries paralelas
    const [ordenesRes, itemsRes, abonosRes] = await Promise.all([
      supabase.from('ordenes').select('*, clientes(nombre), perfiles:vendedor_id(nombres, apellidos, nombre)').order('created_at', { ascending: false }),
      supabase.from('items').select('orden_id, cantidad, valor_unitario, rechazo, marca, n_serie, media, diseno, observaciones, fecha_ingreso, id'),
      supabase.from('abonos').select('orden_id, monto'),
    ])

    if (ordenesRes.error) throw ordenesRes.error

    // Indexar por orden_id con Map para O(1) lookup
    const itemsMap = new Map<number, any[]>()
    for (const it of itemsRes.data || []) {
      const arr = itemsMap.get(it.orden_id)
      if (arr) arr.push(it)
      else itemsMap.set(it.orden_id, [it])
    }
    const abonosMap = new Map<number, number>()
    for (const ab of abonosRes.data || []) {
      abonosMap.set(ab.orden_id, (abonosMap.get(ab.orden_id) || 0) + Number(ab.monto))
    }

    const result = (ordenesRes.data || []).map((orden: any) => {
      const items = itemsMap.get(orden.id) || []
      const totalAbonos = abonosMap.get(orden.id) || 0
      const itemsValidos = items.filter((it: any) => !it.rechazo)
      const monto_total = Math.round(itemsValidos.reduce((s: number, it: any) => s + (it.cantidad * Number(it.valor_unitario)), 0) * 100) / 100
      const monto_pendiente = Math.round((monto_total - totalAbonos) * 100) / 100
      return {
        ...orden,
        cliente_nombre: orden.clientes?.nombre || null,
        vendedor_nombre: orden.perfiles ? `${orden.perfiles.nombres || orden.perfiles.nombre || ''} ${orden.perfiles.apellidos || ''}`.trim() : null,
        monto_total,
        monto_abonado: totalAbonos,
        monto_pendiente,
        pagado_completo: monto_pendiente <= 0 && monto_total > 0,
        items,
      } as Orden
    })

    setCacheOrdenes(result)
    return result
  },

  async createOrden(data: { numero: string; cliente_id: number; observaciones?: string; items?: Item[] }): Promise<Orden> {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw new Error('Debe iniciar sesión para crear una orden.')
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
        vendedor_id: userData.user.id,
        estado: 'Recepcion',
        fecha_rc: new Date().toISOString(),
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
    if (nuevoEstado === 'Retorno de fabrica') {
      const { data: userData } = await supabase.auth.getUser()
      const { data: perfil } = userData.user ? await supabase.from('perfiles').select('rol, activo').eq('id', userData.user.id).single() : { data: null }
      if (perfil?.rol !== 'administrador_planta' || !perfil.activo) throw new Error('Solo el administrador de planta puede marcar el retorno de fábrica.')
    }
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

    // Cargar items y abonos en paralelo para calcular montos reales
    const [itemsRes, abonosRes, clienteRes] = await Promise.all([
      supabase.from('items').select('*').eq('orden_id', id),
      supabase.from('abonos').select('monto').eq('orden_id', id),
      supabase.from('clientes').select('nombre').eq('id', updated.cliente_id).single(),
    ])

    const items = itemsRes.data || []
    const totalAbonos = (abonosRes.data || []).reduce((s, a) => s + Number(a.monto), 0)
    const itemsValidos = items.filter((it: any) => !it.rechazo)
    const monto_total = Math.round(itemsValidos.reduce((s: number, it: any) => s + (it.cantidad * Number(it.valor_unitario)), 0) * 100) / 100
    const monto_pendiente = Math.round((monto_total - totalAbonos) * 100) / 100

    return {
      ...updated,
      cliente_nombre: clienteRes.data?.nombre || null,
      monto_total,
      monto_abonado: totalAbonos,
      monto_pendiente,
      pagado_completo: monto_pendiente <= 0 && monto_total > 0,
      items,
    } as Orden
  },

  async reasignarVendedorMasivo(viejoVendedorId: string, nuevoVendedorId: string): Promise<void> {
    const { error } = await supabase
      .from('ordenes')
      .update({ vendedor_id: nuevoVendedorId })
      .eq('vendedor_id', viejoVendedorId)

    if (error) throw error

    // Invalidar caché para forzar recarga en la lista
    invalidarCacheOrdenes()
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

  async setPagoPago(orden_id: number, tipo_pago: TipoPago): Promise<Orden> {
    // Calcular fecha de vencimiento usando la función centralizada
    let fecha_vencimiento: string | null = null
    const dias = diasDeCredito(tipo_pago)
    if (dias > 0) {
      const fechaVenc = calcularFechaVencimiento(new Date(), dias)
      fecha_vencimiento = fechaVenc.toISOString()
    }

    const { data: updated, error } = await supabase
      .from('ordenes')
      .update({ tipo_pago, fecha_vencimiento })
      .eq('id', orden_id)
      .select()
      .single()

    if (error) throw error

    const [itemsRes, clienteRes] = await Promise.all([
      supabase.from('items').select('*').eq('orden_id', orden_id),
      supabase.from('clientes').select('nombre').eq('id', updated.cliente_id).single(),
    ])

    return {
      ...updated,
      cliente_nombre: clienteRes.data?.nombre || null,
      items: itemsRes.data || [],
    } as Orden
  },

  async getCreditosPorVencer(): Promise<AlertaCredito[]> {
    const { data: ordenes, error } = await supabase
      .from('ordenes')
      .select('*, clientes(nombre)')
      .neq('estado', 'Entregado al cliente')
      .neq('pagado_completo', true)
      .not('fecha_vencimiento', 'is', null)
      .order('fecha_vencimiento', { ascending: true })

    if (error) throw error
    if (!ordenes || ordenes.length === 0) return []

    const ordenIds = ordenes.map(o => o.id)
    const { data: todosItems } = await supabase
      .from('items').select('*').in('orden_id', ordenIds)

    const itemsPorOrden = new Map<number, any[]>()
    for (const it of todosItems || []) {
      const arr = itemsPorOrden.get(it.orden_id)
      if (arr) arr.push(it)
      else itemsPorOrden.set(it.orden_id, [it])
    }

    const ahora = new Date()
    return ordenes.map((o: any) => {
      const venc = new Date(o.fecha_vencimiento)
      const dias = Math.ceil((venc.getTime() - ahora.getTime()) / 86400000)
      return {
        orden: {
          ...o,
          cliente_nombre: (o as any).clientes?.nombre || null,
          items: itemsPorOrden.get(o.id) || [],
        } as Orden,
        diasRestantes: dias,
        porVencer: dias >= 0 && dias <= 7,
        vencido: dias < 0,
      }
    }).sort((a, b) => a.diasRestantes - b.diasRestantes)
  },
}
