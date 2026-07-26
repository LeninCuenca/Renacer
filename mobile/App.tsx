/**
 * App.tsx — Aplicacion movil Renacer (React Native / Expo)
 *
 * Pantallas:
 * 1. Clientes  — listar y crear clientes
 * 2. Nueva Orden — crear orden con items dinamicos (llantas)
 * 3. Ordenes   — listar ordenes, cambiar estado, registrar abonos
 * 4. Reporte   — exportar Excel mensual
 *
 * Colores: Amarillo patito #F7D132 (primario), Azul marino #1B263B (secundario)
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ScrollView, Alert, Modal, ActivityIndicator, StatusBar,
  Platform, RefreshControl,
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'

// ============================================================
// Configuracion
// ============================================================
const API_BASE = 'http://10.0.2.2:8000/api' // Android emulator -> localhost
// Para iOS simulator usar: 'http://localhost:8000/api'
// Para dispositivo fisico usar la IP del PC: 'http://192.168.x.x:8000/api'

const COLORS = {
  primary: '#F7D132',
  primaryDark: '#E8B91F',
  primaryLight: '#FEF9E7',
  navy: '#1B263B',
  navyLight: '#2E4366',
  navyDark: '#101827',
  white: '#FFFFFF',
  bg: '#F4F5F7',
  textDark: '#1B263B',
  textLight: '#8E9DB3',
  textMuted: '#C7CFDA',
  border: '#E8ECF1',
  green: '#22C55E',
  greenBg: '#DCFCE7',
  red: '#EF4444',
  redBg: '#FEE2E2',
  orange: '#F59E0B',
  orangeBg: '#FEF3C7',
}

// ============================================================
// Tipos
// ============================================================
interface Cliente {
  id: number
  nombre: string
  cedula: string
  telefono?: string | null
}

interface Item {
  id?: number
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

interface Orden {
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
  items: Item[]
}

type EstadoOrden = 'Recepcion' | 'Envio a fabrica' | 'Retorno de fabrica' | 'En bodega' | 'Entregado al cliente'
type TipoPago = 'Contado' | 'Diferido en efectivo' | 'Credito 30 dias' | 'Credito 60 dias' | 'Credito 90 dias' | 'Cheque' | 'Transferencia'

interface ResumenReporte {
  anio: number
  mes: number
  total_ordenes: number
  total_cantidad: number
  promedio_rc_rf_horas: number | null
  promedio_ef_rf_horas: number | null
  promedio_rc_ec_horas: number | null
}

const ESTADOS: EstadoOrden[] = ['Recepcion', 'Envio a fabrica', 'Retorno de fabrica', 'En bodega', 'Entregado al cliente']
const TIPOS_PAGO: TipoPago[] = ['Contado', 'Diferido en efectivo', 'Credito 30 dias', 'Credito 60 dias', 'Credito 90 dias', 'Cheque', 'Transferencia']

// ============================================================
// API helper
// ============================================================
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let msg = `Error ${res.status}`
    try { const j = await res.json(); msg = j.detail || msg } catch { /* noop */ }
    throw new Error(msg)
  }
  return res.json()
}

// ============================================================
// Componente principal
// ============================================================
type Tab = 'clientes' | 'nueva' | 'ordenes' | 'reporte'

