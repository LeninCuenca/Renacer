interface InputProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  multiline?: boolean
  hint?: string
  inputMode?: 'numeric' | 'tel' | 'decimal' | 'text' | 'none' | 'search' | 'email' | 'url'
  pattern?: string
}

export default function Input({
  label, value, onChange, placeholder, type, multiline, hint, inputMode, pattern,
}: InputProps) {
  const isHintOk = hint && hint.startsWith('✓')
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-300">{label}</label>
        {hint && (
          <span className={`text-[10px] font-bold ${isHintOk ? 'text-green-600' : 'text-navy-300'}`}>{hint}</span>
        )}
      </div>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="min-h-[70px] w-full resize-y rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200" />
      ) : (
        <input
          type={type || 'text'}
          inputMode={inputMode}
          pattern={pattern}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:outline-none focus:ring-2 transition ${
            isHintOk
              ? 'border-green-300 focus:border-green-400 focus:ring-green-100'
              : 'border-navy-100 focus:border-primary-400 focus:ring-primary-200'
          }`} />
      )}
    </div>
  )
}
