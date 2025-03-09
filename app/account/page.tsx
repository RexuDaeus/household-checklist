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
  const [newName, setNewName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
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
          setNewName(profile.username)
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleUpdateName = async () => {
    if (!currentUser || !newName.trim() || newName === currentUser.username) return

    setIsSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: newName.trim() })
        .eq("id", currentUser.id)

      if (error) throw error

      setMessage({ type: "success", text: "Name updated successfully!" })
      setCurrentUser(prev => prev ? { ...prev, username: newName.trim() } : null)
    } catch (error) {
      console.error("Error updating name:", error)
      setMessage({ type: "error", text: "Failed to update name. Please try again." })
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || !currentUser) return;
    
    setIsDeletingAccount(true);
    setMessage(null);

    try {
      // Step 1: Delete the user's profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", currentUser.id);

      if (profileError) throw profileError;

      // Step 2: Delete the user's auth account
      const { error: authError } = await supabase.auth.admin.deleteUser(
        currentUser.id
      );

      if (authError) {
        // If we can't delete the auth user (might be due to permissions),
        // still let the user know their profile was deleted
        console.error("Error deleting auth user:", authError);
        // Try to sign out at least
        await supabase.auth.signOut();
        document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
        router.push("/login");
        return;
      }

      // Step 3: Sign out and redirect to login
      await supabase.auth.signOut();
      document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
      router.push("/login");
    } catch (error) {
      console.error("Error deleting account:", error);
      setMessage({ 
        type: "error", 
        text: "Failed to delete account. Please try again or contact support." 
      });
      setIsDeletingAccount(false);
    }
  };

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
            
            {/* Name Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Change Name</h3>
                <p className="text-sm text-muted-foreground">
                  Your current name is: {currentUser.username}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">New Name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter new name"
                />
              </div>
              <Button
                onClick={handleUpdateName}
                disabled={!newName.trim() || newName === currentUser.username || isSaving}
              >
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                ) : (
                  "Update Name"
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

            <div className="border-t pt-6 mt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-destructive">Delete Account</h3>
                  <p className="text-sm text-muted-foreground">
                    This action is permanent and cannot be undone. All your data will be removed.
                  </p>
                </div>
                {confirmDelete ? (
                  <div className="space-y-4 p-4 border border-destructive/50 rounded-lg bg-destructive/5">
                    <p className="text-sm font-medium text-destructive">
                      Please type "DELETE" to confirm account deletion:
                    </p>
                    <div className="space-y-2">
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="border-destructive/50"
                      />
                    </div>
                    <div className="flex flex-row gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                      >
                        {isDeletingAccount ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
                        ) : (
                          "Confirm Delete"
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setConfirmDelete(false);
                          setDeleteConfirmText("");
                        }}
                        disabled={isDeletingAccount}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete Account
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 