export default function App() {
  const [tab, setTab] = useState<Tab>('ordenes')

  return (
    <SafeAreaView style={S.container}>
      <ExpoStatusBar style="light" />
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {/* Header */}
      <View style={S.header}>
        <View style={S.headerLogo}>
          <Text style={S.headerLogoText}>R</Text>
        </View>
        <View>
          <Text style={S.headerTitle}>Renacer</Text>
          <Text style={S.headerSubtitle}>Registro Operativo</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={S.tabBar}>
        <TabBtn label="Ordenes" active={tab === 'ordenes'} onPress={() => setTab('ordenes')} />
        <TabBtn label="Nueva" active={tab === 'nueva'} onPress={() => setTab('nueva')} />
        <TabBtn label="Clientes" active={tab === 'clientes'} onPress={() => setTab('clientes')} />
        <TabBtn label="Reporte" active={tab === 'reporte'} onPress={() => setTab('reporte')} />
      </View>

      {/* Contenido */}
      <ScrollView style={S.content} keyboardShouldPersistTaps="handled">
        {tab === 'ordenes' && <OrdenesScreen />}
        {tab === 'nueva' && <NuevaOrdenScreen onCreated={() => setTab('ordenes')} />}
        {tab === 'clientes' && <ClientesScreen />}
        {tab === 'reporte' && <ReporteScreen />}
      </ScrollView>
    </SafeAreaView>
  )
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[S.tabBtn, active && S.tabBtnActive]} onPress={onPress}>
      <Text style={[S.tabBtnText, active && S.tabBtnTextActive]}>{label}</Text>
      {active && <View style={S.tabIndicator} />}
    </TouchableOpacity>
  )
}

