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

          // Set up real-time subscription for chores
          const channel = supabase
            .channel("chores-channel-" + Date.now()) // Use unique channel name
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "chores"
              },
              (payload) => {
                console.log("Realtime payload received for chores:", payload);
                
                // For INSERT events, add the new chore directly to state
                if (payload.eventType === 'INSERT') {
                  console.log("Adding new chore to state:", payload.new);
                  setChores(prevChores => [payload.new as Chore, ...prevChores]);
                } 
                // For UPDATE events, update the existing chore
                else if (payload.eventType === 'UPDATE') {
                  console.log("Updating chore in state:", payload.new);
                  setChores(prevChores => 
                    prevChores.map(chore => 
                      chore.id === payload.new.id ? payload.new as Chore : chore
                    )
                  );
                }
                // For DELETE events, remove the chore
                else if (payload.eventType === 'DELETE') {
                  console.log("Removing chore from state:", payload.old);
                  setChores(prevChores => 
                    prevChores.filter(chore => chore.id !== payload.old.id)
                  );
                }
              }
            )
            .subscribe((status) => {
              console.log("Chores channel subscription status:", status);
            });

          // Save channel to be unsubscribed on cleanup
          return () => {
            console.log("Unsubscribing from chores channel");
            channel.unsubscribe();
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleAddChore = async () => {
    if (!newChoreName || !currentUser) return;

    try {
      // Get current user session to ensure we have a valid user ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        alert("You must be logged in to add a chore.");
        return;
      }

      const newChore = {
        title: newChoreName,
        frequency: newChoreFrequency,
        assigned_to: null,
        created_by: session.user.id,
        created_at: new Date().toISOString(),
        lastReset: new Date().toISOString()
      };

      console.log("Creating new chore:", newChore);

      // Optimistically update UI first
      const tempId = Date.now().toString();
      const tempChore: Chore = {
        id: tempId,
        ...newChore
      };
      
      setChores(prevChores => [tempChore, ...prevChores]);

      // Then send to database
      const { data, error } = await supabase
        .from("chores")
        .insert([newChore])
        .select();

      if (error) {
        console.error("Supabase error adding chore:", error);
        // Keep the temporary chore in place with a note that it's not synced
        alert("Chore added locally. Note: Database sync failed, but chore is visible for this session.");
      } else {
        console.log("Chore added successfully to database:", data);
        // If the database insertion was successful, we might want to replace the temp chore
        // with the real one that has the proper ID from the database
        if (data && data.length > 0) {
          setChores(prevChores => {
            return prevChores.map(chore => 
              chore.id === tempId ? data[0] : chore
            );
          });
        }
      }

      setNewChoreName("");
    } catch (error) {
      console.error("Error adding chore:", error);
      alert("Failed to add chore. Please check the console for details.");
    }
  }

  const handleAssignChore = async (choreId: string, userId: string | null) => {
    try {
      // If userId is an empty string or "unassigned", convert it to null
      const assignedTo = userId === "" || userId === "unassigned" ? null : userId;
      
      // Update UI optimistically
      setChores(prevChores => prevChores.map(chore => 
        chore.id === choreId ? { ...chore, assigned_to: assignedTo } : chore
      ));
      
      console.log(`Optimistically assigned chore ${choreId} to user ${assignedTo || 'none'}`);
      
      // Then update in database
      const { error } = await supabase
        .from("chores")
        .update({ assigned_to: assignedTo })
        .eq("id", choreId);

      if (error) {
        console.error("Error assigning chore:", error);
        alert("Failed to update assignment on the server. The change may not persist if you reload.");
      } else {
        console.log("Successfully assigned chore in database");
      }
    } catch (error) {
      console.error("Error assigning chore:", error);
    }
  }

  const handleDeleteChore = async (id: string) => {
    try {
      // Update UI optimistically
      setChores(prevChores => prevChores.filter(chore => chore.id !== id));
      
      console.log(`Optimistically deleted chore ${id}`);
      
      // Then delete from database
      const { error } = await supabase
        .from("chores")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting chore:", error);
        alert("Failed to delete on the server. The item may reappear if you reload.");
        
        // If there was an error, we could fetch the chores again to restore the state
        // But this would be jarring to the user, so we'll just alert them
      } else {
        console.log("Successfully deleted chore from database");
      }
    } catch (error) {
      console.error("Error deleting chore:", error);
    }
  }

  const handleToggleChore = async (choreId: string, currentStatus: boolean) => {
    try {
      // Update UI optimistically
      setChores(prevChores => prevChores.map(chore => 
        chore.id === choreId ? { ...chore, is_completed: !currentStatus } : chore
      ));
      
      console.log(`Optimistically toggled chore ${choreId} completion to ${!currentStatus}`);
      
      // Then update in database
      const { error } = await supabase
        .from("chores")
        .update({ 
          is_completed: !currentStatus,
          lastReset: currentStatus ? null : new Date().toISOString() // Update lastReset when completing
        })
        .eq("id", choreId);

      if (error) {
        console.error("Error toggling chore:", error);
        alert("Failed to update completion on the server. The change may not persist if you reload.");
      } else {
        console.log("Successfully toggled chore in database");
      }
    } catch (error) {
      console.error("Error toggling chore:", error);
    }
  }

  const getUsernameById = (userId: string | null | undefined): string => {
    if (!userId) return "Unassigned";
    if (userId === currentUser?.id) return `${currentUser.username} (You)`;
    const user = users.find(u => u.id === userId);
    return user ? user.username : "Unknown User";
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
                onValueChange={(value) => handleAssignChore(chore.id, value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassign</SelectItem>
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
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
        <Card>
          <CardHeader>
            <CardTitle>Add New Chore</CardTitle>
            <CardDescription>Create a new chore and set its frequency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
                <Label>Frequency</Label>
                <Select
                  value={newChoreFrequency}
                  onValueChange={(value: "daily" | "weekly" | "monthly") => 
                    setNewChoreFrequency(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full"
                onClick={handleAddChore}
                disabled={!newChoreName}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Chore
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Daily Chores */}
        {dailyChores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Chores</CardTitle>
              <CardDescription>Reset automatically at 4 AM Sydney time</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {dailyChores.map((chore) => (
                  <li key={chore.id} className="flex items-center justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={chore.is_completed}
                          onChange={() => handleToggleChore(chore.id, chore.is_completed || false)}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className={`text-lg ${chore.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                          {chore.title}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span>Created by: {getUsernameById(chore.created_by)}</span>
                        {chore.assigned_to && (
                          <span className="ml-2">• Assigned to: {getUsernameById(chore.assigned_to)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={chore.assigned_to || "unassigned"}
                        onValueChange={(value) => handleAssignChore(chore.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteChore(chore.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Weekly Chores */}
        {weeklyChores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Weekly Chores</CardTitle>
              <CardDescription>Reset automatically every Monday at 4 AM Sydney time</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {weeklyChores.map((chore) => (
                  <li key={chore.id} className="flex items-center justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={chore.is_completed}
                          onChange={() => handleToggleChore(chore.id, chore.is_completed || false)}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className={`text-lg ${chore.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                          {chore.title}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span>Created by: {getUsernameById(chore.created_by)}</span>
                        {chore.assigned_to && (
                          <span className="ml-2">• Assigned to: {getUsernameById(chore.assigned_to)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={chore.assigned_to || "unassigned"}
                        onValueChange={(value) => handleAssignChore(chore.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteChore(chore.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Monthly Chores */}
        {monthlyChores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Chores</CardTitle>
              <CardDescription>Reset automatically on the 1st of each month at 4 AM Sydney time</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {monthlyChores.map((chore) => (
                  <li key={chore.id} className="flex items-center justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={chore.is_completed}
                          onChange={() => handleToggleChore(chore.id, chore.is_completed || false)}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className={`text-lg ${chore.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                          {chore.title}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span>Created by: {getUsernameById(chore.created_by)}</span>
                        {chore.assigned_to && (
                          <span className="ml-2">• Assigned to: {getUsernameById(chore.assigned_to)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={chore.assigned_to || "unassigned"}
                        onValueChange={(value) => handleAssignChore(chore.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteChore(chore.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

