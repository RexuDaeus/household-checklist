import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface SumikkoCardProps {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
  titleExtra?: ReactNode
}

export function SumikkoCard({ children, className, title, subtitle, titleExtra }: SumikkoCardProps) {
  return (
    <div className={cn("sumikko-card", className)}>
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h2 className="sumikko-title flex items-center">
              {title}
              {titleExtra && titleExtra}
            </h2>
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