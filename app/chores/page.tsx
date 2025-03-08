"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { SumikkoHeader } from "@/components/sumikko-header"
import { ModeToggle } from "@/components/mode-toggle"

interface Chore {
  id: string
  name: string
  frequency: string
  completed: boolean
  completedBy?: string
  createdBy: string
}

export default function ChoresPage() {
  const [chores, setChores] = useState<Chore[]>([])
  const [newChoreName, setNewChoreName] = useState("")
  const [newChoreFrequency, setNewChoreFrequency] = useState("daily")
  const [username, setUsername] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Get username from cookie
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

  useEffect(() => {
    // Save chores to localStorage whenever they change
    if (chores.length > 0) {
      localStorage.setItem("chores", JSON.stringify(chores))
    }
  }, [chores])

  const addChore = () => {
    if (!newChoreName) return

    const newChore: Chore = {
      id: Date.now().toString(),
      name: newChoreName,
      frequency: newChoreFrequency,
      completed: false,
      createdBy: username
    }

    setChores([...chores, newChore])
    setNewChoreName("")
  }

  const toggleChoreCompletion = (id: string) => {
    setChores(
      chores.map((chore) => {
        if (chore.id === id) {
          return {
            ...chore,
            completed: !chore.completed,
            completedBy: !chore.completed ? username : undefined,
          }
        }
        return chore
      }),
    )
  }

  const deleteChore = (id: string) => {
    setChores(chores.filter((chore) => chore.id !== id))
  }

  // Group chores by frequency
  const todaysChores = chores.filter((chore) => chore.frequency === "daily")
  const weeklyChores = chores.filter((chore) => chore.frequency === "weekly")
  const monthlyChores = chores.filter((chore) => chore.frequency === "monthly")

  return (
    <div className="min-h-screen">
      <SumikkoHeader 
        username={username} 
        showBackButton={true} 
      />
      
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add New Chore</CardTitle>
            <CardDescription>Create a new chore for the household.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="choreName">Chore Name</Label>
              <Input
                id="choreName"
                value={newChoreName}
                onChange={(e) => setNewChoreName(e.target.value)}
                placeholder="Enter chore name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={newChoreFrequency} onValueChange={setNewChoreFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={addChore}>
              <Plus className="h-4 w-4 mr-2" />
              Add Chore
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Chores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {todaysChores.map((chore) => (
                <li key={chore.id} className="flex items-center justify-between gap-4">
                  <div>
                    <span className={chore.completed ? "line-through" : ""}>
                      {chore.name}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      Created by: {chore.createdBy}
                      {chore.completedBy && ` • Completed by: ${chore.completedBy}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={chore.completed ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleChoreCompletion(chore.id)}
                    >
                      {chore.completed ? "Undo" : "Complete"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteChore(chore.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Chores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {weeklyChores.map((chore) => (
                <li key={chore.id} className="flex items-center justify-between gap-4">
                  <div>
                    <span className={chore.completed ? "line-through" : ""}>
                      {chore.name}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      Created by: {chore.createdBy}
                      {chore.completedBy && ` • Completed by: ${chore.completedBy}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={chore.completed ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleChoreCompletion(chore.id)}
                    >
                      {chore.completed ? "Undo" : "Complete"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteChore(chore.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Chores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {monthlyChores.map((chore) => (
                <li key={chore.id} className="flex items-center justify-between gap-4">
                  <div>
                    <span className={chore.completed ? "line-through" : ""}>
                      {chore.name}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      Created by: {chore.createdBy}
                      {chore.completedBy && ` • Completed by: ${chore.completedBy}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={chore.completed ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleChoreCompletion(chore.id)}
                    >
                      {chore.completed ? "Undo" : "Complete"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteChore(chore.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

