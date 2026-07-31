-- ========================================
-- TABLA: clientes
-- ========================================
CREATE TABLE clientes (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cedula TEXT NOT NULL UNIQUE,
  telefono TEXT,
  direccion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLA: ordenes
-- ========================================
CREATE TABLE ordenes (
  id BIGSERIAL PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'Recepcion',
  fecha_rc TIMESTAMP WITH TIME ZONE,
  fecha_ef TIMESTAMP WITH TIME ZONE,
  fecha_rf TIMESTAMP WITH TIME ZONE,
  fecha_bodega TIMESTAMP WITH TIME ZONE,
  fecha_ec TIMESTAMP WITH TIME ZONE,
  tipo_pago TEXT,
  fecha_vencimiento TIMESTAMP WITH TIME ZONE,
  monto_total NUMERIC(12, 2) DEFAULT 0,
  monto_abonado NUMERIC(12, 2) DEFAULT 0,
  monto_pendiente NUMERIC(12, 2) DEFAULT 0,
  pagado_completo BOOLEAN DEFAULT FALSE,
  activo_vigente BOOLEAN DEFAULT FALSE,
  observaciones TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLA: items
-- ========================================
CREATE TABLE items (
  id BIGSERIAL PRIMARY KEY,
  orden_id BIGINT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  marca TEXT,
  n_serie TEXT,
  media TEXT,
  diseno TEXT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(12, 2) DEFAULT 0,
  rechazo BOOLEAN DEFAULT FALSE,
  observaciones TEXT DEFAULT '',
  fecha_ingreso TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLA: abonos
-- ========================================
CREATE TABLE abonos (
  id BIGSERIAL PRIMARY KEY,
  orden_id BIGINT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  monto NUMERIC(12, 2) NOT NULL,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  descripcion TEXT
);

-- ========================================
-- ÍNDICES
-- ========================================
CREATE INDEX idx_ordenes_cliente_id ON ordenes(cliente_id);
CREATE INDEX idx_items_orden_id ON items(orden_id);
CREATE INDEX idx_abonos_orden_id ON abonos(orden_id);
