"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, DollarSign, Newspaper } from "lucide-react"
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

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Newspaper className="h-5 w-5 mr-2" />
              New York Times Crosswords
            </CardTitle>
            <CardDescription>Daily crossword puzzles from The New York Times.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full rounded-lg overflow-hidden border">
              <iframe 
                src="https://www.nytimes.com/crosswords" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen
                title="New York Times Crosswords"
                loading="lazy"
              />
            </div>
            <div className="mt-4 text-center">
              <a 
                href="https://www.nytimes.com/crosswords" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Open in new tab
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

