"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SumikkoHeader } from "@/components/sumikko-header"
import { getUserFromCookie } from "@/lib/auth"

export default function Dashboard() {
  const [username, setUsername] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Get username from cookie
    const username = getUserFromCookie()
    console.log("Dashboard: Username from cookie:", username)
    
    if (username) {
      setUsername(username)
    } else {
      console.error("No username found in cookie")
      router.push("/login")
    }
  }, [router])

  return (
    <div className="min-h-screen">
      <SumikkoHeader 
        name={username} 
        showBackButton={false} 
      />
      
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ClipboardList className="h-5 w-5 mr-2" />
              Manage Chores
            </CardTitle>
            <CardDescription>Create and manage household chores.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/chores")}>
              View Chores
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Manage Bills
            </CardTitle>
            <CardDescription>Track and split household bills.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/bills")}>
              View Bills
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

