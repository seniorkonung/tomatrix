import { useEffect, useState } from 'react'

// Ошибки, которые иначе пропали бы молча: необработанные исключения и отклонённые обещания,
// в том числе ошибки базы. Текст виден на экране, чтобы его можно было прислать
export function ErrorToast() {
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    const push = (error: unknown) => {
      const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      setMessages((m) => [...m.slice(-2), text])
    }
    const onError = (e: ErrorEvent) => push(e.error ?? e.message)
    const onRejection = (e: PromiseRejectionEvent) => push(e.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (messages.length === 0) return null
  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-xl px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="rounded-2xl bg-red-700 p-3 text-sm text-white shadow-lg">
        <div className="mb-1 flex items-center justify-between font-medium">
          Ошибка
          <button type="button" onClick={() => setMessages([])} className="px-2 text-white/80">
            ✕
          </button>
        </div>
        {messages.map((m, i) => (
          <p key={i} className="break-words select-text">
            {m}
          </p>
        ))}
      </div>
    </div>
  )
}
