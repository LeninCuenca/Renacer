import type { Rol } from '../types'

export type AppTab = 'dashboard' | 'ordenes' | 'nueva' | 'clientes' | 'reporte' | 'usuarios' | 'vendedores' | 'planificacion' | 'planificaciones' | 'planta' | 'cartera'

export interface RoleNavigation {
  label: string
  tabs: AppTab[]
}

export const TAB_LABELS: Record<AppTab, string> = {
  dashboard: 'Dashboard',
  ordenes: 'Ordenes',
  nueva: 'Nueva orden',
  clientes: 'Clientes',
  reporte: 'Reportes',
  usuarios: 'Usuarios',
  vendedores: 'Vendedores',
  planificacion: 'Mi planificación',
  planificaciones: 'Planificaciones',
  planta: 'Planta',
  cartera: 'Cartera',
}

export const ROLE_NAVIGATION: Record<Rol, RoleNavigation> = {
  vendedor: {
    label: 'Vendedor',
    tabs: ['ordenes', 'nueva', 'planificacion', 'clientes', 'reporte'],
  },
  supervisor: {
    label: 'Supervisor',
    tabs: ['dashboard', 'ordenes', 'planificaciones', 'reporte'],
  },
  jefe: {
    label: 'Jefe',
    tabs: ['dashboard', 'usuarios', 'vendedores', 'planificaciones', 'reporte'],
  },
  contador: {
    label: 'Contador',
    tabs: ['cartera', 'ordenes'],
  },
  administrador_planta: {
    label: 'Administrador de planta',
    tabs: ['planta'],
  },
}

export function getRoleNavigation(rol: Rol): RoleNavigation {
  return ROLE_NAVIGATION[rol]
}