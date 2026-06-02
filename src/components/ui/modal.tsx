import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) el.showModal()
    else el.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        'w-full rounded-lg border border-gray-200 shadow-xl p-0',
        'backdrop:bg-black/40',
        'open:flex open:flex-col',
        sizes[size],
      )}
      onClick={e => { if (e.target === dialogRef.current) onClose() }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="px-5 py-4 overflow-y-auto max-h-[80vh]">
        {children}
      </div>
    </dialog>
  )
}
