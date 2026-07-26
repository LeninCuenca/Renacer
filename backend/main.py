"""
main.py — Servidor backend FastAPI para Renacer.

Endpoints:
- POST   /api/clientes              — Crear cliente
- GET    /api/clientes              — Listar clientes
- POST   /api/ordenes               — Crear orden con items
- GET    /api/ordenes               — Listar ordenes (con filtros)
- GET    /api/ordenes/{id}          — Detalle de orden
- POST   /api/ordenes/{id}/items    — Agregar item (llanta) a orden
- PATCH  /api/ordenes/{id}/estado   — Cambiar estado operativo + fecha
- POST   /api/ordenes/{id}/abonos   — Registrar abono (credito)
- GET    /api/ordenes/{id}/abonos   — Listar abonos de una orden
- POST   /api/ordenes/{id}/pago     — Definir tipo de pago de la orden
- GET    /api/reportes/mensual      — Exportar Excel mensual con Pandas
- GET    /api/reportes/resumen       — Resumen estadistico mensual
- GET    /api/health                — Health check
"""

from __future__ import annotations

import io
from datetime import datetime, date
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from database import (
    init_db, get_db, Session,
    Cliente, Orden, Item, Abono,
    EstadoOrden, TipoPago,
    calcular_estado_pago, recalcular_monto_total,
)

