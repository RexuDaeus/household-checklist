"use client"

import { useEffect } from "react"
import { checkAndResetChores } from "@/lib/chore-service"

interface AutoChoreResetProviderProps {
  children: React.ReactNode
}

export function AutoChoreResetProvider({ children }: AutoChoreResetProviderProps) {
  useEffect(() => {
    // Run on component mount
    checkAndResetChores()
    
    // Set up an interval to check every hour
    // This is a backup in case the user has the app open for a long time
    const intervalId = setInterval(() => {
      checkAndResetChores()
    }, 60 * 60 * 1000) // Every hour
    
    return () => {
      clearInterval(intervalId)
    }
  }, [])
  
  return <>{children}</>
} 