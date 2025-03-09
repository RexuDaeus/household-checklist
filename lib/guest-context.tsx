"use client"

import { createContext, useContext, useState, useEffect } from "react"

interface GuestContextType {
  isGuest: boolean
  setIsGuest: (value: boolean) => void
}

const GuestContext = createContext<GuestContextType | undefined>(undefined)

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    // Check if user is in guest mode on mount
    const guestMode = localStorage.getItem("guestMode") === "true"
    setIsGuest(guestMode)
  }, [])

  const handleSetIsGuest = (value: boolean) => {
    setIsGuest(value)
    localStorage.setItem("guestMode", value.toString())
  }

  return (
    <GuestContext.Provider value={{ isGuest, setIsGuest: handleSetIsGuest }}>
      {children}
    </GuestContext.Provider>
  )
}

export function useGuest() {
  const context = useContext(GuestContext)
  if (context === undefined) {
    throw new Error("useGuest must be used within a GuestProvider")
  }
  return context
} 