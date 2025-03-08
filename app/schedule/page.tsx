"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SumikkoHeader } from "@/components/sumikko-header"

interface Chore {
  id: string
  name: string
  frequency: string
  completed: boolean
  completedBy?: string
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
      setChores(JSON.parse(savedChores))
    }
  }, [router])

  // Get current date info
  const today = new Date()
  const currentDay = today.toLocaleDateString("en-US", { weekday: "long" })
  const currentDate = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  // Group chores by frequency
  const dailyChores = chores.filter((chore) => chore.frequency === "daily")
  const weeklyChores = chores.filter((chore) => chore.frequency === "weekly")
  const monthlyChores = chores.filter((chore) => chore.frequency === "monthly")

  return (
    <div className="min-h-screen">
      <SumikkoHeader 
        username={username} 
        showBackButton={true} 
      />
      
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Today: {currentDay}, {currentDate}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Stay on top of household maintenance with our organized schedule.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Chores</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyChores.length === 0 ? (
                <p className="text-muted-foreground">No daily chores scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {dailyChores.map((chore) => (
                    <li key={chore.id} className="p-2 border rounded-md flex justify-between items-center">
                      <span className={chore.completed ? "line-through text-muted-foreground" : ""}>{chore.name}</span>
                      {chore.completed ? (
                        <span className="text-xs text-muted-foreground">Completed by {chore.completedBy}</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-secondary rounded-full">Due today</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Chores</CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyChores.length === 0 ? (
                <p className="text-muted-foreground">No weekly chores scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {weeklyChores.map((chore) => (
                    <li key={chore.id} className="p-2 border rounded-md flex justify-between items-center">
                      <span className={chore.completed ? "line-through text-muted-foreground" : ""}>{chore.name}</span>
                      {chore.completed ? (
                        <span className="text-xs text-muted-foreground">Completed by {chore.completedBy}</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-secondary rounded-full">This week</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Chores</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyChores.length === 0 ? (
                <p className="text-muted-foreground">No monthly chores scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {monthlyChores.map((chore) => (
                    <li key={chore.id} className="p-2 border rounded-md flex justify-between items-center">
                      <span className={chore.completed ? "line-through text-muted-foreground" : ""}>{chore.name}</span>
                      {chore.completed ? (
                        <span className="text-xs text-muted-foreground">Completed by {chore.completedBy}</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-secondary rounded-full">This month</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

