export default function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`relative flex-1 px-4 py-3 text-sm font-semibold transition ${active ? 'text-navy-500' : 'text-navy-200 hover:text-navy-300'}`}>
      {label}
      {active && <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary-400" />}
    </button>
  )
}
