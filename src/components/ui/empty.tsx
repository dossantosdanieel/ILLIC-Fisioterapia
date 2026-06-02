import type { LucideIcon } from 'lucide-react'

interface EmptyProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function Empty({ icon: Icon, title, description, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={32} className="text-gray-300 mb-3" />}
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {description && <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