// ============================================================
// Pantalla: Clientes
// ============================================================
function ClientesScreen() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const data = await api<Cliente[]>('/clientes')
      setClientes(data)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const onRefresh = () => { setRefreshing(true); cargar() }

  const guardar = async () => {
    if (!nombre.trim() || !cedula.trim()) {
      Alert.alert('Faltan datos', 'Nombre y cedula son obligatorios')
      return
    }
    setSaving(true)
    try {
      await api('/clientes', {
        method: 'POST',
        body: JSON.stringify({ nombre, cedula, telefono: telefono || null }),
      })
      setNombre(''); setCedula(''); setTelefono('')
      setShowForm(false)
      cargar()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingView />

  return (
    <View style={S.screen}>
      <View style={S.screenHeader}>
        <Text style={S.screenTitle}>Clientes</Text>
        <TouchableOpacity style={S.btnPrimary} onPress={() => setShowForm(!showForm)}>
          <Text style={S.btnPrimaryText}>{showForm ? 'Cancelar' : '+ Nuevo'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={S.card}>
          <Text style={S.cardTitle}>Nuevo Cliente</Text>
          <Input label="Nombre completo *" value={nombre} onChange={setNombre} placeholder="Juan Perez" />
          <Input label="Cedula *" value={cedula} onChange={setCedula} placeholder="1700000000" keyboardType="numeric" />
          <Input label="Telefono" value={telefono} onChange={setTelefono} placeholder="098 765 4321" keyboardType="phone-pad" />
          <TouchableOpacity style={[S.btnPrimary, { marginTop: 12 }]} onPress={guardar} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.navy} /> : <Text style={S.btnPrimaryText}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={clientes}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        renderItem={({ item }) => (
          <View style={S.card}>
            <Text style={S.clientName}>{item.nombre}</Text>
            <Text style={S.clientDetail}>Cedula: {item.cedula}</Text>
            {item.telefono ? <Text style={S.clientDetail}>Tel: {item.telefono}</Text> : null}
          </View>
        )}
        ListEmptyComponent={<EmptyState text="No hay clientes registrados" />}
        scrollEnabled={false}
      />
    </View>
  )
}

// ============================================================
// Pantalla: Nueva Orden
// ============================================================
function NuevaOrdenScreen({ onCreated }: { onCreated: () => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState<number>(0)
  const [numero, setNumero] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<Item[]>([nuevoItem()])
  const [saving, setSaving] = useState(false)

  function nuevoItem(): Item {
    return { marca: '', n_serie: '', media: '', diseno: '', cantidad: 1, valor_unitario: 0, rechazo: false, observaciones: '' }
  }

  useEffect(() => {
    api<Cliente[]>('/clientes').then(setClientes).catch(() => {})
  }, [])

  const updateItem = (idx: number, campo: keyof Item, valor: string | boolean | number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  const agregarItem = () => setItems(prev => [...prev, nuevoItem()])
  const quitarItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const totalEstimado = items.reduce((sum, it) => sum + (it.cantidad * it.valor_unitario), 0)

  const guardar = async () => {
    if (!clienteId || !numero.trim()) {
      Alert.alert('Faltan datos', 'Seleccione cliente e ingrese numero de orden')
      return
    }
    setSaving(true)
    try {
      await api('/ordenes', {
        method: 'POST',
        body: JSON.stringify({
          numero, cliente_id: clienteId, observaciones,
          items: items.map(it => ({
            marca: it.marca || null, n_serie: it.n_serie || null,
            media: it.media || null, diseno: it.diseno || null,
            cantidad: it.cantidad, valor_unitario: it.valor_unitario,
            rechazo: it.rechazo, observaciones: it.observaciones,
          })),
        }),
      })
      Alert.alert('Exito', 'Orden creada correctamente', [{ text: 'OK', onPress: onCreated }])
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al crear orden')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={S.screen}>
      <Text style={S.screenTitle}>Nueva Orden de Trabajo</Text>

      {/* Datos generales */}
      <View style={S.card}>
        <Text style={S.cardTitle}>Datos Generales</Text>
        <Text style={S.label}>Cliente *</Text>
        <View style={S.pickerWrap}>
          <Picker
            selectedValue={clienteId}
            onValueChange={(v) => setClienteId(Number(v))}
            style={S.picker}
            dropdownIconColor={COLORS.navy}
          >
            <Picker.Item label="Seleccione..." value={0} />
            {clientes.map(c => <Picker.Item key={c.id} label={`${c.nombre} — ${c.cedula}`} value={c.id} />)}
          </Picker>
        </View>
        <Input label="Numero de orden *" value={numero} onChange={setNumero} placeholder="OT-0001" />
        <Input label="Observaciones" value={observaciones} onChange={setObservaciones} placeholder="Notas..." multiline />
      </View>

      {/* Items dinamicos */}
      <View style={S.card}>
        <View style={S.cardHeaderRow}>
          <Text style={S.cardTitle}>Items / Llantas</Text>
          <TouchableOpacity style={S.btnSmall} onPress={agregarItem}>
            <Text style={S.btnSmallText}>+ Agregar</Text>
          </TouchableOpacity>
        </View>

        {items.map((it, idx) => (
          <View key={idx} style={S.itemBlock}>
            <View style={S.itemHeader}>
              <Text style={S.itemTitle}>Item #{idx + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => quitarItem(idx)}>
                  <Text style={S.removeBtn}>Quitar</Text>
                </TouchableOpacity>
              )}
            </View>
            <Input label="Marca" value={it.marca || ''} onChange={(v) => updateItem(idx, 'marca', v)} placeholder="Ej. Michelin" />
            <Input label="N° Serie" value={it.n_serie || ''} onChange={(v) => updateItem(idx, 'n_serie', v)} placeholder="ABC123" />
            <Input label="Media" value={it.media || ''} onChange={(v) => updateItem(idx, 'media', v)} placeholder="Ej. 14" />
            <Input label="Diseno" value={it.diseno || ''} onChange={(v) => updateItem(idx, 'diseno', v)} placeholder="Ej. Rayado" />
            <View style={S.row}>
              <View style={S.col}>
                <Input label="Cantidad" value={String(it.cantidad)} onChange={(v) => updateItem(idx, 'cantidad', parseInt(v) || 1)} placeholder="1" keyboardType="numeric" />
              </View>
              <View style={S.col}>
                <Input label="Valor unit." value={String(it.valor_unitario)} onChange={(v) => updateItem(idx, 'valor_unitario', parseFloat(v) || 0)} placeholder="0.00" keyboardType="numeric" />
              </View>
            </View>
            <TouchableOpacity
              style={[S.checkboxRow, { marginTop: 8 }]}
              onPress={() => updateItem(idx, 'rechazo', !it.rechazo)}
            >
              <View style={[S.checkbox, it.rechazo && S.checkboxChecked]}>
                {it.rechazo && <Text style={S.checkmark}>✓</Text>}
              </View>
              <Text style={S.checkboxLabel}>Rechazo</Text>
            </TouchableOpacity>
            <Input label="Observaciones del item" value={it.observaciones} onChange={(v) => updateItem(idx, 'observaciones', v)} placeholder="Notas del item..." multiline />
          </View>
        ))}

        <View style={S.totalRow}>
          <Text style={S.totalLabel}>Total estimado:</Text>
          <Text style={S.totalValue}>${totalEstimado.toFixed(2)}</Text>
        </View>
      </View>

      <TouchableOpacity style={S.btnPrimary} onPress={guardar} disabled={saving}>
        {saving ? <ActivityIndicator color={COLORS.navy} /> : <Text style={S.btnPrimaryText}>Crear Orden</Text>}
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </View>
  )
}

// ============================================================
// Pantalla: Ordenes
// ============================================================
function OrdenesScreen() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Orden | null>(null)

  const cargar = useCallback(async () => {
    try {
      const data = await api<Orden[]>('/ordenes')
      setOrdenes(data)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return <LoadingView />

  return (
    <View style={S.screen}>
      <Text style={S.screenTitle}>Ordenes de Trabajo</Text>
      <FlatList
        data={ordenes}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar() }} colors={[COLORS.primary]} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={S.card} onPress={() => setSelected(item)}>
            <View style={S.ordenHeader}>
              <Text style={S.ordenNumero}>{item.numero}</Text>
              <EstadoBadge estado={item.estado} />
            </View>
            <Text style={S.clientName}>{item.cliente_nombre || 'Cliente'}</Text>
            <View style={S.ordenMeta}>
              <Text style={S.metaText}>{item.items.length} items</Text>
              <Text style={S.metaText}>Total: ${item.monto_total.toFixed(2)}</Text>
              {item.pagado_completo
                ? <Text style={[S.metaText, { color: COLORS.green, fontWeight: '700' }]}>Pagado</Text>
                : <Text style={[S.metaText, { color: COLORS.red }]}>Pend: ${item.monto_pendiente.toFixed(2)}</Text>}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState text="No hay ordenes registradas" />}
        scrollEnabled={false}
      />

      {selected && <OrdenDetalleModal orden={selected} onClose={() => { setSelected(null); cargar() }} />}
    </View>
  )
}

function OrdenDetalleModal({ orden, onClose }: { orden: Orden; onClose: () => void }) {
  const [abonoMonto, setAbonoMonto] = useState('')
  const [tipoPago, setTipoPago] = useState<string>(orden.tipo_pago || '')
  const [saving, setSaving] = useState(false)

  const cambiarEstado = async (estado: EstadoOrden) => {
    try {
      await api(`/ordenes/${orden.id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      })
      Alert.alert('Estado actualizado', estado)
      onClose()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error')
    }
  }

  const registrarAbono = async () => {
    const monto = parseFloat(abonoMonto)
    if (!monto || monto <= 0) {
      Alert.alert('Invalido', 'Ingrese un monto valido')
      return
    }
    setSaving(true)
    try {
      await api(`/ordenes/${orden.id}/abonos`, {
        method: 'POST',
        body: JSON.stringify({ monto }),
      })
      setAbonoMonto('')
      Alert.alert('Abono registrado', `$${monto.toFixed(2)}`)
      onClose()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const definirPago = async () => {
    if (!tipoPago) return
    try {
      await api(`/ordenes/${orden.id}/pago`, {
        method: 'POST',
        body: JSON.stringify({ tipo_pago: tipoPago }),
      })
      Alert.alert('Tipo de pago definido', tipoPago)
      onClose()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalContent}>
          <ScrollView>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Orden {orden.numero}</Text>
              <TouchableOpacity onPress={onClose}><Text style={S.closeBtn}>✕</Text></TouchableOpacity>
            </View>

            <Text style={S.clientName}>{orden.cliente_nombre}</Text>
            <EstadoBadge estado={orden.estado} />

            {/* Fechas de trazabilidad */}
            <Text style={S.sectionLabel}>Trazabilidad</Text>
            <FechaRow label="Recepcion (RC)" fecha={orden.fecha_rc} />
            <FechaRow label="Envio fabrica (EF)" fecha={orden.fecha_ef} />
            <FechaRow label="Retorno fabrica (RF)" fecha={orden.fecha_rf} />
            <FechaRow label="En bodega" fecha={orden.fecha_bodega} />
            <FechaRow label="Entrega (EC)" fecha={orden.fecha_ec} />

            {/* Cambiar estado */}
            <Text style={S.sectionLabel}>Cambiar estado operativo</Text>
            <View style={S.pickerWrap}>
              <Picker
                selectedValue={orden.estado}
                onValueChange={(v) => cambiarEstado(v as EstadoOrden)}
                style={S.picker}
                dropdownIconColor={COLORS.navy}
              >
                {ESTADOS.map(e => <Picker.Item key={e} label={e} value={e} />)}
              </Picker>
            </View>

            {/* Items */}
            <Text style={S.sectionLabel}>Items ({orden.items.length})</Text>
            {orden.items.map((it, i) => (
              <View key={i} style={S.itemMini}>
                <Text style={S.itemMiniText}>{it.cantidad}x {it.marca || 'Sin marca'} — {it.diseno || 'N/D'}</Text>
                <Text style={S.itemMiniValor}>${(it.cantidad * it.valor_unitario).toFixed(2)}</Text>
                {it.rechazo && <Text style={S.rechazoTag}>RECHAZO</Text>}
              </View>
            ))}

            {/* Pago */}
            <Text style={S.sectionLabel}>Control de Pago</Text>
            <View style={S.pagoRow}>
              <Text style={S.pagoLabel}>Total:</Text>
              <Text style={S.pagoValor}>${orden.monto_total.toFixed(2)}</Text>
            </View>
            <View style={S.pagoRow}>
              <Text style={S.pagoLabel}>Abonado:</Text>
              <Text style={[S.pagoValor, { color: COLORS.green }]}>${orden.monto_abonado.toFixed(2)}</Text>
            </View>
            <View style={S.pagoRow}>
              <Text style={S.pagoLabel}>Pendiente:</Text>
              <Text style={[S.pagoValor, { color: COLORS.red }]}>${orden.monto_pendiente.toFixed(2)}</Text>
            </View>

            {/* Tipo de pago */}
            <Text style={S.label}>Tipo de pago</Text>
            <View style={S.pickerWrap}>
              <Picker
                selectedValue={tipoPago}
                onValueChange={setTipoPago}
                style={S.picker}
                dropdownIconColor={COLORS.navy}
              >
                <Picker.Item label="Sin definir" value="" />
                {TIPOS_PAGO.map(t => <Picker.Item key={t} label={t} value={t} />)}
              </Picker>
            </View>
            <TouchableOpacity style={[S.btnSecondary, { marginTop: 8 }]} onPress={definirPago}>
              <Text style={S.btnSecondaryText}>Definir tipo de pago</Text>
            </TouchableOpacity>

            {/* Abono */}
            <Text style={S.sectionLabel}>Registrar abono</Text>
            <Input label="Monto del abono" value={abonoMonto} onChange={setAbonoMonto} placeholder="0.00" keyboardType="numeric" />
            <TouchableOpacity style={[S.btnPrimary, { marginTop: 8 }]} onPress={registrarAbono} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.navy} /> : <Text style={S.btnPrimaryText}>Registrar abono</Text>}
            </TouchableOpacity>

            {orden.activo_vigente && (
              <View style={S.vigenteBanner}>
                <Text style={S.vigenteText}>✓ Orden activa / vigente (pagada completa)</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function FechaRow({ label, fecha }: { label: string; fecha?: string | null }) {
  const texto = fecha ? new Date(fecha).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—'
  return (
    <View style={S.fechaRow}>
      <Text style={S.fechaLabel}>{label}</Text>
      <Text style={S.fechaValor}>{texto}</Text>
    </View>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const colors: Record<string, string> = {
    'Recepcion': COLORS.navy,
    'Envio a fabrica': COLORS.orange,
    'Retorno de fabrica': COLORS.primaryDark,
    'En bodega': COLORS.navyLight,
    'Entregado al cliente': COLORS.green,
  }
  const bg: Record<string, string> = {
    'Recepcion': COLORS.border,
    'Envio a fabrica': COLORS.orangeBg,
    'Retorno de fabrica': COLORS.primaryLight,
    'En bodega': COLORS.border,
    'Entregado al cliente': COLORS.greenBg,
  }
  return (
    <View style={[S.badge, { backgroundColor: bg[estado] || COLORS.border }]}>
      <Text style={[S.badgeText, { color: colors[estado] || COLORS.navy }]}>{estado}</Text>
    </View>
  )
}

// ============================================================
// Pantalla: Reporte
// ============================================================
function ReporteScreen() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [resumen, setResumen] = useState<ResumenReporte | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarResumen = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<ResumenReporte>(`/reportes/resumen?anio=${anio}&mes=${mes}`)
      setResumen(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar resumen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarResumen() }, [])

  const descargarExcel = async () => {
    Alert.alert(
      'Descargar Excel',
      `Se descargara el reporte de ${mes}/${anio}. En el navegador se abrira la URL del backend.`,
      [
        { text: 'Cancelar' },
        {
          text: 'Descargar',
          onPress: () => {
            const url = `${API_BASE}/reportes/mensual?anio=${anio}&mes=${mes}`
            // En Expo/React Native se usaria expo-file-downloader o Linking
            // Por simplicidad mostramos la URL
            Alert.alert('URL del reporte', url)
          },
        },
      ],
    )
  }

  return (
    <View style={S.screen}>
      <Text style={S.screenTitle}>Reporte Mensual</Text>

      <View style={S.card}>
        <Text style={S.cardTitle}>Seleccionar periodo</Text>
        <View style={S.row}>
          <View style={S.col}>
            <Text style={S.label}>Año</Text>
            <View style={S.pickerWrap}>
              <Picker selectedValue={anio} onValueChange={(v) => setAnio(Number(v))} style={S.picker} dropdownIconColor={COLORS.navy}>
                {[hoy.getFullYear(), hoy.getFullYear() - 1].map(a => <Picker.Item key={a} label={String(a)} value={a} />)}
              </Picker>
            </View>
          </View>
          <View style={S.col}>
            <Text style={S.label}>Mes</Text>
            <View style={S.pickerWrap}>
              <Picker selectedValue={mes} onValueChange={(v) => setMes(Number(v))} style={S.picker} dropdownIconColor={COLORS.navy}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />)}
              </Picker>
            </View>
          </View>
        </View>
        <TouchableOpacity style={[S.btnPrimary, { marginTop: 12 }]} onPress={cargarResumen} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.navy} /> : <Text style={S.btnPrimaryText}>Consultar resumen</Text>}
        </TouchableOpacity>
      </View>

      {error && <Text style={S.errorText}>{error}</Text>}

      {resumen && (
        <View style={S.card}>
          <Text style={S.cardTitle}>Resumen {resumen.mes}/{resumen.anio}</Text>
          <StatRow label="Total ordenes" value={String(resumen.total_ordenes)} />
          <StatRow label="Total cantidad (items)" value={String(resumen.total_cantidad)} />
          <StatRow label="Promedio RC→RF" value={resumen.promedio_rc_rf_horas != null ? `${resumen.promedio_rc_rf_horas} h` : '—'} />
          <StatRow label="Promedio EF→RF" value={resumen.promedio_ef_rf_horas != null ? `${resumen.promedio_ef_rf_horas} h` : '—'} />
          <StatRow label="Promedio RC→EC" value={resumen.promedio_rc_ec_horas != null ? `${resumen.promedio_rc_ec_horas} h` : '—'} />
        </View>
      )}

      <TouchableOpacity style={S.btnPrimary} onPress={descargarExcel}>
        <Text style={S.btnPrimaryText}>Descargar Excel</Text>
      </TouchableOpacity>
    </View>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.statRow}>
      <Text style={S.statLabel}>{label}</Text>
      <Text style={S.statValue}>{value}</Text>
    </View>
  )
}

// ============================================================
// Componentes UI reutilizables
// ============================================================
function Input({
  label, value, onChange, placeholder, keyboardType, multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'numeric' | 'phone-pad'
  multiline?: boolean
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={S.label}>{label}</Text>
      <TextInput
        style={[S.input, multiline && S.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  )
}

function LoadingView() {
  return (
    <View style={S.loadingView}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={S.loadingText}>Cargando...</Text>
    </View>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={S.emptyState}>
      <Text style={S.emptyText}>{text}</Text>
    </View>
  )
}

// ============================================================
// Estilos
// ============================================================
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
  },
  headerLogo: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerLogoText: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  headerSubtitle: { fontSize: 11, color: COLORS.textMuted },

  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', position: 'relative' },
  tabBtnActive: {},
  tabBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  tabBtnTextActive: { color: COLORS.navy },
  tabIndicator: {
    position: 'absolute', bottom: 0, width: 40, height: 3,
    borderRadius: 2, backgroundColor: COLORS.primary,
  },

  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },

  screen: { paddingBottom: 40 },
  screenTitle: { fontSize: 20, fontWeight: '700', color: COLORS.navy, marginBottom: 16 },
  screenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  label: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.navy,
    backgroundColor: COLORS.white,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },

  pickerWrap: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    marginBottom: 12, backgroundColor: COLORS.white, overflow: 'hidden',
  },
  picker: { height: 50, color: COLORS.navy },

  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  btnPrimary: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },

  btnSecondary: {
    backgroundColor: COLORS.navy, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 13, fontWeight: '700', color: COLORS.white },

  btnSmall: {
    backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  btnSmallText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },

  itemBlock: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, marginBottom: 12, backgroundColor: COLORS.bg,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  removeBtn: { fontSize: 12, fontWeight: '600', color: COLORS.red },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: COLORS.navy, fontWeight: '900', fontSize: 14 },
  checkboxLabel: { fontSize: 13, color: COLORS.navy, fontWeight: '500' },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.navy },

  clientName: { fontSize: 15, fontWeight: '700', color: COLORS.navy, marginBottom: 4 },
  clientDetail: { fontSize: 13, color: COLORS.textLight, marginBottom: 2 },

  ordenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ordenNumero: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  ordenMeta: { flexDirection: 'row', gap: 12, marginTop: 8 },
  metaText: { fontSize: 12, color: COLORS.textLight },

  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  closeBtn: { fontSize: 20, color: COLORS.textLight },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, letterSpacing: 0.5 },

  fechaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  fechaLabel: { fontSize: 13, color: COLORS.textLight },
  fechaValor: { fontSize: 13, color: COLORS.navy, fontWeight: '500' },

  itemMini: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemMiniText: { fontSize: 13, color: COLORS.navy, flex: 1 },
  itemMiniValor: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  rechazoTag: { fontSize: 10, fontWeight: '800', color: COLORS.red, backgroundColor: COLORS.redBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },

  pagoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  pagoLabel: { fontSize: 14, color: COLORS.textLight },
  pagoValor: { fontSize: 14, fontWeight: '700', color: COLORS.navy },

  vigenteBanner: {
    backgroundColor: COLORS.greenBg, borderRadius: 10, padding: 12, marginTop: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  vigenteText: { fontSize: 13, fontWeight: '700', color: COLORS.green },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statLabel: { fontSize: 14, color: COLORS.textLight },
  statValue: { fontSize: 14, fontWeight: '700', color: COLORS.navy },

  loadingView: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.textLight, fontSize: 14 },

  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: COLORS.textLight, fontSize: 14 },

  errorText: { color: COLORS.red, fontSize: 13, marginBottom: 12, textAlign: 'center' },
})
