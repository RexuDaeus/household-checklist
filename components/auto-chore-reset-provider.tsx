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
    
    // Set up an interval to check every 15 minutes
    const intervalId = setInterval(() => {
      console.log("Running scheduled chore reset check");
      checkAndResetChores()
    }, 15 * 60 * 1000) // Every 15 minutes
    
    // Also check when the page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Page became visible, checking chores");
        checkAndResetChores();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [])
  
  return <>{children}</>
} 