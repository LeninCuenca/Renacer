export default function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-navy-100 bg-navy-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-300">{label}</p>
      <p className="mt-1 text-lg font-bold text-navy-500">{value}</p>
    </div>
  )
}
