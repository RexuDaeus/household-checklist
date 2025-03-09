import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ReactNode } from "react"

interface SumikkoCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  titleExtra?: ReactNode;
  children: ReactNode;
}

export function SumikkoCard({ title, subtitle, titleExtra, children }: SumikkoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {title}
          </div>
          {titleExtra && (
            <div>{titleExtra}</div>
          )}
        </CardTitle>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
} 