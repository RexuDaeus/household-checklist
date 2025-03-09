import { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AutoChoreResetProvider } from "@/components/auto-chore-reset-provider"

export const metadata: Metadata = {
  title: "Sumikko House - Unit 202/6 Joseph Road",
  description: "A cozy household management system with Sumikko-Gurashi theme",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-['M_PLUS_Rounded_1c']">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AutoChoreResetProvider>
            <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
              {children}
            </div>
          </AutoChoreResetProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'