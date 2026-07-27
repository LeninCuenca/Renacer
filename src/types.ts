export interface Cliente {
  id: number
  nombre: string
  cedula: string
  telefono?: string | null
  direccion?: string | null
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

export const DIRECCIONES: string[] = [
  'Azuay', 'Loja', 'Zamora Chinchipe', 'Zumbi', 'Yanzaza', 'Encuentro', 'Pangui', 'Gualaquiza', 'Guaysimi', 'Tundayme',
]

export const MEDIDAS_LLANTAS: string[] = [
  '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22',
  'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20',
  '175/70R13', '175/70R14', '185/65R14', '185/65R15', '195/65R15', '205/55R16', '205/60R16', '215/60R16', '225/45R17', '225/55R17',
  '265/70R16', '265/65R17', '275/55R20', '31x10.50R15', '33x12.50R15',
]
