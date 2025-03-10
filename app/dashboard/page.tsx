"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, DollarSign, Newspaper, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SumikkoHeader } from "@/components/sumikko-header"
import { getUserFromCookie } from "@/lib/auth"
import { supabase, Profile } from "@/lib/supabase"
import { ProfileAvatar } from "@/components/profile-avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"

// Define a type for the key holder data
type KeyHolder = {
  userId: string;
  username: string;
  hasKey: boolean;
};

type OtherKeyHolder = {
  name: string;
  hasKey: boolean;
};

export default function Dashboard() {
  const [username, setUsername] = useState("")
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [keyHolders, setKeyHolders] = useState<KeyHolder[]>([])
  const [otherKeyHolder, setOtherKeyHolder] = useState<OtherKeyHolder>({ name: "", hasKey: false })
  const [keyHolderError, setKeyHolderError] = useState<string | null>(null)
  const [isLoadingKeyHolders, setIsLoadingKeyHolders] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadUserProfile() {
      // Get username from cookie
      const username = getUserFromCookie()
      console.log("Dashboard: Username from cookie:", username)
      
      if (username) {
        setUsername(username)
        
        try {
          // Get the current user session
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            // Get the user profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single()
            
            if (profile) {
              setUserProfile(profile)
            }

            // Get all users for the key holders feature
            const { data: allUsers } = await supabase
              .from("profiles")
              .select("*")
            
            if (allUsers) {
              setUsers(allUsers)
              
              // Initialize key holders from all users
              const initialKeyHolders = allUsers.map(user => ({
                userId: user.id,
                username: user.username,
                hasKey: false
              }));
              
              setKeyHolders(initialKeyHolders)
            }
            
            // Load key holders data from the database
            await loadKeyHolders()
          }
        } catch (error) {
          console.error("Error loading user profile:", error)
        }
      } else {
        console.error("No username found in cookie")
        router.push("/login")
      }
    }
    
    loadUserProfile()
  }, [router])

  // Load key holders data from the database
  const loadKeyHolders = async () => {
    try {
      setIsLoadingKeyHolders(true);
      
      // Get key holders data
      const { data: keyHoldersData, error } = await supabase
        .from("key_holders")
        .select("*")
        .single();
      
      if (error) {
        if (error.code === "PGRST116") {
          // No data found, create initial record
          const initialData = {
            users: [],
            other: { name: "", hasKey: false }
          };
          
          await supabase
            .from("key_holders")
            .insert([{ data: initialData }]);
            
          return; // Exit and let the realtime subscription handle the update
        } else {
          console.error("Error loading key holders:", error);
          return;
        }
      }
      
      if (keyHoldersData?.data) {
        // Update keyHolders state with the saved data
        const savedData = keyHoldersData.data;
        
        if (savedData.users) {
          setKeyHolders(prevKeyHolders => 
            prevKeyHolders.map(kh => ({
              ...kh,
              hasKey: savedData.users.some((u: any) => u.userId === kh.userId && u.hasKey)
            }))
          );
        }
        
        if (savedData.other) {
          setOtherKeyHolder(savedData.other);
        }
      }
    } catch (error) {
      console.error("Error loading key holders:", error);
    } finally {
      setIsLoadingKeyHolders(false);
    }
  };

  // Toggle a user's key holder status
  const toggleKeyHolder = async (userId: string) => {
    try {
      // Get the current key holder count
      const currentKeyCount = keyHolders.filter(kh => kh.hasKey).length + (otherKeyHolder.hasKey ? 1 : 0);
      const userToToggle = keyHolders.find(kh => kh.userId === userId);
      
      if (!userToToggle) return;
      
      // If we're trying to add a new key holder and already have 3, show an error
      if (!userToToggle.hasKey && currentKeyCount >= 3) {
        setKeyHolderError("Maximum of 3 key holders allowed");
        return;
      }
      
      setKeyHolderError(null);
      
      // Update the state
      setKeyHolders(prevKeyHolders => 
        prevKeyHolders.map(kh => 
          kh.userId === userId 
            ? { ...kh, hasKey: !kh.hasKey } 
            : kh
        )
      );
      
      // Save to database
      await saveKeyHolders();
    } catch (error) {
      console.error("Error toggling key holder:", error);
    }
  }

  // Toggle the "Other" key holder
  const toggleOtherKeyHolder = async () => {
    try {
      // Get the current key holder count
      const currentKeyCount = keyHolders.filter(kh => kh.hasKey).length + (otherKeyHolder.hasKey ? 1 : 0);
      
      // If we're trying to add a new key holder and already have 3, show an error
      if (!otherKeyHolder.hasKey && currentKeyCount >= 3) {
        setKeyHolderError("Maximum of 3 key holders allowed");
        return;
      }
      
      setKeyHolderError(null);
      
      // Update the state
      setOtherKeyHolder(prev => ({
        ...prev,
        hasKey: !prev.hasKey
      }));
      
      // Save to database
      await saveKeyHolders();
    } catch (error) {
      console.error("Error toggling other key holder:", error);
    }
  }

  // Update the "Other" key holder name
  const updateOtherKeyHolderName = (name: string) => {
    setOtherKeyHolder(prev => ({
      ...prev,
      name
    }));
  }

  // Save key holders to the database
  const saveKeyHolders = async () => {
    try {
      // Prepare the data to save
      const keyHoldersData = {
        users: keyHolders
          .filter(kh => kh.hasKey) // Only save users who have keys
          .map(kh => ({
            userId: kh.userId,
            username: kh.username,
            hasKey: true
          })),
        other: otherKeyHolder
      };
      
      // Get the current record
      const { data: existingData } = await supabase
        .from("key_holders")
        .select("id")
        .single();
      
      if (existingData) {
        // Update existing record
        await supabase
          .from("key_holders")
          .update({ data: keyHoldersData })
          .eq("id", existingData.id);
      } else {
        // Insert new record
        await supabase
          .from("key_holders")
          .insert([{ data: keyHoldersData }]);
      }
    } catch (error) {
      console.error("Error saving key holders:", error);
    }
  };

  // Add realtime subscription for key holders
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('key-holders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'key_holders'
        },
        () => {
          loadKeyHolders(); // Reload data when changes occur
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <SumikkoHeader 
        name={username} 
        showBackButton={false} 
      />
      
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 gap-6">
        {/* Current Key Holders - Full width at the top */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Key className="h-5 w-5 mr-2" />
              Current Key Holders
            </CardTitle>
            <CardDescription>Track who currently has the house keys.</CardDescription>
          </CardHeader>
          <CardContent>
            {keyHolderError && (
              <Alert variant="destructive" className="mb-4">
                {keyHolderError}
              </Alert>
            )}
            
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-2">
                Select who currently has the house keys (maximum 3):
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {keyHolders.map((keyHolder) => (
                  <div key={keyHolder.userId} className="flex items-center space-x-2">
                    <Checkbox
                      id={`key-holder-${keyHolder.userId}`}
                      checked={keyHolder.hasKey}
                      onCheckedChange={() => toggleKeyHolder(keyHolder.userId)}
                    />
                    <Label htmlFor={`key-holder-${keyHolder.userId}`}>
                      {keyHolder.username} {userProfile?.id === keyHolder.userId && "(You)"}
                    </Label>
                  </div>
                ))}
                
                <div className="flex items-center space-x-2 col-span-1 sm:col-span-2">
                  <Checkbox
                    id="key-holder-other"
                    checked={otherKeyHolder.hasKey}
                    onCheckedChange={() => toggleOtherKeyHolder()}
                  />
                  <Label htmlFor="key-holder-other">Other:</Label>
                  <Input
                    value={otherKeyHolder.name}
                    onChange={(e) => updateOtherKeyHolderName(e.target.value)}
                    placeholder="Enter name"
                    className="ml-2 w-full max-w-[200px]"
                    disabled={!otherKeyHolder.hasKey}
                    onBlur={saveKeyHolders}
                  />
                </div>
              </div>
              
              <div className="pt-2">
                <div className="font-medium">Current Key Holders:</div>
                <ul className="list-disc list-inside mt-2">
                  {keyHolders.filter(kh => kh.hasKey).length === 0 && !otherKeyHolder.hasKey && (
                    <li className="text-muted-foreground">No one currently has keys</li>
                  )}
                  
                  {keyHolders.filter(kh => kh.hasKey).map(kh => (
                    <li key={kh.userId} className="text-secondary-foreground">
                      {kh.username} {userProfile?.id === kh.userId && "(You)"}
                    </li>
                  ))}
                  
                  {otherKeyHolder.hasKey && otherKeyHolder.name && (
                    <li className="text-secondary-foreground">{otherKeyHolder.name}</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Two-column grid for Bills and Chores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Newspaper className="h-5 w-5 mr-2" />
              New York Times Crosswords
            </CardTitle>
            <CardDescription>Daily crossword puzzles from The New York Times.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mt-4 text-center">
              <a 
                href="https://www.nytimes.com/crosswords" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Open New York Times Crosswords
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

