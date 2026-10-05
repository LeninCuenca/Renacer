import { supabase } from './supabaseClient'
import type { ResumenReporte } from '../types'
import { diffDias, arrayBufferToBase64 } from './helpers'
import ExcelJS from 'exceljs'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// ============================================================
// Servicio de Reportes — Resumen mensual + Excel
// ============================================================

export const reporteService = {
  async getResumenMensual(anio: number, mes: number): Promise<ResumenReporte | null> {
    const { data: ordenes, error } = await supabase
      .from('ordenes')
      .select('*')
      .gte('created_at', `${anio}-${String(mes).padStart(2, '0')}-01`)
      .lt('created_at', `${anio}-${String(mes + 1).padStart(2, '0')}-01`)

    if (error) throw error

    if (!ordenes || ordenes.length === 0) return null

    let total_cantidad = 0
    let suma_rc_rf = 0
    let suma_ef_rf = 0
    let suma_rc_ec = 0
    let count_rc_rf = 0
    let count_ef_rf = 0
    let count_rc_ec = 0

    for (const orden of ordenes) {
      const { data: items } = await supabase
        .from('items')
        .select('cantidad')
        .eq('orden_id', orden.id)
        .not('rechazo', 'is', true)

      total_cantidad += (items || []).reduce((s, i) => s + i.cantidad, 0)

      if (orden.fecha_rc && orden.fecha_rf) {
        suma_rc_rf += diffDias(orden.fecha_rc, orden.fecha_rf) || 0
        count_rc_rf++
      }

      if (orden.fecha_ef && orden.fecha_rf) {
        suma_ef_rf += diffDias(orden.fecha_ef, orden.fecha_rf) || 0
        count_ef_rf++
      }

      if (orden.fecha_rc && orden.fecha_ec) {
        suma_rc_ec += diffDias(orden.fecha_rc, orden.fecha_ec) || 0
        count_rc_ec++
      }
    }

    return {
      anio,
      mes,
      total_ordenes: ordenes.length,
      total_cantidad,
      promedio_rc_rf_dias: count_rc_rf > 0 ? Math.round(suma_rc_rf / count_rc_rf) : null,
      promedio_ef_rf_dias: count_ef_rf > 0 ? Math.round(suma_ef_rf / count_ef_rf) : null,
      promedio_rc_ec_dias: count_rc_ec > 0 ? Math.round(suma_rc_ec / count_rc_ec) : null,
    }
  },

  async exportarExcelMensual(anio: number, mes: number): Promise<void> {
    try {
      const anioSiguiente = mes === 12 ? anio + 1 : anio
      const mesSiguiente  = mes === 12 ? 1 : mes + 1

      const { data: ordenes, error } = await supabase
        .from('ordenes')
        .select('*')
        .gte('created_at', `${anio}-${String(mes).padStart(2, '0')}-01`)
        .lt('created_at', `${anioSiguiente}-${String(mesSiguiente).padStart(2, '0')}-01`)
        .order('created_at', { ascending: true })

      if (error) throw error
      if (!ordenes || ordenes.length === 0) {
        throw new Error('No hay ordenes registradas en el periodo seleccionado.')
      }

      const ordenIds  = ordenes.map(o => o.id)
      const clienteIds = [...new Set(ordenes.map(o => o.cliente_id).filter(Boolean))]

      const [{ data: todosItems }, { data: todosClientes }, { data: todosAbonos }] = await Promise.all([
        supabase.from('items').select('*').in('orden_id', ordenIds),
        supabase.from('clientes').select('*').in('id', clienteIds),
        supabase.from('abonos').select('orden_id, monto').in('orden_id', ordenIds),
      ])

      const itemsPorOrden = new Map<number, any[]>()
      for (const it of todosItems || []) {
        if (!itemsPorOrden.has(it.orden_id)) itemsPorOrden.set(it.orden_id, [])
        itemsPorOrden.get(it.orden_id)!.push(it)
      }
      const clientePorId = new Map((todosClientes || []).map(c => [c.id, c]))

      // Calcular abonados reales por orden
      const abonadoPorOrden = new Map<number, number>()
      for (const ab of todosAbonos || []) {
        abonadoPorOrden.set(ab.orden_id, (abonadoPorOrden.get(ab.orden_id) || 0) + Number(ab.monto))
      }

      // ── Crear workbook ──
      const workbook = new ExcelJS.Workbook()
      const sheetName = `${String(mes).padStart(2, '0')}-${anio}`
      const worksheet = workbook.addWorksheet(sheetName)

      // ── Estilos ──
      const estiloHeader: any = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3a5e' } },
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          left:   { style: 'thin' }, right: { style: 'thin' },
          top:    { style: 'thin' }, bottom: { style: 'thin' },
        },
      }
      const estiloTexto: any = {
        border: {
          left:   { style: 'thin' }, right: { style: 'thin' },
          top:    { style: 'thin' }, bottom: { style: 'thin' },
        },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
      const estiloNum: any = {
        border: {
          left:   { style: 'thin' }, right: { style: 'thin' },
          top:    { style: 'thin' }, bottom: { style: 'thin' },
        },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: '0.00',
      }
      const estiloNumCentro: any = { ...estiloNum, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '0' }

      // ── Columnas ──
      worksheet.columns = [
        { key: 'cliente',    width: 22 },
        { key: 'direccion',  width: 18 },
        { key: 'numero',     width: 13 },
        { key: 'cantidad',   width: 14 },
        { key: 'fecha_rc',   width: 15 },
        { key: 'fecha_ec',   width: 15 },
        { key: 'total',      width: 13 },
        { key: 'abonado',    width: 13 },
        { key: 'pendiente',  width: 13 },
        { key: 'estado',     width: 22 },
      ]

      // ── Fila de cabecera ──
      const HEADERS = [
        'Cliente', 'Dirección', 'Nº Orden', 'Cant. (válida)',
        'Recepción (RC)', 'Entrega (EC)',
        'Total', 'Abonado', 'Pendiente', 'Estado',
      ]
      const headerRow = worksheet.addRow(HEADERS)
      headerRow.height = 30
      headerRow.eachCell(cell => { cell.style = estiloHeader })

      // ── Filas de datos ──
      for (const orden of ordenes) {
        const cliente = clientePorId.get(orden.cliente_id)
        const itemsValidos = (itemsPorOrden.get(orden.id) || []).filter((it: any) => !it.rechazo)
        const cantValida   = itemsValidos.reduce((s: number, it: any) => s + it.cantidad, 0)
        const montoTotal   = Math.round(itemsValidos.reduce((s: number, it: any) => s + it.cantidad * Number(it.valor_unitario), 0) * 100) / 100
        const montoAbonado = Math.round((abonadoPorOrden.get(orden.id) || 0) * 100) / 100
        const montoPend    = Math.round((montoTotal - montoAbonado) * 100) / 100

        const fmtFecha = (f?: string | null) =>
          f ? new Date(f).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

        const row = worksheet.addRow([
          cliente?.nombre    || '',
          cliente?.direccion || '',
          orden.numero,
          cantValida,
          fmtFecha(orden.fecha_rc),
          fmtFecha(orden.fecha_ec),
          montoTotal,
          montoAbonado,
          montoPend,
          orden.estado,
        ])
        row.height = 18
        row.getCell(1).style  = estiloTexto
        row.getCell(2).style  = estiloTexto
        row.getCell(3).style  = estiloTexto
        row.getCell(4).style  = estiloNumCentro
        row.getCell(5).style  = estiloTexto
        row.getCell(6).style  = estiloTexto
        row.getCell(7).style  = estiloNum
        row.getCell(8).style  = estiloNum
        row.getCell(9).style  = estiloNum
        row.getCell(10).style = estiloTexto
      }

      // ── Generar y descargar ──
      const buffer   = await workbook.xlsx.writeBuffer()
      const fileName = `Reporte_Renacer_${String(mes).padStart(2, '0')}_${anio}.xlsx`

      if (Capacitor.isNativePlatform()) {
        const base64Data = arrayBufferToBase64(buffer as ArrayBuffer)
        const savedFile  = await Filesystem.writeFile({
          path: fileName, data: base64Data, directory: Directory.Cache,
        })
        try {
          await Share.share({
            title: 'Reporte Mensual Renacer',
            files: [savedFile.uri],
            dialogTitle: 'Compartir o guardar Excel',
          })
        } catch (shareError) {
          const msg = shareError instanceof Error ? shareError.message : String(shareError)
          if (!/cancel/i.test(msg)) throw shareError
        }
      } else {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url  = window.URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = fileName
        document.body.appendChild(a); a.click()
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url) }, 100)
      }
    } catch (e) {
      throw new Error(`Error al exportar Excel: ${e instanceof Error ? e.message : 'Error desconocido'}`)
    }
  },
}
