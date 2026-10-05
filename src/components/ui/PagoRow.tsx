export default function PagoRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-navy-300">{label}:</span>
      <span className={`text-sm font-bold ${color}`}>${value.toFixed(2)}</span>
    </div>
  )
}
