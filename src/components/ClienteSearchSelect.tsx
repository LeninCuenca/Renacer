import { useState, useEffect, useRef } from 'react'
import type { Cliente } from '../types'
import { SearchIcon } from './icons'

interface Props {
  clientes: Cliente[]
  clienteId: number
  onSelect: (id: number) => void
}

export default function ClienteSearchSelect({ clientes, clienteId, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const clienteSeleccionado = clientes.find(c => c.id === clienteId) || null

  const filtrados = query.trim().length === 0
    ? clientes
    : clientes.filter(c => {
        const q = query.toLowerCase()
        return c.nombre.toLowerCase().includes(q) || c.cedula.includes(q)
      })

  // Cerrar al tocar fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const seleccionar = (c: Cliente) => {
    onSelect(c.id)
    setQuery('')
    setOpen(false)
  }

  const limpiar = () => {
    onSelect(0)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="mb-4" ref={wrapperRef}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Cliente *</label>

      {/* Cliente seleccionado */}
      {clienteSeleccionado && !open ? (
        <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-3 py-2.5">
          <div>
            <p className="text-sm font-bold text-navy-500">{clienteSeleccionado.nombre}</p>
            <p className="text-xs text-navy-300">{clienteSeleccionado.cedula}{clienteSeleccionado.direccion ? ` · ${clienteSeleccionado.direccion}` : ''}</p>
          </div>
          <button onClick={limpiar}
            className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-navy-300 hover:bg-red-50 hover:text-red-500 transition">
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Input de busqueda */}
          <div className="flex items-center rounded-lg border border-navy-100 bg-white px-3 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-200">
            <SearchIcon className="mr-2 h-4 w-4 shrink-0 text-navy-300" />
            <input
              autoFocus={open}
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              placeholder="Buscar por nombre o cedula..."
              className="w-full py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery('')} className="ml-1 text-navy-200 hover:text-navy-500">✕</button>
            )}
          </div>

          {/* Dropdown de resultados */}
          {open && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-navy-100 bg-white shadow-lg">
              {filtrados.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-navy-200">
                  Sin resultados para «{query}»
                </div>
              ) : (
                filtrados.map(c => (
                  <button key={c.id} onClick={() => seleccionar(c)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-primary-50 active:bg-primary-100 border-b border-navy-50 last:border-0">
                    <div>
                      <p className="text-sm font-bold text-navy-500">{c.nombre}</p>
                      <p className="text-xs text-navy-300">{c.cedula}{c.direccion ? ` · ${c.direccion}` : ''}</p>
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-navy-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
