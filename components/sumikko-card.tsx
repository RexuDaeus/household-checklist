import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface SumikkoCardProps {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
}

export function SumikkoCard({ children, className, title, subtitle }: SumikkoCardProps) {
  return (
    <div className={cn("sumikko-card", className)}>
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h2 className="sumikko-title">{title}</h2>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
} 