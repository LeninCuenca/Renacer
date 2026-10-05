import type { Orden, EstadoOrden } from '../types'
import { ESTADOS } from '../types'

// ============================================================
// Traducción de errores
// ============================================================

/** Traduce errores de Supabase/Postgres a mensajes amigables en español */
export function traducirError(error: any): string {
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

// ============================================================
// Helpers de cálculo
// ============================================================

/** Convierte el buffer del Excel a base64, que es lo que espera Filesystem */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunk = 8192 // evita superar el limite de argumentos de fromCharCode
  let binario = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binario += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binario)
}

/** Diferencia en dias enteros entre dos fechas */
export function diffDias(a?: string | null, b?: string | null): number | null {
  if (a && b) {
    const ms = new Date(b).getTime() - new Date(a).getTime()
    return Math.round(ms / 86400000)
  }
  return null
}

/** Valida la trazabilidad secuencial */
export function validarTransicion(orden: Orden, nuevoEstado: EstadoOrden): void {
  if (nuevoEstado === 'Cancelada') return // Se puede cancelar en cualquier momento
  const idxActual = ESTADOS.indexOf(orden.estado)
  const idxNuevo = ESTADOS.indexOf(nuevoEstado as any)
  if (idxNuevo <= idxActual) {
    throw new Error('No se puede retroceder en la trazabilidad. El estado debe avanzar secuencialmente.')
  }
  if (idxNuevo !== idxActual + 1) {
    throw new Error(`Debe avanzar al estado siguiente: "${ESTADOS[idxActual + 1]}". No puede saltar pasos.`)
  }
}

/** Verifica pago completado antes de entrega */
export function verificarEntrega(orden: Orden): void {
  if (!orden.pagado_completo) {
    throw new Error('No se puede entregar la orden: el pago no está completado. Registre el abono pendiente primero.')
  }
}

// ============================================================
// Caché en memoria (persiste durante la sesión)
// ============================================================

let _cacheOrdenes: Orden[] | null = null
let _cacheOrdenesTstamp = 0
export const CACHE_TTL_MS = 30_000 // 30 segundos

export function getCacheOrdenes(): { data: Orden[] | null; timestamp: number } {
  return { data: _cacheOrdenes, timestamp: _cacheOrdenesTstamp }
}

export function setCacheOrdenes(ordenes: Orden[]): void {
  _cacheOrdenes = ordenes
  _cacheOrdenesTstamp = Date.now()
}

export function invalidarCacheOrdenes(): void {
  _cacheOrdenes = null
  _cacheOrdenesTstamp = 0
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function formatFecha(fechaStr: string): string {
  const date = new Date(fechaStr)
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}
