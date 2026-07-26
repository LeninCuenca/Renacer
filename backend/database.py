"""
database.py — Modelos relacionales con SQLAlchemy para Renacer.

Cubre:
- Cliente (1) -> (N) Orden
- Orden (1) -> (N) Item (llanta)
- Item: marca, n_serie, media, diseno, valor, rechazo, observaciones
- Estados operativos con fechas de trazabilidad (RC, EF, RF, bodega, EC)
- Pagos: contado, diferido, credito (30/60/90), cheque, transferencia
- Abonos individuales para creditos
- Estado automatico "Activo o vigente" al pagar completo
"""

from __future__ import annotations

import enum
from datetime import datetime, date
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Boolean,
    DateTime, Date, Numeric, Enum as SAEnum, ForeignKey, func,
)
from sqlalchemy.orm import (
    declarative_base, relationship, sessionmaker, Session,
)
from typing import Optional


# ============================================================
# Configuracion de la base de datos (SQLite por defecto;
# cambiar DATABASE_URL a postgres para produccion)
# ============================================================
DATABASE_URL = "sqlite:///./renacer.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ============================================================
# Enums de dominio
# ============================================================
class TipoPago(enum.Enum):
    contado = "Contado"
    diferido_efectivo = "Diferido en efectivo"
    credito_30 = "Credito 30 dias"
    credito_60 = "Credito 60 dias"
    credito_90 = "Credito 90 dias"
    cheque = "Cheque"
    transferencia = "Transferencia"


class EstadoOrden(enum.Enum):
    recepcion = "Recepcion"
    envio_fabrica = "Envio a fabrica"
    retorno_fabrica = "Retorno de fabrica"
    en_bodega = "En bodega"
    entregado = "Entregado al cliente"


# ============================================================
# Modelo: Cliente
# ============================================================
class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    cedula = Column(String(20), unique=True, nullable=False, index=True)
    telefono = Column(String(30), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    ordenes = relationship("Orden", back_populates="cliente", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Cliente id={self.id} nombre={self.nombre!r} cedula={self.cedula!r}>"


# ============================================================
# Modelo: Orden de trabajo
# ============================================================
class Orden(Base):
    __tablename__ = "ordenes"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(50), unique=True, nullable=False, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)

    # Estado operativo actual
    estado = Column(
        SAEnum(EstadoOrden, name="estado_orden", native_enum=False),
        default=EstadoOrden.recepcion,
        nullable=False,
    )

    # Fechas de trazabilidad (una por cada cambio de estado)
    fecha_rc = Column(DateTime, nullable=True)   # Recepcion de carcasa
    fecha_ef = Column(DateTime, nullable=True)   # Envio a fabrica
    fecha_rf = Column(DateTime, nullable=True)   # Retorno de fabrica
    fecha_bodega = Column(DateTime, nullable=True)  # En bodega
    fecha_ec = Column(DateTime, nullable=True)   # Entrega al cliente

    # Pago
    tipo_pago = Column(
        SAEnum(TipoPago, name="tipo_pago", native_enum=False),
        nullable=True,
    )
    monto_total = Column(Numeric(12, 2), default=0, nullable=False)
    monto_abonado = Column(Numeric(12, 2), default=0, nullable=False)
    monto_pendiente = Column(Numeric(12, 2), default=0, nullable=False)
    pagado_completo = Column(Boolean, default=False, nullable=False)
    activo_vigente = Column(Boolean, default=False, nullable=False)

    observaciones = Column(Text, default="", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    cliente = relationship("Cliente", back_populates="ordenes")
    items = relationship("Item", back_populates="orden", cascade="all, delete-orphan")
    abonos = relationship("Abono", back_populates="orden", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Orden id={self.id} numero={self.numero!r} estado={self.estado}>"


# ============================================================
# Modelo: Item / Llanta (cantidades por orden)
# ============================================================
class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    orden_id = Column(Integer, ForeignKey("ordenes.id", ondelete="CASCADE"), nullable=False)

    marca = Column(String(100), nullable=True)
    n_serie = Column(String(100), nullable=True)
    media = Column(String(50), nullable=True)
    diseno = Column(String(100), nullable=True)
    cantidad = Column(Integer, default=1, nullable=False)
    valor_unitario = Column(Numeric(12, 2), default=0, nullable=False)
    rechazo = Column(Boolean, default=False, nullable=False)
    observaciones = Column(Text, default="", nullable=False)
    fecha_ingreso = Column(DateTime, default=datetime.utcnow, nullable=False)

    orden = relationship("Orden", back_populates="items")

    def __repr__(self) -> str:
        return f"<Item id={self.id} marca={self.marca!r} cantidad={self.cantidad}>"


# ============================================================
# Modelo: Abono (para pagos a credito)
# ============================================================
class Abono(Base):
    __tablename__ = "abonos"

    id = Column(Integer, primary_key=True, index=True)
    orden_id = Column(Integer, ForeignKey("ordenes.id", ondelete="CASCADE"), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    fecha = Column(DateTime, default=datetime.utcnow, nullable=False)
    descripcion = Column(String(300), nullable=True)

    orden = relationship("Orden", back_populates="abonos")

    def __repr__(self) -> str:
        return f"<Abono id={self.id} orden_id={self.orden_id} monto={self.monto}>"


# ============================================================
# Utilidades
# ============================================================
def init_db() -> None:
    """Crea todas las tablas en la base de datos."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Generador de sesion para FastAPI Depends."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def calcular_estado_pago(orden: Orden) -> None:
    """
    Recalcula monto_abonado, monto_pendiente, pagado_completo y activo_vigente
    en base al monto_total y los abonos registrados.
    """
    total_abonos = sum(float(a.monto) for a in orden.abonos)
    orden.monto_abonado = round(total_abonos, 2)
    orden.monto_pendiente = round(float(orden.monto_total) - total_abonos, 2)
    if orden.monto_pendiente <= 0:
        orden.pagado_completo = True
        orden.activo_vigente = True
    else:
        orden.pagado_completo = False
        orden.activo_vigente = False


def recalcular_monto_total(orden: Orden) -> None:
    """Recalcula monto_total sumando cantidad * valor_unitario de cada item."""
    total = sum(int(i.cantidad) * float(i.valor_unitario) for i in orden.items)
    orden.monto_total = round(total, 2)
