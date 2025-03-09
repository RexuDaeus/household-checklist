"use client"

import { Home, LogOut } from "lucide-react"
import { ModeToggle } from "./mode-toggle"
import { Button, buttonVariants } from "./ui/button"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useEffect, useState } from "react"
import { useGuest } from "@/lib/guest-context"

interface SumikkoHeaderProps {
  showBackButton?: boolean
  hideAuth?: boolean
  username?: string
}

export function SumikkoHeader({ 
  showBackButton = false, 
  hideAuth = false,
  username: propUsername
}: SumikkoHeaderProps) {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(propUsername || null)
  const [isLoading, setIsLoading] = useState(!propUsername)
  const { isGuest, setIsGuest } = useGuest()

  useEffect(() => {
    if (propUsername) {
      setIsLoading(false)
      return
    }

    async function getUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", session.user.id)
            .single()
          
          setUsername(profile?.username || null)
        }
      } catch (error) {
        console.error("Error fetching user:", error)
      } finally {
        setIsLoading(false)
      }
    }

    getUser()
  }, [propUsername])

  useEffect(() => {
    if (propUsername) {
      setUsername(propUsername)
    }
  }, [propUsername])

  const handleLogout = async () => {
    try {
      if (isGuest) {
        setIsGuest(false)
      } else {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      }

      document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
      
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Error logging out:", error)
    }
  }

  if (isLoading) {
    return <div className="w-full h-[88px] bg-background" />
  }

  return (
    <header className="w-full px-4 py-6 mb-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-full">
              <Home className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">
                Sumikko House
              </h1>
              <p className="text-sm text-muted-foreground">
                Unit 202/6 Joseph Road, Footscray
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {(username || isGuest) && !hideAuth && (
              <>
                <button
                  onClick={() => !isGuest && router.push("/account")}
                  className={`flex items-center gap-2 px-4 py-2 bg-secondary rounded-full ${
                    !isGuest ? "hover:bg-secondary/80 transition-colors cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {isGuest ? "G" : username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {isGuest ? "Guest" : `Hi, ${username}`}
                    </span>
                    {isGuest && (
                      <span className="text-xs text-muted-foreground">
                        View-only mode
                      </span>
                    )}
                  </div>
                </button>
                {showBackButton && (
                  <Button
                    className={buttonVariants({ variant: "secondary", className: "sumikko-button" })}
                    onClick={() => router.push("/dashboard")}
                  >
                    Back to Dashboard
                  </Button>
                )}
                <Button
                  className={buttonVariants({ variant: "secondary", className: "sumikko-button" })}
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  {isGuest ? "Exit Guest Mode" : "Logout"}
                </Button>
              </>
            )}
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  )
} 