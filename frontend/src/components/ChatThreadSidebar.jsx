export default function ChatThreadSidebar({ threads, activeThreadId, onSelectThread, onCreateThread, loading }) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">Chats</h2>
        <button onClick={onCreateThread} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
          New chat
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-2">
        {loading ? <p className="px-2 py-3 text-xs text-slate-400">Loading chats...</p> : null}
        {!loading && threads.length === 0 ? <p className="px-2 py-3 text-xs text-slate-400">No chats yet.</p> : null}
        {threads.map((thread) => (
          <button
            key={thread.threadId}
            onClick={() => onSelectThread(thread.threadId)}
            className={`mb-2 w-full rounded-lg px-3 py-2 text-left text-sm ${thread.threadId === activeThreadId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            {thread.title}
          </button>
        ))}
      </div>
    </aside>
  )
}
