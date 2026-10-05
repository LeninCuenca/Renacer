export default function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-navy-100 bg-white py-12 text-center">
      <p className="text-sm text-navy-200">{text}</p>
    </div>
  )
}
