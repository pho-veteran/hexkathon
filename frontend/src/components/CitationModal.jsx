import { FileText, X } from 'lucide-react'

export default function CitationModal({ citation, onClose }) {
  if (!citation) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <FileText className="h-4 w-4" /> Citation
          </h3>
          <button onClick={onClose} className="text-slate-400 transition hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm text-slate-700">
          <p><span className="font-semibold text-slate-500">File:</span> {citation.filename || 'Unknown'}</p>
          {citation.locator ? <p><span className="font-semibold text-slate-500">Locator:</span> {citation.locator}</p> : null}
          <div>
            <p className="font-semibold text-slate-500">Excerpt</p>
            <p className="mt-1 rounded-lg bg-slate-50 p-3 leading-relaxed">{citation.excerpt || 'No excerpt available.'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
