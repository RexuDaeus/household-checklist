"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { SumikkoHeader } from "@/components/sumikko-header"
import { supabase } from "@/lib/supabase"
import { setUserCookie } from "@/lib/auth"
import { useGuest } from "@/lib/guest-context"
import { Separator } from "@/components/ui/separator"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { setIsGuest } = useGuest()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      console.log("Attempting to login with:", { email })
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log("Supabase login response:", { data, error })

      if (error) throw error

      // Extract username from email (remove @domain.com)
      const username = email.split('@')[0]
      
      try {
        // Also attempt to get profile data if available
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.user.id)
          .single()
          
        console.log("Profile data:", profileData)
        
        // Use profile username if available, otherwise use email-based username
        const displayUsername = profileData?.username || username
        
        // Important: Set cookie with username for dashboard
        setUserCookie(displayUsername)
        
        console.log("Login successful, username set:", displayUsername)
      } catch (profileError) {
        console.error("Error fetching profile, using fallback username:", username, profileError)
        // Still set the cookie with email-based username if profile fetch fails
        setUserCookie(username)
      }
      
      console.log("Login successful, redirecting to dashboard")
      
      // Force a hard navigation instead of client-side navigation
      window.location.href = "/dashboard"
    } catch (error) {
      console.error("Login error:", error)
      setError(error instanceof Error ? error.message : "Failed to login")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGuestAccess = () => {
    setIsGuest(true)
    setUserCookie("Guest")
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SumikkoHeader hideAuth />
      <div className="flex-1 flex items-center justify-center p-6 md:p-8">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your credentials to access your household chores</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
              <div className="w-full flex items-center gap-4 my-4">
                <Separator className="flex-1" />
                <span className="text-sm text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>
              <Button 
                type="button"
                variant="outline" 
                className="w-full"
                onClick={handleGuestAccess}
              >
                Continue as Guest
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Guest users can view but not edit any content
              </p>
              <p className="text-sm text-center mt-4">
                Don't have an account?{" "}
                <Link href="/register" className="underline">
                  Create one
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

