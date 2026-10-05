# Configuración de Base de Datos Supabase

## Pasos para crear las tablas

1. Abre tu proyecto en [Supabase](https://supabase.co)
2. Ve a **SQL Editor** en el sidebar izquierdo
3. Haz clic en **New Query**
4. Copia y pega el contenido del archivo `schema.sql` del proyecto
5. Haz clic en **Run** o presiona `Ctrl+Enter`

El script también crea `perfiles`, sus roles, triggers y políticas RLS. Ejecuta el archivo completo en una instalación nueva. En una base que ya contiene las tablas operativas, ejecuta primero una copia de seguridad y aplica los bloques nuevos de autenticación y RLS de forma controlada.

## Primer jefe y creación de usuarios

1. En Supabase ve a **Authentication → Users → Add user** y crea manualmente la primera cuenta del jefe.
2. En **SQL Editor**, asigna su perfil:

```sql
UPDATE public.perfiles
SET nombre = 'Nombre del jefe', cedula = 'CEDULA_DEL_JEFE', rol = 'jefe', activo = true
WHERE correo = 'jefe@tuempresa.com';
```

3. Despliega la función segura que usa el formulario:

```bash
npx supabase functions deploy admin-create-user
```

La función usa `SUPABASE_SERVICE_ROLE_KEY` únicamente en el entorno de Supabase. Nunca la pongas en variables `VITE_*` ni en el navegador. El jefe invita a cada usuario desde la pestaña **Usuarios**; el usuario recibe un correo de Supabase para definir su contraseña.

Los perfiles guardan `nombres`, `apellidos`, `cedula`, `correo`, `telefono`, `rol` y `activo`. Si tu base ya existía antes de estos campos, ejecuta en Supabase → **SQL Editor**:

```sql
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS nombres TEXT;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS apellidos TEXT;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS telefono TEXT;
```

Después de agregar las columnas, abre la tarjeta del usuario antiguo y pulsa **Guardar cambios** con sus nombres, apellidos y teléfono reales. Los perfiles antiguos no pueden recuperar automáticamente esos datos desde el correo.

Desde la tarjeta de cada usuario, el jefe puede editar sus datos, cambiar el rol y activar o desactivar el acceso. La edición actualiza tanto `perfiles` como el correo de Supabase Auth.

## Historial de planificación

Después de ejecutar la migración semanal, ejecuta también:

```text
supabase/migrations/20260930_ediciones_planificacion.sql
```

Cada guardado del vendedor crea una versión histórica. El vendedor puede seguir corrigiendo su semana; el jefe y el supervisor pueden abrir las versiones anteriores desde **Planificaciones**.

## Administrador de planta

Ejecuta también:

```text
supabase/migrations/20261004_planta_llantas.sql
```

Luego el jefe puede crear un usuario con rol **Administrador de planta**. Ese usuario verá las órdenes en `Envio a fabrica`, evaluará cada llanta como `Valida` o `No válida`, escribirá observaciones y solo podrá marcar `Retorno de fabrica` cuando todas hayan sido evaluadas. El vendedor verá esos resultados al abrir la orden.

## Enlaces de recuperación

Para probar recuperación en desarrollo, mantén la aplicación encendida con:

```bash
npm run dev
```

El enlace utiliza `http://localhost:5173`. En producción debes agregar la URL publicada en Supabase → **Authentication → URL Configuration → Redirect URLs** y cambiar la URL de redirección por el dominio real.

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
