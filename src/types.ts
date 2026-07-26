export interface Cliente {
  id: number
  nombre: string
  cedula: string
  telefono?: string | null
  created_at?: string
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
}

export type EstadoOrden = 'Recepcion' | 'Envio a fabrica' | 'Retorno de fabrica' | 'En bodega' | 'Entregado al cliente'
export type TipoPago = 'Contado' | 'Diferido en efectivo' | 'Credito 30 dias' | 'Credito 60 dias' | 'Credito 90 dias' | 'Cheque' | 'Transferencia'

export interface Orden {
  id: number
  numero: string
  cliente_id: number
  cliente_nombre?: string | null
  estado: EstadoOrden
  fecha_rc?: string | null
  fecha_ef?: string | null
  fecha_rf?: string | null
  fecha_bodega?: string | null
  fecha_ec?: string | null
  tipo_pago?: string | null
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
  promedio_rc_rf_horas: number | null
  promedio_ef_rf_horas: number | null
  promedio_rc_ec_horas: number | null
}

export const ESTADOS: EstadoOrden[] = ['Recepcion', 'Envio a fabrica', 'Retorno de fabrica', 'En bodega', 'Entregado al cliente']
export const TIPOS_PAGO: TipoPago[] = ['Contado', 'Diferido en efectivo', 'Credito 30 dias', 'Credito 60 dias', 'Credito 90 dias', 'Cheque', 'Transferencia']
