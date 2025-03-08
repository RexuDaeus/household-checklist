"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Home, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"

interface Chore {
  id: string
  name: string
  frequency: string
  completed: boolean
  completedBy?: string
}

const defaultChores: Omit<Chore, "id">[] = [
  { name: "Take out trash", frequency: "daily", completed: false },
  { name: "Wash dishes", frequency: "daily", completed: false },
  { name: "Sweep floors", frequency: "daily", completed: false },
  { name: "Clean bathroom", frequency: "weekly", completed: false },
  { name: "Vacuum living room", frequency: "weekly", completed: false },
  { name: "Change bed sheets", frequency: "weekly", completed: false },
  { name: "Deep clean kitchen", frequency: "monthly", completed: false },
  { name: "Clean refrigerator", frequency: "monthly", completed: false },
  { name: "Dust all surfaces", frequency: "monthly", completed: false },
]

export default function InitializeChoresPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const cookies = document.cookie.split(";")
    const userCookie = cookies.find((cookie) => cookie.trim().startsWith("user="))

    if (!userCookie) {
      router.push("/login")
    }
  }, [router])

  const handleInitialize = () => {
    // Create chores with unique IDs
    const choresWithIds = defaultChores.map((chore) => ({
      ...chore,
      id: Date.now() + Math.random().toString(36).substring(2, 9),
    }))

    // Save to localStorage
    localStorage.setItem("chores", JSON.stringify(choresWithIds))

    // Redirect to chores page
    router.push("/chores")
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center">
            <Home className="h-6 w-6 mr-2" />
            <h1 className="text-2xl font-bold">Initialize Default Chores</h1>
          </div>
        </div>
        <ModeToggle />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Default Chores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p>
            This will initialize your household with a set of common chores. You can always add, edit, or remove chores
            later.
          </p>

          <div className="space-y-4">
            <h3 className="font-medium">Daily Chores:</h3>
            <ul className="list-disc pl-5 space-y-1">
              {defaultChores
                .filter((chore) => chore.frequency === "daily")
                .map((chore) => (
                  <li key={chore.name}>{chore.name}</li>
                ))}
            </ul>

            <h3 className="font-medium">Weekly Chores:</h3>
            <ul className="list-disc pl-5 space-y-1">
              {defaultChores
                .filter((chore) => chore.frequency === "weekly")
                .map((chore) => (
                  <li key={chore.name}>{chore.name}</li>
                ))}
            </ul>

            <h3 className="font-medium">Monthly Chores:</h3>
            <ul className="list-disc pl-5 space-y-1">
              {defaultChores
                .filter((chore) => chore.frequency === "monthly")
                .map((chore) => (
                  <li key={chore.name}>{chore.name}</li>
                ))}
            </ul>
          </div>

          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Cancel
            </Button>
            <Button onClick={handleInitialize}>
              <Check className="h-4 w-4 mr-2" />
              Initialize Chores
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

