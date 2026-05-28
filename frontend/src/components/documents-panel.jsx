import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckSquare, FileText, Square, UploadCloud } from 'lucide-react'
import { apiFetch } from '../api/client'

export default function DocumentsPanel({ projectId, selectedDocIds, onSelectionChange }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const { documents } = await apiFetch(`/documents?projectId=${projectId}`)
      setDocs(documents || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!docs.some(d => d.kbIngestStatus === 'processing')) return
    const t = setTimeout(load, 5000)
    return () => clearTimeout(t)
  }, [docs, load])

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !projectId) return
    if (file.size > 20 * 1024 * 1024) { setError('File too large (max 20MB)'); e.target.value = ''; return }
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await apiFetch(`/documents/upload?projectId=${projectId}`, { method: 'POST', body: fd })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const toggle = (docId) => {
    const next = selectedDocIds.includes(docId) ? selectedDocIds.filter(id => id !== docId) : [...selectedDocIds, docId]
    onSelectionChange(next)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-3 py-2.5">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Documents</span>
        <button onClick={() => fileRef.current?.click()} disabled={!projectId || uploading} aria-label="Upload document" className="rounded-md p-1 text-[var(--text-tertiary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--accent-on-surface)] disabled:opacity-50">
          {uploading ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text-tertiary)] border-t-transparent" /> : <UploadCloud size={14} />}
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.txt" onChange={upload} className="hidden" />

      {error && <p className="px-3 py-1.5 text-[10px] text-[var(--color-danger)]">{error}</p>}

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading && docs.length === 0 && <p className="px-2 py-4 text-xs text-[var(--text-tertiary)]">Loading...</p>}
        {!loading && docs.length === 0 && <p className="px-2 py-4 text-xs text-[var(--text-tertiary)]">No documents. Upload a PDF or TXT file.</p>}
        {docs.map(doc => (
          <button key={doc.docId}
            onClick={() => doc.kbIngestStatus === 'ready' && toggle(doc.docId)}
            disabled={doc.kbIngestStatus !== 'ready'}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition ${selectedDocIds.includes(doc.docId) ? 'bg-[var(--surface-2)] text-[var(--accent-on-surface)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'} disabled:opacity-50 disabled:cursor-not-allowed`}>
            {selectedDocIds.includes(doc.docId) ? <CheckSquare size={13} /> : <Square size={13} className="text-[var(--text-tertiary)]" />}
            <FileText size={13} className="shrink-0" />
            <span className="truncate flex-1">{doc.filename}</span>
            {doc.kbIngestStatus !== 'ready' && <span className="text-[10px] text-[var(--text-tertiary)]">{doc.kbIngestStatus}</span>}
          </button>
        ))}
      </div>

      {selectedDocIds.length > 0 && (
        <div className="border-t border-[var(--surface-border)] px-3 py-2 text-[11px] text-[var(--text-tertiary)]">
          {selectedDocIds.length} selected
        </div>
      )}
    </div>
  )
}
