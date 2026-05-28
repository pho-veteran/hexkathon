import { useRef } from 'react'
import { CheckSquare, FileText, Square, UploadCloud } from 'lucide-react'
import { useDocuments } from '../hooks/useDocuments'

export default function DocumentLibrary({ projectId, selectedDocIds, onSelectionChange }) {
  const { documents, loading, error, uploadDocument } = useDocuments(projectId)
  const fileInputRef = useRef(null)

  const toggleDoc = (docId) => {
    const next = selectedDocIds.includes(docId)
      ? selectedDocIds.filter((id) => id !== docId)
      : [...selectedDocIds, docId]
    onSelectionChange(next)
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (file) {
      await uploadDocument(file)
      event.target.value = ''
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800">Documents</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!projectId}
          className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-60"
        >
          <UploadCloud className="h-4 w-4" /> Upload
        </button>
      </div>

      <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" />

      {loading ? <p className="text-xs text-slate-400">Loading documents...</p> : null}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {documents.map((doc) => (
          <li
            key={doc.docId}
            onClick={() => {
              if (doc.kbIngestStatus === 'ready') {
                toggleDoc(doc.docId)
              }
            }}
            className={`flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-2 text-sm transition ${doc.kbIngestStatus === 'ready' ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed opacity-60'}`}
          >
            {selectedDocIds.includes(doc.docId) ? (
              <CheckSquare className="h-4 w-4 text-indigo-600" />
            ) : (
              <Square className="h-4 w-4 text-slate-400" />
            )}
            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate text-slate-700">{doc.filename}</span>
            <span className="ml-auto text-[11px] text-slate-400">{doc.kbIngestStatus || 'unknown'}</span>
          </li>
        ))}
        {!loading && documents.length === 0 ? (
          <li className="rounded-lg border border-slate-100 px-3 py-4 text-center text-xs text-slate-400">
            No documents yet.
          </li>
        ) : null}
      </ul>
    </div>
  )
}
