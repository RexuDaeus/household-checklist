"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { SumikkoHeader } from "@/components/sumikko-header"
import { supabase } from "@/lib/supabase"
import type { Chore, Profile } from "@/lib/supabase"

export default function ChoresPage() {
  const [chores, setChores] = useState<Chore[]>([])
  const [newChoreName, setNewChoreName] = useState("")
  const [newChoreFrequency, setNewChoreFrequency] = useState<"daily" | "weekly" | "monthly">("daily")
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      try {
        // Get current user session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push("/login")
          return
        }

        // Get current user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        if (profile) {
          setCurrentUser(profile)

          // Get all users
          const { data: allUsers } = await supabase
            .from("profiles")
            .select("*")

          if (allUsers) {
            setUsers(allUsers)
          }

          // Get all chores
          const { data: allChores } = await supabase
            .from("chores")
            .select("*")
            .order("created_at", { ascending: false })

          if (allChores) {
            setChores(allChores)
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Set up real-time subscription for chores
    const choresSubscription = supabase
      .channel("chores")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chores"
        },
        async (payload) => {
          // Reload chores when there's a change
          const { data: allChores } = await supabase
            .from("chores")
            .select("*")
            .order("created_at", { ascending: false })

          if (allChores) {
            setChores(allChores)
          }
        }
      )
      .subscribe()

    return () => {
      choresSubscription.unsubscribe()
    }
  }, [router])

  const handleAddChore = async () => {
    if (!newChoreName || !currentUser) return

    try {
      const { error } = await supabase
        .from("chores")
        .insert([{
          title: newChoreName,
          frequency: newChoreFrequency,
          assigned_to: null,
          created_at: new Date().toISOString(),
          lastReset: new Date().toISOString()
        }])

      if (error) throw error

      setNewChoreName("")
    } catch (error) {
      console.error("Error adding chore:", error)
    }
  }

  const handleAssignChore = async (choreId: string, userId: string | null) => {
    try {
      const { error } = await supabase
        .from("chores")
        .update({ assigned_to: userId })
        .eq("id", choreId)

      if (error) throw error
    } catch (error) {
      console.error("Error assigning chore:", error)
    }
  }

  const handleDeleteChore = async (id: string) => {
    try {
      const { error } = await supabase
        .from("chores")
        .delete()
        .eq("id", id)

      if (error) throw error
    } catch (error) {
      console.error("Error deleting chore:", error)
    }
  }

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen">
        <SumikkoHeader showBackButton />
        <div className="max-w-7xl mx-auto px-4">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Group chores by frequency
  const dailyChores = chores.filter((chore) => chore.frequency === "daily")
  const weeklyChores = chores.filter((chore) => chore.frequency === "weekly")
  const monthlyChores = chores.filter((chore) => chore.frequency === "monthly")

  const ChoresList = ({ chores }: { chores: Chore[] }) => (
    <ul className="space-y-4">
      {chores.map((chore) => {
        const assignedUser = users.find(u => u.id === chore.assigned_to)
        return (
          <li key={chore.id} className="flex items-center justify-between gap-4">
            <div>
              <span>{chore.title}</span>
              <div className="text-sm text-muted-foreground">
                {assignedUser ? `Assigned to: ${assignedUser.username}` : "Unassigned"}
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={chore.assigned_to || ""}
                onValueChange={(value: string) => handleAssignChore(chore.id, value || null)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassign</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "text-destructive hover:text-destructive-foreground"
                })}
                onClick={() => handleDeleteChore(chore.id)}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="min-h-screen">
      <SumikkoHeader showBackButton />
      
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
              <Select value={newChoreFrequency} onValueChange={(value: "daily" | "weekly" | "monthly") => setNewChoreFrequency(value)}>
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
            <Button className="w-full" onClick={handleAddChore}>
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
            <ChoresList chores={dailyChores} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Chores</CardTitle>
          </CardHeader>
          <CardContent>
            <ChoresList chores={weeklyChores} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Chores</CardTitle>
          </CardHeader>
          <CardContent>
            <ChoresList chores={monthlyChores} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

