import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Check, CircleAlert, X } from 'lucide-react'

type ToastItem = { id: number; message: string; tone: 'success' | 'error' }
type ToastContextValue = { showToast: (message: string, tone?: ToastItem['tone']) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const showToast = useCallback((message: string, tone: ToastItem['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3600)
  }, [])
  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div className={`toast toast--${item.tone}`} key={item.id} role="status">
            {item.tone === 'success' ? <Check size={17} /> : <CircleAlert size={17} />}
            <span>{item.message}</span>
            <button className="icon-button toast__close" onClick={() => setItems((current) => current.filter((toast) => toast.id !== item.id))} aria-label="Cerrar aviso"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider.')
  return value
}
