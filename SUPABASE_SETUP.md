# Configuración de Base de Datos Supabase

## Pasos para crear las tablas

1. Abre tu proyecto en [Supabase](https://supabase.co)
2. Ve a **SQL Editor** en el sidebar izquierdo
3. Haz clic en **New Query**
4. Copia y pega el contenido del archivo `schema.sql` del proyecto
5. Haz clic en **Run** o presiona `Ctrl+Enter`

## Estructura de Tablas

### clientes
- `id`: identificador único
- `nombre`: nombre del cliente
- `cedula`: cédula única del cliente
- `telefono`: teléfono (opcional)
- `direccion`: provincia/dirección (opcional)
- `created_at`: fecha de creación

### ordenes
- `id`: identificador único
- `numero`: número único de la orden
- `cliente_id`: referencia al cliente
- `estado`: estado actual de la orden
- `fecha_rc`: fecha de recepción
- `fecha_ef`: fecha de envío a fábrica
- `fecha_rf`: fecha de retorno de fábrica
- `fecha_bodega`: fecha en bodega
- `fecha_ec`: fecha de entrega al cliente
- `tipo_pago`: tipo de pago elegido
- `fecha_vencimiento`: fecha de vencimiento del crédito
- `monto_total`: total de la orden
- `monto_abonado`: total pagado
- `monto_pendiente`: total pendiente
- `pagado_completo`: boolean si está pagado
- `activo_vigente`: boolean si es vigente
- `observaciones`: notas
- `created_at`: fecha de creación

### items
- `id`: identificador único
- `orden_id`: referencia a la orden
- `marca`: marca de la llanta
- `n_serie`: número de serie
- `media`: medida de la llanta
- `diseno`: diseño de la llanta
- `cantidad`: cantidad de llantas
- `valor_unitario`: precio unitario
- `rechazo`: boolean si fue rechazado
- `observaciones`: notas
- `fecha_ingreso`: fecha de ingreso

### abonos
- `id`: identificador único
- `orden_id`: referencia a la orden
- `monto`: monto del abono
- `fecha`: fecha del abono
- `descripcion`: descripción del abono

## Variables de Entorno

Las siguientes variables ya están configuradas en `.env`:

```
VITE_SUPABASE_URL=https://xialcpxahjfabsdywiws.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_BxQhWF1UshDPwDS-PzphHw_713ZU4WQ
```

## Notas

- Todas las tablas están conectadas con foreign keys para mantener integridad referencial
- Se han creado índices automáticos para optimizar búsquedas
- Los datos son 100% de la base de datos (sin datos quemados)
- Solo los selects (ESTADOS, TIPOS_PAGO, DIRECCIONES, MEDIDAS_LLANTAS) son constantes locales en el código
