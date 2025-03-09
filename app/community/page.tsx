"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Trash, Upload } from "lucide-react"
import Image from "next/image"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SumikkoHeader } from "@/components/sumikko-header"
import { supabase } from "@/lib/supabase"
import type { CommunityPost, Profile } from "@/lib/supabase"
import { useGuest } from "@/lib/guest-context"

export default function CommunityPage() {
  const [posts, setPosts] = useState<(CommunityPost & { author: Profile })[]>([])
  const [caption, setCaption] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { isGuest } = useGuest()

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        
        // For guest mode, load data without requiring auth
        if (isGuest) {
          // Get all posts with author information
          const { data: allPosts } = await supabase
            .from("community_posts")
            .select("*, author:profiles(*)")
            .order("created_at", { ascending: false })

          if (allPosts) {
            setPosts(allPosts as (CommunityPost & { author: Profile })[])
          }
          
          setIsLoading(false)
          return
        }
        
        // For authenticated users, proceed with normal flow
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

          // Get all posts with author information
          const { data: allPosts } = await supabase
            .from("community_posts")
            .select("*, author:profiles(*)")
            .order("created_at", { ascending: false })

          if (allPosts) {
            setPosts(allPosts as (CommunityPost & { author: Profile })[])
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Set up real-time subscription for posts
    const postsSubscription = supabase
      .channel("community_posts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_posts"
        },
        async () => {
          // Reload posts when there's a change
          const { data: allPosts } = await supabase
            .from("community_posts")
            .select("*, author:profiles(*)")
            .order("created_at", { ascending: false })

          if (allPosts) {
            setPosts(allPosts as (CommunityPost & { author: Profile })[])
          }
        }
      )
      .subscribe()

    return () => {
      postsSubscription.unsubscribe()
    }
  }, [router, isGuest])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file || !caption || !currentUser || isGuest) return

    setIsUploading(true)

    try {
      // Upload image to Supabase Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${currentUser.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("community-photos")
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from("community-photos")
        .getPublicUrl(filePath)

      // Create post in the database
      const { error: postError } = await supabase
        .from("community_posts")
        .insert([{
          user_id: currentUser.id,
          caption,
          image_url: publicUrl,
          created_at: new Date().toISOString()
        }])

      if (postError) throw postError

      setCaption("")
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Error uploading post:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (post: CommunityPost) => {
    if (!currentUser || post.user_id !== currentUser.id) return

    try {
      // Delete image from storage
      const imagePath = post.image_url.split("/").pop()
      if (imagePath) {
        await supabase.storage
          .from("community-photos")
          .remove([`${post.user_id}/${imagePath}`])
      }

      // Delete post from database
      const { error } = await supabase
        .from("community_posts")
        .delete()
        .eq("id", post.id)

      if (error) throw error
    } catch (error) {
      console.error("Error deleting post:", error)
    }
  }

  if (isLoading) {
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
      
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {isGuest ? (
          <Card>
            <CardHeader>
              <CardTitle>Guest Mode</CardTitle>
              <CardDescription>You are viewing in guest mode</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                You need to be logged in to share photos. You can view community posts but cannot add new ones.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Share a Photo</CardTitle>
              <CardDescription>Upload a photo to share with your housemates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="photo">Photo</Label>
                <Input
                  ref={fileInputRef}
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isUploading || isGuest}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caption">Caption</Label>
                <Textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption..."
                  disabled={isUploading || isGuest}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleUpload}
                disabled={!file || !caption || isUploading || isGuest}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Share Photo"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="pt-6">
                <div className="aspect-video relative mb-4">
                  <Image
                    src={post.image_url}
                    alt={post.caption}
                    fill
                    className="object-cover rounded-md"
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{post.author.username}</p>
                    <p className="text-muted-foreground">{post.caption}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {!isGuest && post.user_id === currentUser?.id && (
                    <Button
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className: "text-destructive hover:text-destructive-foreground"
                      })}
                      onClick={() => handleDelete(post)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
} 