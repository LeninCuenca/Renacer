import type { ReactNode } from 'react'

export default function ItemField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-navy-300">{label}</label>
      {children}
    </div>
  )
}
