"use client"

import { useState, useEffect, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ClipboardList, DollarSign, Camera, Send, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SumikkoHeader } from "@/components/sumikko-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Import the auth helper functions
import { getUserFromCookie, clearUserCookie } from "@/lib/auth"

interface Post {
  id: string;
  imageUrl: string;
  caption: string;
  createdBy: string;
  createdAt: string;
}

export default function Dashboard() {
  const [username, setUsername] = useState("")
  const [posts, setPosts] = useState<Post[]>([])
  const [newCaption, setNewCaption] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    console.log("Dashboard: Checking authentication...")
    const username = getUserFromCookie()
    console.log("Dashboard: Username from cookie:", username)

    if (username) {
      setUsername(username)
    } else {
      console.log("Dashboard: No user found, redirecting to login")
      router.push("/login")
    }

    // Load posts from localStorage
    const savedPosts = localStorage.getItem("community_posts")
    if (savedPosts) {
      setPosts(JSON.parse(savedPosts))
    }
  }, [router])

  useEffect(() => {
    // Save posts to localStorage whenever they change
    if (posts.length > 0) {
      localStorage.setItem("community_posts", JSON.stringify(posts))
    }
  }, [posts])

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCaptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setNewCaption(e.target.value)
  }

  const addPost = () => {
    if (!selectedImage || !newCaption) return

    const newPost: Post = {
      id: Date.now().toString(),
      imageUrl: previewUrl!,
      caption: newCaption,
      createdBy: username,
      createdAt: new Date().toISOString()
    }

    setPosts([newPost, ...posts])
    setNewCaption("")
    setSelectedImage(null)
    setPreviewUrl(null)
  }

  const deletePost = (id: string) => {
    // Filter out the post to delete
    const updatedPosts = posts.filter((post) => post.id !== id);
    
    // Update state with new posts array
    setPosts(updatedPosts);
    
    // Also update localStorage immediately
    localStorage.setItem("community_posts", JSON.stringify(updatedPosts));
    
    console.log(`Post ${id} deleted successfully`);
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div className="min-h-screen">
      <SumikkoHeader 
        username={username} 
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
              <Camera className="h-5 w-5 mr-2" />
              Community Board
            </CardTitle>
            <CardDescription>Share photos and updates with your housemates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label 
                  htmlFor="photo-upload" 
                  className="block w-full aspect-video bg-muted/30 rounded-lg border-2 border-dashed border-muted hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  {previewUrl ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={previewUrl}
                        alt="Preview"
                        fill
                        className="object-cover rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full space-y-2 text-muted-foreground">
                      <Camera className="h-8 w-8" />
                      <span>Click to upload a photo</span>
                    </div>
                  )}
                </label>
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
              <div className="space-y-2">
                <Textarea
                  placeholder="Write a caption..."
                  value={newCaption}
                  onChange={handleCaptionChange}
                  className="min-h-[100px]"
                />
              </div>
              <Button 
                className="w-full"
                onClick={addPost}
                disabled={!selectedImage || !newCaption}
              >
                <Send className="h-4 w-4 mr-2" />
                Share Post
              </Button>
            </div>

            <div className="space-y-6">
              {posts.map((post) => (
                <Card key={post.id} className="overflow-hidden">
                  <div className="relative aspect-video">
                    <Image
                      src={post.imageUrl}
                      alt={`Post by ${post.createdBy}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Avatar>
                          <AvatarFallback>
                            {post.createdBy.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{post.createdBy}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(post.createdAt)}
                          </p>
                        </div>
                      </div>
                      {post.createdBy === username && (
                        <Button
                          onClick={() => deletePost(post.id)}
                          className={cn(
                            "h-8 w-8 p-0",
                            "text-destructive hover:text-destructive",
                            "hover:bg-destructive/10"
                          )}
                        >
                          <Trash className="h-4 w-4" />
                          <span className="sr-only">Delete post</span>
                        </Button>
                      )}
                    </div>
                    <p className="text-muted-foreground">{post.caption}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

