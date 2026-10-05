import { useState, useEffect } from 'react'
import { supabase } from './services/supabaseClient'
import { authService } from './services/authService'
import type { Perfil } from './types'
import { ordenService } from './services/ordenService'
import { invalidarCacheOrdenes } from './services/helpers'
import TabBtn from './components/ui/TabBtn'
import { BellIcon } from './components/icons'
import OrdenesScreen from './screens/OrdenesScreen'
import NuevaOrdenScreen from './screens/NuevaOrdenScreen'
import ClientesScreen from './screens/ClientesScreen'
import ReporteScreen from './screens/ReporteScreen'
import LoginScreen from './screens/LoginScreen'
import UsuariosScreen from './screens/UsuariosScreen'
import ResetPasswordScreen from './screens/ResetPasswordScreen'
import DashboardScreen from './screens/DashboardScreen'
import VendedoresScreen from './screens/VendedoresScreen'
import { getRoleNavigation, TAB_LABELS, type AppTab } from './navigation/roleNavigation'
import ChangePasswordScreen from './screens/ChangePasswordScreen'
import PlantaScreen from './screens/PlantaScreen'
import PlanificacionScreen from './screens/PlanificacionScreen'
import PlanificacionesScreen from './screens/PlanificacionesScreen'
import CarteraScreen from './screens/CarteraScreen'

// ============================================================
// App Shell — Header, Navegación y Router de tabs
// ============================================================
export default function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [tab, setTab] = useState<AppTab>('ordenes')
  const [refreshKey, setRefreshKey] = useState(0)
  const [alertasCount, setAlertasCount] = useState(0)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    authService.getPerfilActual().then(perfilActual => { if (mounted) setPerfil(perfilActual) }).catch(() => {}).finally(() => { if (mounted) setAuthLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (!session) setPerfil(null)
      if (session && _event === 'SIGNED_IN') authService.getPerfilActual().then(perfilActual => { if (mounted) setPerfil(perfilActual) }).catch(() => {})
    })
    return () => { mounted = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!perfil) return
    let count = 0
    ordenService.getCreditosPorVencer().then(alertas => {
      count += alertas.filter(a => a.porVencer || a.vencido).length
      if (perfil.rol === 'contador') {
        ordenService.getOrdenes().then(ordenes => {
          const paraFacturar = ordenes.filter(o => o.estado === 'Retorno de fabrica').length
          setAlertasCount(count + paraFacturar)
        }).catch(() => setAlertasCount(count))
      } else {
        setAlertasCount(count)
      }
    }).catch(() => {})
  }, [perfil, refreshKey])

  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-navy-700 text-white">Cargando...</div>
  if (recoveryMode) return <ResetPasswordScreen onDone={() => { setRecoveryMode(false); setPerfil(null); void authService.cerrarSesion() }} />
  if (!perfil) return <LoginScreen onLogin={() => authService.getPerfilActual().then(setPerfil).catch(() => {})} />

  const navigation = getRoleNavigation(perfil.rol)
  const activeTab = navigation.tabs.includes(tab) ? tab : navigation.tabs[0]

  const cambiarTab = (nextTab: AppTab) => {
    if (navigation.tabs.includes(nextTab)) setTab(nextTab)
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-navy-500 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
          <img src="/logoparaelbanner.png" alt="Renacer" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-base font-bold leading-tight text-white">Renacer</h1>
            <p className="text-[11px] leading-tight text-navy-100">Registro Operativo</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {alertasCount > 0 && (
              <button onClick={() => cambiarTab(perfil.rol === 'contador' ? 'cartera' : 'ordenes')}
                className="flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white animate-pulse">
                <BellIcon /> {alertasCount}
              </button>
            )}
            <div className="rounded-full bg-primary-400 px-3 py-1 text-xs font-bold text-navy-500">
              {TAB_LABELS[activeTab]}
            </div>
            <span className="hidden text-xs text-navy-100 sm:inline">{navigation.label}</span>
            <button onClick={() => setChangePasswordOpen(true)} className="text-xs font-semibold text-white underline">Contraseña</button>
            <button onClick={() => authService.cerrarSesion()} className="text-xs font-semibold text-white underline">Salir</button>
          </div>
        </div>
      </header>

      <nav className="sticky top-[57px] z-20 border-b border-navy-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap">
          {navigation.tabs.map(item => <TabBtn key={item} label={TAB_LABELS[item]} active={activeTab === item} onClick={() => cambiarTab(item)} />)}
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div key={activeTab + refreshKey} className="animate-fade-in">
          {activeTab === 'dashboard' && <DashboardScreen rol={perfil.rol} />}
          {activeTab === 'ordenes' && <OrdenesScreen refreshKey={refreshKey} rol={perfil.rol} />}
          {activeTab === 'cartera' && <CarteraScreen />}
          {activeTab === 'nueva' && <NuevaOrdenScreen onCreated={() => { invalidarCacheOrdenes(); setRefreshKey(k => k + 1); cambiarTab('ordenes') }} />}
          {activeTab === 'planificacion' && <PlanificacionScreen vendedorId={perfil.id} />}
          {activeTab === 'planificaciones' && <PlanificacionesScreen />}
          {activeTab === 'clientes' && <ClientesScreen />}
          {activeTab === 'reporte' && <ReporteScreen />}
          {activeTab === 'usuarios' && <UsuariosScreen />}
          {activeTab === 'vendedores' && <VendedoresScreen />}
          {activeTab === 'planta' && <PlantaScreen />}
        </div>
      </main>

      {changePasswordOpen && <ChangePasswordScreen onClose={() => setChangePasswordOpen(false)} />}

      <footer className="mx-auto max-w-3xl px-4 pb-8 pt-2 text-center text-xs text-navy-200">
        Renacer · Sistema de registro operativo y control de pagos
      </footer>
    </div>
  )
}
