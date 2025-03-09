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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!email || !username || !password || !confirmPassword) {
      setError("Please fill in all fields")
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      // Register the user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      })

      if (authError) {
        setError(`Auth Error: ${authError.message}`)
        setIsLoading(false)
        return
      }

      if (!authData.user?.id) {
        setError("Failed to create user account")
        setIsLoading(false)
        return
      }

      // Create a profile in the profiles table
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .insert([{
          id: authData.user.id,
          username: username,
          created_at: new Date().toISOString()
        }])
        .select()

      if (profileError) {
        console.error("Profile creation error details:", {
          error: profileError,
          errorMessage: profileError.message,
          errorDetails: profileError.details,
          hint: profileError.hint,
          code: profileError.code
        })
        setError(`Profile Error: ${profileError.message}. Code: ${profileError.code}`)
        // Try to clean up the auth user since profile creation failed
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      // Show verification message instead of redirecting
      setIsRegistered(true)
      setIsLoading(false)
    } catch (error) {
      console.error("Registration error:", error)
      setError(error instanceof Error ? error.message : "Failed to register")
      setIsLoading(false)
    }
  }

  if (isRegistered) {
    return (
      <div className="min-h-screen flex flex-col">
        <SumikkoHeader hideAuth />
        <div className="flex-1 flex items-center justify-center p-6 md:p-8">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle>Registration Successful</CardTitle>
              <CardDescription>Please verify your email address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800">
                <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <AlertTitle className="text-sky-800 dark:text-sky-200 font-medium text-sm">Verification Required</AlertTitle>
                <AlertDescription className="text-sky-700 dark:text-sky-300">
                  We've sent a verification email to <strong>{email}</strong>. 
                  Please check your inbox and click the verification link to complete your registration.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground mt-2">
                Once verified, you'll be able to sign in to your account.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button className="w-full" onClick={() => router.push("/login")}>
                Go to Login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SumikkoHeader hideAuth />
      <div className="flex-1 flex items-center justify-center p-6 md:p-8">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Register to manage household chores</CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
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
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
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
                  placeholder="Choose a password"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
              <p className="text-sm text-center">
                Already have an account?{" "}
                <Link href="/login" className="underline">
                  Login
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

