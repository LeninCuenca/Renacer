// ============================================================
// Types, Interfaces y Constantes del sistema Renacer
// ============================================================

export interface Cliente {
  id: number
  nombre: string
  cedula: string
  telefono?: string | null
  direccion?: string | null
  activo?: boolean
  created_at?: string
}

export type Rol = 'vendedor' | 'supervisor' | 'jefe' | 'contador' | 'administrador_planta'
export type EstadoEvaluacionLlanta = 'pendiente' | 'valida' | 'no_valida'

export interface Perfil {
  id: string
  nombre: string
  nombres?: string | null
  apellidos?: string | null
  cedula: string
  correo: string
  telefono?: string | null
  rol: Rol
  activo: boolean
  created_at?: string
}

export interface PlanificacionSemanal {
  id?: number
  vendedor_id: string
  semana_inicio: string
  dia: number
  ubicacion: string
  notas: string
  created_at?: string
  updated_at?: string
}

export interface EdicionPlanificacion {
  id: number
  vendedor_id: string
  editado_por: string
  semana_inicio: string
  version: number
  snapshot: Array<{ dia: number; ubicacion: string; notas: string }>
  created_at: string
}

export interface Item {
  id?: number
  orden_id?: number
  marca?: string | null
  n_serie?: string | null
  media?: string | null
  diseno?: string | null
  cantidad: number
  valor_unitario: number
  rechazo: boolean
  observaciones: string
  fecha_ingreso?: string | null
  evaluacion_estado?: EstadoEvaluacionLlanta | null
  evaluacion_observaciones?: string | null
  evaluado_por?: string | null
}

export interface EvaluacionLlanta {
  id: number
  item_id: number
  orden_id: number
  numero_llanta: number
  evaluado_por: string
  estado: EstadoEvaluacionLlanta
  observaciones: string
  created_at: string
  updated_at?: string
}

export type EstadoOrden = 'Recepcion' | 'Envio a fabrica' | 'Retorno de fabrica' | 'En bodega' | 'Entregado al cliente' | 'Cancelada'
export type TipoPago = 'Contado' | 'Diferido en efectivo' | 'Credito 30 dias' | 'Credito 60 dias' | 'Credito 90 dias' | 'Cheque' | 'Transferencia'

export interface Orden {
  id: number
  numero: string
  cliente_id: number
  vendedor_id?: string | null
  vendedor_nombre?: string | null
  cliente_nombre?: string | null
  estado: EstadoOrden
  fecha_rc?: string | null
  fecha_ef?: string | null
  fecha_rf?: string | null
  fecha_bodega?: string | null
  fecha_ec?: string | null
  tipo_pago?: string | null
  fecha_vencimiento?: string | null
  monto_total: number
  monto_abonado: number
  monto_pendiente: number
  pagado_completo: boolean
  activo_vigente: boolean
  observaciones: string
  created_at?: string | null
  items: Item[]
}

export interface ResumenReporte {
  anio: number
  mes: number
  total_ordenes: number
  total_cantidad: number
  promedio_rc_rf_dias: number | null
  promedio_ef_rf_dias: number | null
  promedio_rc_ec_dias: number | null
}

export interface AlertaCredito {
  orden: Orden
  diasRestantes: number
  porVencer: boolean
  vencido: boolean
}

// ============================================================
// Constantes
// ============================================================

export const ESTADOS: EstadoOrden[] = ['Recepcion', 'Envio a fabrica', 'Retorno de fabrica', 'En bodega', 'Entregado al cliente']
export const TIPOS_PAGO: TipoPago[] = ['Contado', 'Diferido en efectivo', 'Credito 30 dias', 'Credito 60 dias', 'Credito 90 dias', 'Cheque', 'Transferencia']

export const DIRECCIONES: string[] = [
  'Azuay', 'Loja', 'Zamora Chinchipe', 'Zumbi', 'Yanzaza', 'Encuentro', 'Pangui', 'Gualaquiza', 'Guaysimi', 'Tundayme',
]

export const MEDIDAS_LLANTAS: string[] = [
  '295/80R22.5',
  '315/80R22.5',
  '12R22.5',
  '12.00R24',
  'Otros',
]

export const MESES: string[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ============================================================
// Feriados Ecuador
// ============================================================

/** Feriados nacionales del Ecuador (no laborables) */
export const FERIADOS_EC: Record<number, string[]> = {
  2025: [
    '2025-01-01', '2025-01-02', '2025-02-03', '2025-03-03', '2025-04-18',
    '2025-05-01', '2025-05-02', '2025-05-23', '2025-06-06', '2025-08-10',
    '2025-10-09', '2025-11-03', '2025-11-04', '2025-12-25',
  ],
  2026: [
    '2026-01-01', '2026-02-16', '2026-03-02', '2026-04-06', '2026-05-01',
    '2026-05-22', '2026-05-29', '2026-06-05', '2026-08-10', '2026-10-09',
    '2026-11-02', '2026-11-03', '2026-12-25',
  ],
}

// ============================================================
// Funciones utilitarias de fecha
// ============================================================

/** Verifica si una fecha es feriado en Ecuador */
export function esFeriado(fecha: Date): boolean {
  const yyyy = fecha.getFullYear()
  const feriados = FERIADOS_EC[yyyy] || []
  const str = fecha.toISOString().slice(0, 10)
  return feriados.includes(str)
}

/** Verifica si una fecha es fin de semana (sabado o domingo) */
export function esFinDeSemana(fecha: Date): boolean {
  const dia = fecha.getDay()
  return dia === 0 || dia === 6
}

/** Calcula la fecha de vencimiento sumando dias corridos */
export function calcularFechaVencimiento(fechaInicio: Date, diasCredito: number): Date {
  let fecha = new Date(fechaInicio)
  fecha.setDate(fecha.getDate() + diasCredito)
  return fecha
}

/** Obtiene los dias de credito desde el tipo de pago */
export function diasDeCredito(tipoPago: string): number {
  if (tipoPago === 'Credito 30 dias') return 30
  if (tipoPago === 'Credito 60 dias') return 60
  if (tipoPago === 'Credito 90 dias') return 90
  return 0
}