# ============================================================
# App
# ============================================================
app = FastAPI(
    title="Renacer API",
    description="Registro operativo, control de pagos y reportes",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ============================================================
# Schemas Pydantic
# ============================================================
class ClienteCreate(BaseModel):
    nombre: str
    cedula: str
    telefono: Optional[str] = None


class ClienteOut(BaseModel):
    id: int
    nombre: str
    cedula: str
    telefono: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ItemCreate(BaseModel):
    marca: Optional[str] = None
    n_serie: Optional[str] = None
    media: Optional[str] = None
    diseno: Optional[str] = None
    cantidad: int = 1
    valor_unitario: float = 0
    rechazo: bool = False
    observaciones: str = ""


class ItemOut(ItemCreate):
    id: int
    orden_id: int
    fecha_ingreso: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrdenCreate(BaseModel):
    numero: str
    cliente_id: int
    observaciones: str = ""
    items: List[ItemCreate] = Field(default_factory=list)


class OrdenOut(BaseModel):
    id: int
    numero: str
    cliente_id: int
    cliente_nombre: Optional[str] = None
    estado: EstadoOrden
    fecha_rc: Optional[datetime] = None
    fecha_ef: Optional[datetime] = None
    fecha_rf: Optional[datetime] = None
    fecha_bodega: Optional[datetime] = None
    fecha_ec: Optional[datetime] = None
    tipo_pago: Optional[TipoPago] = None
    monto_total: float
    monto_abonado: float
    monto_pendiente: float
    pagado_completo: bool
    activo_vigente: bool
    observaciones: str
    created_at: Optional[datetime] = None
    items: List[ItemOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class CambioEstado(BaseModel):
    estado: EstadoOrden
    fecha: Optional[datetime] = None  # si es None usa now()


class AbonoCreate(BaseModel):
    monto: float
    descripcion: Optional[str] = None


class AbonoOut(BaseModel):
    id: int
    orden_id: int
    monto: float
    fecha: datetime
    descripcion: Optional[str] = None

    class Config:
        from_attributes = True


class PagoCreate(BaseModel):
    tipo_pago: TipoPago


# ============================================================
# Helpers
# ============================================================
def orden_to_out(orden: Orden) -> dict:
    return {
        "id": orden.id,
        "numero": orden.numero,
        "cliente_id": orden.cliente_id,
        "cliente_nombre": orden.cliente.nombre if orden.cliente else None,
        "estado": orden.estado,
        "fecha_rc": orden.fecha_rc,
        "fecha_ef": orden.fecha_ef,
        "fecha_rf": orden.fecha_rf,
        "fecha_bodega": orden.fecha_bodega,
        "fecha_ec": orden.fecha_ec,
        "tipo_pago": orden.tipo_pago,
        "monto_total": float(orden.monto_total),
        "monto_abonado": float(orden.monto_abonado),
        "monto_pendiente": float(orden.monto_pendiente),
        "pagado_completo": orden.pagado_completo,
        "activo_vigente": orden.activo_vigente,
        "observaciones": orden.observaciones,
        "created_at": orden.created_at,
        "items": [
            {
                "id": it.id, "orden_id": it.orden_id,
                "marca": it.marca, "n_serie": it.n_serie,
                "media": it.media, "diseno": it.diseno,
                "cantidad": it.cantidad,
                "valor_unitario": float(it.valor_unitario),
                "rechazo": it.rechazo,
                "observaciones": it.observaciones,
                "fecha_ingreso": it.fecha_ingreso,
            }
            for it in orden.items
        ],
    }


# ============================================================
# Endpoints: Clientes
# ============================================================
@app.post("/api/clientes", response_model=ClienteOut, status_code=201)
def crear_cliente(body: ClienteCreate, db: Session = Depends(get_db)):
    exist = db.query(Cliente).filter(Cliente.cedula == body.cedula).first()
    if exist:
        raise HTTPException(409, "Ya existe un cliente con esa cedula")
    cli = Cliente(nombre=body.nombre, cedula=body.cedula, telefono=body.telefono)
    db.add(cli)
    db.commit()
    db.refresh(cli)
    return cli


@app.get("/api/clientes", response_model=List[ClienteOut])
def listar_clientes(db: Session = Depends(get_db)):
    return db.query(Cliente).order_by(Cliente.nombre).all()


# ============================================================
# Endpoints: Ordenes
# ============================================================
@app.post("/api/ordenes", response_model=OrdenOut, status_code=201)
def crear_orden(body: OrdenCreate, db: Session = Depends(get_db)):
    cli = db.query(Cliente).filter(Cliente.id == body.cliente_id).first()
    if not cli:
        raise HTTPException(404, "Cliente no encontrado")
    exist = db.query(Orden).filter(Orden.numero == body.numero).first()
    if exist:
        raise HTTPException(409, "Ya existe una orden con ese numero")

    orden = Orden(
        numero=body.numero,
        cliente_id=body.cliente_id,
        observaciones=body.observaciones,
        estado=EstadoOrden.recepcion,
        fecha_rc=datetime.utcnow(),
    )
    db.add(orden)
    db.flush()

    for it_data in body.items:
        item = Item(
            orden_id=orden.id,
            marca=it_data.marca,
            n_serie=it_data.n_serie,
            media=it_data.media,
            diseno=it_data.diseno,
            cantidad=it_data.cantidad,
            valor_unitario=it_data.valor_unitario,
            rechazo=it_data.rechazo,
            observaciones=it_data.observaciones,
        )
        db.add(item)

    db.flush()
    recalcular_monto_total(orden)
    calcular_estado_pago(orden)
    db.commit()
    db.refresh(orden)
    return orden_to_out(orden)


@app.get("/api/ordenes", response_model=List[OrdenOut])
def listar_ordenes(
    cliente_id: Optional[int] = Query(None),
    estado: Optional[EstadoOrden] = Query(None),
    pagado: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Orden)
    if cliente_id:
        q = q.filter(Orden.cliente_id == cliente_id)
    if estado:
        q = q.filter(Orden.estado == estado)
    if pagado is not None:
        q = q.filter(Orden.pagado_completo == pagado)
    ordenes = q.order_by(Orden.created_at.desc()).all()
    return [orden_to_out(o) for o in ordenes]


@app.get("/api/ordenes/{orden_id}", response_model=OrdenOut)
def obtener_orden(orden_id: int, db: Session = Depends(get_db)):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    return orden_to_out(orden)


@app.post("/api/ordenes/{orden_id}/items", response_model=OrdenOut)
def agregar_item(orden_id: int, body: ItemCreate, db: Session = Depends(get_db)):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    item = Item(
        orden_id=orden.id,
        marca=body.marca,
        n_serie=body.n_serie,
        media=body.media,
        diseno=body.diseno,
        cantidad=body.cantidad,
        valor_unitario=body.valor_unitario,
        rechazo=body.rechazo,
        observaciones=body.observaciones,
    )
    db.add(item)
    db.flush()
    recalcular_monto_total(orden)
    calcular_estado_pago(orden)
    db.commit()
    db.refresh(orden)
    return orden_to_out(orden)


@app.patch("/api/ordenes/{orden_id}/estado", response_model=OrdenOut)
def cambiar_estado(orden_id: int, body: CambioEstado, db: Session = Depends(get_db)):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    fecha = body.fecha or datetime.utcnow()
    orden.estado = body.estado
    if body.estado == EstadoOrden.recepcion:
        orden.fecha_rc = fecha
    elif body.estado == EstadoOrden.envio_fabrica:
        orden.fecha_ef = fecha
    elif body.estado == EstadoOrden.retorno_fabrica:
        orden.fecha_rf = fecha
    elif body.estado == EstadoOrden.en_bodega:
        orden.fecha_bodega = fecha
    elif body.estado == EstadoOrden.entregado:
        orden.fecha_ec = fecha
    db.commit()
    db.refresh(orden)
    return orden_to_out(orden)


# ============================================================
# Endpoints: Pagos y Abonos
# ============================================================
@app.post("/api/ordenes/{orden_id}/pago", response_model=OrdenOut)
def definir_pago(orden_id: int, body: PagoCreate, db: Session = Depends(get_db)):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    orden.tipo_pago = body.tipo_pago
    db.commit()
    db.refresh(orden)
    return orden_to_out(orden)


@app.post("/api/ordenes/{orden_id}/abonos", response_model=AbonoOut)
def registrar_abono(orden_id: int, body: AbonoCreate, db: Session = Depends(get_db)):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    abono = Abono(
        orden_id=orden.id,
        monto=body.monto,
        descripcion=body.descripcion,
    )
    db.add(abono)
    db.flush()
    calcular_estado_pago(orden)
    db.commit()
    db.refresh(abono)
    return abono


@app.get("/api/ordenes/{orden_id}/abonos", response_model=List[AbonoOut])
def listar_abonos(orden_id: int, db: Session = Depends(get_db)):
    return db.query(Abono).filter(Abono.orden_id == orden_id).order_by(Abono.fecha.desc()).all()


# ============================================================
# Reporte mensual con Pandas + Excel
# ============================================================
def _build_reporte_df(db: Session, anio: int, mes: int) -> pd.DataFrame:
    """Construye el DataFrame consolidado del mes con tiempos promedio."""
    inicio = date(anio, mes, 1)
    if mes == 12:
        fin = date(anio + 1, 1, 1)
    else:
        fin = date(anio, mes + 1, 1)

    ordenes = (
        db.query(Orden)
        .filter(Orden.created_at >= inicio, Orden.created_at < fin)
        .all()
    )

    filas = []
    for o in ordenes:
        total_cantidad = sum(int(i.cantidad) for i in o.items)
        rc = o.fecha_rc
        ef = o.fecha_ef
        rf = o.fecha_rf
        ec = o.fecha_ec

        def _diff_horas(a, b):
            if a and b:
                return round((b - a).total_seconds() / 3600, 1)
            return None

        filas.append({
            "Cantidad": total_cantidad,
            "Cliente": o.cliente.nombre if o.cliente else "",
            "Numero de orden": o.numero,
            "Recepcion de carcasa (RC)": rc.strftime("%Y-%m-%d %H:%M") if rc else "",
            "Envio a fabrica (EF)": ef.strftime("%Y-%m-%d %H:%M") if ef else "",
            "Retorno de fabrica (RF)": rf.strftime("%Y-%m-%d %H:%M") if rf else "",
            "Entrega cliente (EC)": ec.strftime("%Y-%m-%d %H:%M") if ec else "",
            "Promedio RC-RF (horas)": _diff_horas(rc, rf),
            "Promedio EF-RF (horas)": _diff_horas(ef, rf),
            "Promedio RC-EC (horas)": _diff_horas(rc, ec),
            "Observaciones": "",
        })

    df = pd.DataFrame(filas, columns=[
        "Cantidad", "Cliente", "Numero de orden",
        "Recepcion de carcasa (RC)", "Envio a fabrica (EF)",
        "Retorno de fabrica (RF)", "Entrega cliente (EC)",
        "Promedio RC-RF (horas)", "Promedio EF-RF (horas)",
        "Promedio RC-EC (horas)", "Observaciones",
    ])

    # Fila de totales
    if not df.empty:
        total_fila = {
            "Cantidad": int(df["Cantidad"].sum()),
            "Cliente": "TOTAL",
            "Numero de orden": "",
            "Recepcion de carcasa (RC)": "",
            "Envio a fabrica (EF)": "",
            "Retorno de fabrica (RF)": "",
            "Entrega cliente (EC)": "",
            "Promedio RC-RF (horas)": round(df["Promedio RC-RF (horas)"].dropna().mean(), 1) if df["Promedio RC-RF (horas)"].notna().any() else "",
            "Promedio EF-RF (horas)": round(df["Promedio EF-RF (horas)"].dropna().mean(), 1) if df["Promedio EF-RF (horas)"].notna().any() else "",
            "Promedio RC-EC (horas)": round(df["Promedio RC-EC (horas)"].dropna().mean(), 1) if df["Promedio RC-EC (horas)"].notna().any() else "",
            "Observaciones": "",
        }
        df = pd.concat([df, pd.DataFrame([total_fila])], ignore_index=True)

    return df


@app.get("/api/reportes/mensual")
def exportar_reporte_mensual(
    anio: int = Query(..., description="Anio del reporte"),
    mes: int = Query(..., ge=1, le=12, description="Mes del reporte (1-12)"),
    db: Session = Depends(get_db),
):
    df = _build_reporte_df(db, anio, mes)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Reporte Mensual")
        ws = writer.sheets["Reporte Mensual"]
        for col in ws.columns:
            max_len = max((len(str(c.value)) for c in col if c.value is not None), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)
    output.seek(0)
    nombre = f"reporte_renacer_{anio}_{mes:02d}.xlsx"
    headers = {
        "Content-Disposition": f'attachment; filename="{nombre}"',
    }
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@app.get("/api/reportes/resumen")
def resumen_mensual(
    anio: int = Query(...),
    mes: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    df = _build_reporte_df(db, anio, mes)
    data_rows = df[df["Cliente"] != "TOTAL"] if not df.empty else df
    return {
        "anio": anio,
        "mes": mes,
        "total_ordenes": len(data_rows),
        "total_cantidad": int(data_rows["Cantidad"].sum()) if not data_rows.empty else 0,
        "promedio_rc_rf_horas": round(float(data_rows["Promedio RC-RF (horas)"].dropna().mean()), 1) if not data_rows.empty and data_rows["Promedio RC-RF (horas)"].notna().any() else None,
        "promedio_ef_rf_horas": round(float(data_rows["Promedio EF-RF (horas)"].dropna().mean()), 1) if not data_rows.empty and data_rows["Promedio EF-RF (horas)"].notna().any() else None,
        "promedio_rc_ec_horas": round(float(data_rows["Promedio RC-EC (horas)"].dropna().mean()), 1) if not data_rows.empty and data_rows["Promedio RC-EC (horas)"].notna().any() else None,
    }


# ============================================================
# Health check
# ============================================================
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "renacer-api", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
