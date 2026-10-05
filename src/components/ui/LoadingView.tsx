export default function LoadingView() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center py-20">
      <img src="/logo.png" alt="Cargando" className="h-16 w-16 animate-pulse object-contain" />
      <p className="mt-4 text-sm font-semibold text-navy-300">Cargando...</p>
    </div>
  )
}
