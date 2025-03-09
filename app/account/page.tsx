"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SumikkoHeader } from "@/components/sumikko-header"
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

export default function AccountPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newUsername, setNewUsername] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push("/login")
          return
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        if (profile) {
          setCurrentUser(profile)
          setNewUsername(profile.username)
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleUpdateUsername = async () => {
    if (!currentUser || !newUsername.trim() || newUsername === currentUser.username) return

    setIsSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: newUsername.trim() })
        .eq("id", currentUser.id)

      if (error) throw error

      setMessage({ type: "success", text: "Username updated successfully!" })
      setCurrentUser(prev => prev ? { ...prev, username: newUsername.trim() } : null)
    } catch (error) {
      console.error("Error updating username:", error)
      setMessage({ type: "error", text: "Failed to update username. Please try again." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword || !currentPassword) {
      setMessage({ type: "error", text: "Please fill in all password fields." })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords don't match." })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setMessage({ type: "success", text: "Password updated successfully!" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      console.error("Error updating password:", error)
      setMessage({ type: "error", text: "Failed to update password. Please try again." })
    } finally {
      setIsSaving(false)
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

  return (
    <div className="min-h-screen">
      <SumikkoHeader showBackButton />
      
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>Update your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {message && (
              <div className={`p-4 rounded-lg ${
                message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {message.text}
              </div>
            )}
            
            {/* Username Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Change Username</h3>
                <p className="text-sm text-muted-foreground">
                  Your current username is: {currentUser.username}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">New Username</Label>
                <Input
                  id="username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter new username"
                />
              </div>
              <Button
                onClick={handleUpdateUsername}
                disabled={!newUsername.trim() || newUsername === currentUser.username || isSaving}
              >
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                ) : (
                  "Update Username"
                )}
              </Button>
            </div>

            <div className="border-t pt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Change Password</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a strong password to secure your account
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
                <Button
                  onClick={handleUpdatePassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword || isSaving}
                >
                  {isSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 