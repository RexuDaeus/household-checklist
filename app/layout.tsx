import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AutoChoreResetProvider } from "@/components/auto-chore-reset-provider"
import { GuestProvider } from "@/lib/guest-context"

const inter = Inter({ subsets: ["latin"] })

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
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <GuestProvider>
            <AutoChoreResetProvider>
              <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
                {children}
              </div>
            </AutoChoreResetProvider>
          </GuestProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

import './globals.css'