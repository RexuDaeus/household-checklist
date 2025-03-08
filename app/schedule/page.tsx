"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SumikkoHeader } from "@/components/sumikko-header"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

interface Chore {
  id: string
  name: string
  frequency: string
  completed: boolean
  completedBy?: string
  lastReset?: string // Track the last time this chore was reset
}

export default function SchedulePage() {
  const [chores, setChores] = useState<Chore[]>([])
  const [username, setUsername] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const cookies = document.cookie.split(";")
    const userCookie = cookies.find((cookie) => cookie.trim().startsWith("user="))

    if (userCookie) {
      setUsername(userCookie.split("=")[1])
    } else {
      router.push("/login")
      return
    }

    // Load chores from localStorage
    const savedChores = localStorage.getItem("chores")
    if (savedChores) {
      let parsedChores: Chore[] = JSON.parse(savedChores)
      
      // Check if chores need to be reset based on frequency
      const now = new Date()
      const sydney = new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Sydney",
        hour: "numeric",
        minute: "numeric",
        day: "numeric",
        month: "numeric",
        year: "numeric",
        weekday: "long"
      })
      
      const sydneyDate = sydney.format(now)
      const sydneyParts = parseSydneyDate(sydneyDate)
      
      // Only process resets if it's 4 AM
      if (sydneyParts.hour === 4) {
        parsedChores = parsedChores.map(chore => {
          const lastReset = chore.lastReset ? new Date(chore.lastReset) : null
          
          // Daily chores: reset every day at 4 AM
          if (chore.frequency === "daily") {
            if (!lastReset || daysSince(lastReset) >= 1) {
              return {
                ...chore,
                completed: false,
                completedBy: undefined,
                lastReset: now.toISOString()
              }
            }
          }
          
          // Weekly chores: reset every Monday at 4 AM
          if (chore.frequency === "weekly") {
            if (sydneyParts.weekday === "Monday") {
              if (!lastReset || daysSince(lastReset) >= 7) {
                return {
                  ...chore,
                  completed: false,
                  completedBy: undefined,
                  lastReset: now.toISOString()
                }
              }
            }
          }
          
          // Monthly chores: reset on the 1st of every month at 4 AM
          if (chore.frequency === "monthly") {
            if (sydneyParts.day === 1) {
              if (!lastReset || monthsSince(lastReset, now) >= 1) {
                return {
                  ...chore,
                  completed: false,
                  completedBy: undefined,
                  lastReset: now.toISOString()
                }
              }
            }
          }
          
          return chore
        })
        
        // Save the updated chores back to localStorage
        localStorage.setItem("chores", JSON.stringify(parsedChores))
      }
      
      setChores(parsedChores)
    }
  }, [router])

  // Helper function to parse Sydney date string
  const parseSydneyDate = (dateString: string) => {
    // Example format: "Monday, 3/25/2024, 4:00 AM"
    const parts = dateString.split(", ")
    const weekday = parts[0]
    const datePart = parts[1].split("/")
    const day = parseInt(datePart[1])
    const month = parseInt(datePart[0])
    const year = parseInt(datePart[2])
    
    const timePart = parts[2].split(" ")
    const timeSplit = timePart[0].split(":")
    let hour = parseInt(timeSplit[0])
    const minute = parseInt(timeSplit[1])
    const ampm = timePart[1]
    
    // Convert to 24-hour format
    if (ampm === "PM" && hour < 12) hour += 12
    if (ampm === "AM" && hour === 12) hour = 0
    
    return { weekday, day, month, year, hour, minute }
  }
  
  // Calculate days since a given date
  const daysSince = (date: Date) => {
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    return Math.floor(diffTime / (1000 * 60 * 60 * 24))
  }
  
  // Calculate months since a given date
  const monthsSince = (date: Date, now: Date) => {
    return (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth()
  }

  // Get current date info
  const today = new Date()
  const currentDay = today.toLocaleDateString("en-US", { weekday: "long" })
  const currentDate = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  // Group chores by frequency
  const dailyChores = chores.filter((chore) => chore.frequency === "daily")
  const weeklyChores = chores.filter((chore) => chore.frequency === "weekly")
  const monthlyChores = chores.filter((chore) => chore.frequency === "monthly")

  // Handle marking a chore as complete
  const handleToggleChore = (choreId: string, completed: boolean) => {
    const updatedChores = chores.map(chore => {
      if (chore.id === choreId) {
        return {
          ...chore,
          completed,
          completedBy: completed ? username : undefined
        }
      }
      return chore
    })
    
    setChores(updatedChores)
    localStorage.setItem("chores", JSON.stringify(updatedChores))
  }
  
  // Check for chores that need to be reset (run this on a manual refresh as well)
  const handleManualReset = () => {
    const now = new Date()
    
    // Process daily chores
    const updatedChores = chores.map(chore => {
      if (chore.frequency === "daily") {
        return {
          ...chore, 
          completed: false,
          completedBy: undefined,
          lastReset: now.toISOString()
        }
      }
      return chore
    })
    
    setChores(updatedChores)
    localStorage.setItem("chores", JSON.stringify(updatedChores))
  }

  // Component for rendering a list of chores with checkboxes
  const ChoresList = ({ chores, label }: { chores: Chore[], label: string }) => (
    <ul className="space-y-2">
      {chores.length === 0 ? (
        <p className="text-muted-foreground">No {label.toLowerCase()} chores scheduled.</p>
      ) : (
        chores.map((chore) => (
          <li key={chore.id} className="p-2 border rounded-md flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`chore-${chore.id}`}
                checked={chore.completed}
                onCheckedChange={(checked) => handleToggleChore(chore.id, checked as boolean)}
              />
              <label 
                htmlFor={`chore-${chore.id}`}
                className={chore.completed ? "line-through text-muted-foreground" : ""}
              >
                {chore.name}
              </label>
            </div>
            {chore.completed ? (
              <span className="text-xs text-muted-foreground">Completed by {chore.completedBy}</span>
            ) : (
              label === "Daily" ? (
                <span className="text-xs px-2 py-1 bg-secondary rounded-full">Due today</span>
              ) : label === "Weekly" ? (
                <span className="text-xs px-2 py-1 bg-secondary rounded-full">This week</span>
              ) : (
                <span className="text-xs px-2 py-1 bg-secondary rounded-full">This month</span>
              )
            )}
          </li>
        ))
      )}
    </ul>
  )

  return (
    <div className="min-h-screen">
      <SumikkoHeader 
        username={username} 
        showBackButton={true} 
      />
      
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Today: {currentDay}, {currentDate}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleManualReset}
                className="text-xs"
              >
                <Check className="h-4 w-4 mr-1" />
                Reset Daily Chores
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Stay on top of household maintenance with our organized schedule. Chores automatically reset based on frequency.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Chores</CardTitle>
            </CardHeader>
            <CardContent>
              <ChoresList chores={dailyChores} label="Daily" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Chores</CardTitle>
            </CardHeader>
            <CardContent>
              <ChoresList chores={weeklyChores} label="Weekly" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Chores</CardTitle>
            </CardHeader>
            <CardContent>
              <ChoresList chores={monthlyChores} label="Monthly" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

