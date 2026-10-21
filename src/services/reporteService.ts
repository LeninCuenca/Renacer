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

  async exportarNotaEntrega(orden: any): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Nota de Entrega')

      worksheet.columns = [
        { key: 'ot',       width: 12 },
        { key: 'cant',     width: 10 },
        { key: 'ct',       width: 12 },
        { key: 'marca',    width: 20 },
        { key: 'medida',   width: 20 },
        { key: 'serie',    width: 15 },
        { key: 'codigo',   width: 15 },
        { key: 'precio',   width: 20 },
      ]

      // Logo/Header space
      worksheet.mergeCells('A1:B3')
      worksheet.getCell('A1').value = 'RENACER'
      worksheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1a3a5e' } }
      worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }

      worksheet.mergeCells('F1:H3')
      const titleCell = worksheet.getCell('F1')
      titleCell.value = 'NOTA DE ENTREGA'
      titleCell.font = { bold: true, size: 22, color: { argb: 'FF1a3a5e' } }
      titleCell.alignment = { horizontal: 'right', vertical: 'middle' }

      // Subheaders
      worksheet.getCell('A5').value = 'CLIENTE'
      worksheet.getCell('A5').font = { bold: true }
      worksheet.getCell('B5').value = orden.cliente_nombre?.toUpperCase() || ''
      worksheet.getCell('B5').font = { bold: true, size: 12 }
      
      worksheet.getCell('A6').value = 'FECHA ENTREGA'
      worksheet.getCell('A6').font = { bold: true }
      worksheet.getCell('B6').value = new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })

      const numeroNota = `001-001-${String(orden.id).padStart(6, '0')}`
      worksheet.mergeCells('F5:H5')
      worksheet.getCell('F5').value = numeroNota
      worksheet.getCell('F5').font = { bold: true, size: 16 }
      worksheet.getCell('F5').alignment = { horizontal: 'center' }

      worksheet.mergeCells('F6:H6')
      worksheet.getCell('F6').value = `CREADO: ${new Date(orden.created_at || '').toLocaleDateString('es-EC')}`
      worksheet.getCell('F6').alignment = { horizontal: 'center' }
      worksheet.getCell('F6').font = { size: 10 }

      // Empty row
      worksheet.addRow([])

      // Table Header
      const headerRow = worksheet.addRow(['OT', 'CANT', 'CT', 'MARCA', 'MEDIDA', 'SERIE', 'CODIGO', 'PRECIO INC IVA'])
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.height = 25
      const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      headerRow.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3a5e' } }
        c.border = border as any
        c.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      // Items
      let totalCant = 0
      let totalPrecio = 0
      const itemsValidos = orden.items.filter((i: any) => !i.rechazo)
      itemsValidos.forEach((item: any) => {
        const row = worksheet.addRow([
          orden.numero,
          item.cantidad,
          item.id || '',
          item.marca || '',
          item.media || '',
          item.n_serie || '',
          item.diseno || '',
          item.valor_unitario
        ])
        row.eachCell((c, colNum) => {
          c.border = border as any
          c.alignment = { horizontal: 'center', vertical: 'middle' }
        })
        row.getCell(8).numFmt = '0.00'
        totalCant += item.cantidad
        totalPrecio += item.cantidad * item.valor_unitario
      })

      // Envío text
      const sendRow = worksheet.addRow([])
      worksheet.mergeCells(`A${sendRow.number}:H${sendRow.number}`)
      const sendCell = worksheet.getCell(`A${sendRow.number}`)
      
      const { data: clienteRes } = await supabase.from('clientes').select('direccion').eq('id', orden.cliente_id).single()
      const direccion = clienteRes?.direccion || 'BODEGA'
      sendCell.value = `ENVIO A ${direccion.toUpperCase()}`
      sendCell.alignment = { horizontal: 'center', vertical: 'middle' }
      sendCell.font = { bold: true }
      sendRow.height = 25

      // Total row
      const totRow = worksheet.addRow([])
      worksheet.mergeCells(`A${totRow.number}:B${totRow.number}`)
      totRow.getCell(1).value = 'TOTAL ITEMS DESPACHADOS'
      totRow.getCell(1).font = { bold: true }
      totRow.getCell(3).value = totalCant
      totRow.getCell(3).alignment = { horizontal: 'center' }
      totRow.getCell(3).font = { bold: true, size: 14 }
      
      worksheet.mergeCells(`E${totRow.number}:G${totRow.number}`)
      totRow.getCell(5).value = 'TOTAL'
      totRow.getCell(5).font = { bold: true, size: 14 }
      totRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
      totRow.getCell(8).value = totalPrecio
      totRow.getCell(8).numFmt = '0.00'
      totRow.getCell(8).font = { bold: true, size: 14 }
      totRow.getCell(8).border = border as any
      totRow.height = 30

      // Signatures
      worksheet.addRow([])
      worksheet.addRow([])
      worksheet.addRow([])
      const sigRow = worksheet.addRow(['', 'ENTREGADO', '', 'BODEGA', '', 'RECIBI CONFORME', ''])
      sigRow.eachCell((c, colNumber) => {
        if (c.value) {
          c.border = { top: { style: 'thin' } } as any
          c.alignment = { horizontal: 'center' }
          c.font = { bold: true }
        }
      })

      // Generate file
      const buffer   = await workbook.xlsx.writeBuffer()
      const fileName = `Nota_Entrega_${orden.numero}.xlsx`

      if (Capacitor.isNativePlatform()) {
        const base64Data = arrayBufferToBase64(buffer as ArrayBuffer)
        const savedFile  = await Filesystem.writeFile({
          path: fileName, data: base64Data, directory: Directory.Cache,
        })
        try {
          await Share.share({ title: `Nota de Entrega ${orden.numero}`, files: [savedFile.uri] })
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
      throw new Error(`Error al exportar nota de entrega: ${e instanceof Error ? e.message : 'Error desconocido'}`)
    }
  },

  async getReportePlantaData(): Promise<any[]> {
    const { data: evaluaciones, error } = await supabase
      .from('evaluaciones_llantas')
      .select('*')
      .neq('estado', 'pendiente')
      .order('updated_at', { ascending: false })
      .limit(3000)

    if (error) throw error
    if (!evaluaciones || evaluaciones.length === 0) return []

    const itemIds = [...new Set(evaluaciones.map(e => e.item_id))]
    const ordenIds = [...new Set(evaluaciones.map(e => e.orden_id))]

    const { data: items } = await supabase.from('items').select('*').in('id', itemIds)
    const { data: ordenes } = await supabase.from('ordenes').select('id, numero, cliente_id').in('id', ordenIds)
    
    const clienteIds = [...new Set((ordenes || []).map(o => o.cliente_id).filter(Boolean))]
    const { data: clientes } = await supabase.from('clientes').select('id, nombre').in('id', clienteIds)

    const itemsMap = new Map((items || []).map(i => [i.id, i]))
    const ordenesMap = new Map((ordenes || []).map(o => [o.id, o]))
    const clientesMap = new Map((clientes || []).map(c => [c.id, c]))

    const result = []

    for (const ev of evaluaciones) {
      if (ev.estado === 'pendiente') continue

      const it = itemsMap.get(ev.item_id)
      const ord = ordenesMap.get(ev.orden_id)
      const cli = ord ? clientesMap.get(ord.cliente_id) : null

      const dateObj = new Date(ev.updated_at || ev.created_at)
      const fechaStr = `${dateObj.getDate().toString().padStart(2, '0')}-${dateObj.toLocaleString('es-EC', { month: 'short' })}`

      const estadoTxt = ev.estado === 'valida' ? 'TERMINADA' : ev.estado === 'no_valida' ? 'RECHAZO' : ev.estado

      result.push({
        id: ev.id,
        fecha: fechaStr,
        orden: ord?.numero || '',
        cliente: cli?.nombre || 'Sin Cliente',
        marca: it?.marca || '',
        medida: it?.media || '',
        serie: it?.n_serie || '',
        numero_llanta: ev.numero_llanta,
        observaciones: ev.observaciones || it?.diseno || '',
        estado: estadoTxt
      })
    }

    // Ordenar primero por Orden (descendente) y luego por Numero de Llanta (ascendente)
    result.sort((a, b) => {
      if (a.orden > b.orden) return -1
      if (a.orden < b.orden) return 1
      return a.numero_llanta - b.numero_llanta
    })

    return result
  },

  async exportarReportePlanta(rango: 'dia' | 'semana' | 'mes'): Promise<void> {
    try {
      const ahora = new Date()
      let fechaInicio = new Date()
      
      if (rango === 'dia') {
        fechaInicio.setHours(0, 0, 0, 0)
      } else if (rango === 'semana') {
        const day = ahora.getDay()
        const diff = ahora.getDate() - day + (day === 0 ? -6 : 1) // Lunes
        fechaInicio.setDate(diff)
        fechaInicio.setHours(0, 0, 0, 0)
      } else if (rango === 'mes') {
        fechaInicio.setDate(1)
        fechaInicio.setHours(0, 0, 0, 0)
      }

      const { data: evaluaciones, error } = await supabase
        .from('evaluaciones_llantas')
        .select('*')
        .gte('updated_at', fechaInicio.toISOString())
        .order('updated_at', { ascending: true })

      if (error) throw error
      if (!evaluaciones || evaluaciones.length === 0) {
        throw new Error(`No hay llantas evaluadas en este periodo (${rango}).`)
      }

      const itemIds = [...new Set(evaluaciones.map(e => e.item_id))]
      const ordenIds = [...new Set(evaluaciones.map(e => e.orden_id))]

      const { data: items } = await supabase.from('items').select('*').in('id', itemIds)
      const { data: ordenes } = await supabase.from('ordenes').select('id, numero, cliente_id').in('id', ordenIds)
      
      const clienteIds = [...new Set((ordenes || []).map(o => o.cliente_id).filter(Boolean))]
      const { data: clientes } = await supabase.from('clientes').select('id, nombre').in('id', clienteIds)

      const itemsMap = new Map((items || []).map(i => [i.id, i]))
      const ordenesMap = new Map((ordenes || []).map(o => [o.id, o]))
      const clientesMap = new Map((clientes || []).map(c => [c.id, c]))

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Reporte Planta')

      worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Orden', key: 'orden', width: 12 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Marca', key: 'marca', width: 20 },
        { header: 'Medida', key: 'medida', width: 15 },
        { header: 'Serie', key: 'serie', width: 15 },
        { header: 'Item N°', key: 'numero_llanta', width: 10 },
        { header: 'Trabajo / Obs.', key: 'observaciones', width: 30 },
        { header: 'Estado', key: 'estado', width: 15 }
      ]

      // Estilo a la cabecera
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }

      for (const ev of evaluaciones) {
        // Solo exportamos las ya evaluadas
        if (ev.estado === 'pendiente') continue;

        const it = itemsMap.get(ev.item_id)
        const ord = ordenesMap.get(ev.orden_id)
        const cli = ord ? clientesMap.get(ord.cliente_id) : null

        const dateObj = new Date(ev.updated_at || ev.created_at)
        const fechaStr = `${dateObj.getDate().toString().padStart(2, '0')}-${dateObj.toLocaleString('es-EC', { month: 'short' })}`

        const estadoTxt = ev.estado === 'valida' ? 'TERMINADA' : ev.estado === 'no_valida' ? 'RECHAZO' : ev.estado

        const row = worksheet.addRow({
          fecha: fechaStr,
          orden: ord?.numero || '',
          cliente: cli?.nombre || 'Sin Cliente',
          marca: it?.marca || '',
          medida: it?.media || '',
          serie: it?.n_serie || '',
          numero_llanta: ev.numero_llanta,
          observaciones: ev.observaciones || it?.diseno || '',
          estado: estadoTxt
        })

        // Color al estado
        const cellEstado = row.getCell('estado')
        if (ev.estado === 'valida') {
          cellEstado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } } // verde
          cellEstado.font = { color: { argb: 'FF065F46' }, bold: true }
        } else if (ev.estado === 'no_valida') {
          cellEstado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } } // rojo
          cellEstado.font = { color: { argb: 'FF991B1B' }, bold: true }
        }
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const fileName = `Reporte_Planta_${rango}_${new Date().getTime()}.xlsx`

      if (Capacitor.isNativePlatform()) {
        const base64 = arrayBufferToBase64(buffer)
        const savedFile = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache })
        await Share.share({ title: fileName, url: savedFile.uri })
      } else {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url  = window.URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = fileName
        document.body.appendChild(a); a.click()
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url) }, 100)
      }
    } catch (e) {
      throw new Error(`Error al exportar reporte de planta: ${e instanceof Error ? e.message : 'Error desconocido'}`)
    }
  },

  async exportarDataPlanta(rows: any[], fileNamePrefix: string): Promise<void> {
    try {
      if (!rows || rows.length === 0) {
        throw new Error('No hay datos para exportar.')
      }

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Reporte Planta')

      worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Orden', key: 'orden', width: 12 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Marca', key: 'marca', width: 20 },
        { header: 'Medida', key: 'medida', width: 15 },
        { header: 'Serie', key: 'serie', width: 15 },
        { header: 'Item N°', key: 'numero_llanta', width: 10 },
        { header: 'Trabajo / Obs.', key: 'observaciones', width: 30 },
        { header: 'Estado', key: 'estado', width: 15 }
      ]

      // Estilo a la cabecera
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }

      for (const rowData of rows) {
        const row = worksheet.addRow({
          fecha: rowData.fecha,
          orden: rowData.orden,
          cliente: rowData.cliente,
          marca: rowData.marca,
          medida: rowData.medida,
          serie: rowData.serie,
          numero_llanta: rowData.numero_llanta,
          observaciones: rowData.observaciones,
          estado: rowData.estado
        })

        const cellEstado = row.getCell('estado')
        if (rowData.estado === 'TERMINADA') {
          cellEstado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
          cellEstado.font = { color: { argb: 'FF065F46' }, bold: true }
        } else if (rowData.estado === 'RECHAZO') {
          cellEstado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
          cellEstado.font = { color: { argb: 'FF991B1B' }, bold: true }
        }
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const fileName = `${fileNamePrefix}_${new Date().getTime()}.xlsx`

      if (Capacitor.isNativePlatform()) {
        const base64 = arrayBufferToBase64(buffer)
        const savedFile = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache })
        await Share.share({ title: fileName, url: savedFile.uri })
      } else {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url  = window.URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = fileName
        document.body.appendChild(a); a.click()
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url) }, 100)
      }
    } catch (e) {
      throw new Error(`Error al exportar reporte de planta: ${e instanceof Error ? e.message : 'Error desconocido'}`)
    }
  }
}
