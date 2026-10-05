const ESTADO_STYLES: Record<string, string> = {
  'Recepcion': 'bg-navy-50 text-navy-500',
  'Envio a fabrica': 'bg-orange-50 text-orange-600',
  'Retorno de fabrica': 'bg-primary-50 text-navy-500',
  'En bodega': 'bg-navy-50 text-navy-400',
  'Entregado al cliente': 'bg-green-50 text-green-600',
  'Cancelada': 'bg-red-50 text-red-600 line-through',
}

export default function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${ESTADO_STYLES[estado] || 'bg-navy-50 text-navy-300'}`}>
      {estado}
    </span>
  )
}
