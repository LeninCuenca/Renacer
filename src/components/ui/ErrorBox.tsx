export default function ErrorBox({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="animate-fade-in flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white">!</span>
      <p className="flex-1 text-sm font-medium text-red-700">{message}</p>
      <button onClick={onClose} className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-100 hover:text-red-600" title="Cerrar">×</button>
    </div>
  )
}
