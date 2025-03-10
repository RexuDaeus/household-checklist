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

  // Add a new state to track if data was loaded from DB
  const [keyDataInitialized, setKeyDataInitialized] = useState(false)

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
      console.log("Loading key holders data from database...");
      
      // Get key holders data
      const { data: keyHoldersData, error } = await supabase
        .from("key_holders")
        .select("*")
        .single();
      
      if (error) {
        console.error("Error loading key holders:", error);
        
        // Check if the table doesn't exist
        if (error.code === "42P01") { // PostgreSQL error code for "relation does not exist"
          setKeyHolderError("The key_holders table doesn't exist in the database. Please run the SQL setup.");
          return;
        }
        
        if (error.code === "PGRST116") {
          console.log("No key holder data found, creating initial record");
          // No data found, create initial record
          const initialData = {
            users: [],
            other: { name: "", hasKey: false }
          };
          
          try {
            const { error: insertError } = await supabase
              .from("key_holders")
              .insert([{ data: initialData }]);
            
            if (insertError) {
              console.error("Error creating initial key holders data:", insertError);
              
              // Check if it's a table doesn't exist error
              if (insertError.code === "42P01") {
                setKeyHolderError("The key_holders table doesn't exist in the database. Please run the SQL setup.");
              } else {
                setKeyHolderError("Failed to initialize key holders data. Please try again later.");
              }
            } else {
              console.log("Successfully created initial key holders data");
              // Try to load data again after a short delay
              setTimeout(loadKeyHolders, 1000);
            }
          } catch (e) {
            console.error("Unexpected error creating initial key holders data:", e);
            setKeyHolderError("An unexpected error occurred. Please try again later.");
          }
        } else {
          setKeyHolderError(`Failed to load key holders data: ${error.message}`);
        }
      } else if (keyHoldersData?.data) {
        // Update keyHolders state with the saved data
        const savedData = keyHoldersData.data;
        console.log("Loaded key holders data:", savedData);
        
        if (savedData.users && Array.isArray(savedData.users)) {
          // Create a map of user IDs to their key status
          const keyStatusMap = new Map<string, boolean>(
            savedData.users.map((u: any) => [u.userId, Boolean(u.hasKey)])
          );
          
          setKeyHolders(prevKeyHolders => 
            prevKeyHolders.map(kh => ({
              ...kh,
              hasKey: keyStatusMap.has(kh.userId) ? Boolean(keyStatusMap.get(kh.userId)) : false
            }))
          );
        }
        
        if (savedData.other) {
          setOtherKeyHolder(savedData.other);
        }
        
        console.log("Successfully applied key holders data to state");
        setKeyDataInitialized(true);
        // Clear any error
        setKeyHolderError(null);
      }
    } catch (error) {
      console.error("Error loading key holders:", error);
      setKeyHolderError("Failed to load key holders data. Please try again later.");
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
      
      // Create the updated key holders array
      const updatedKeyHolders = keyHolders.map(kh => 
        kh.userId === userId 
          ? { ...kh, hasKey: !kh.hasKey } 
          : kh
      );
      
      // Update the state first for responsive UI
      setKeyHolders(updatedKeyHolders);
      
      // Then immediately save to database
      const saveResult = await saveKeyHolders(updatedKeyHolders, otherKeyHolder);
      
      // If saving fails, revert the UI change
      if (!saveResult) {
        setKeyHolders(keyHolders); // Revert to previous state
        setKeyHolderError("Failed to save changes. Please try again.");
      }
    } catch (error) {
      console.error("Error toggling key holder:", error);
      setKeyHolderError("An error occurred while updating key holders.");
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
      
      // Create the updated state
      const updatedOtherKeyHolder = {
        ...otherKeyHolder,
        hasKey: !otherKeyHolder.hasKey
      };
      
      // Update the state for responsive UI
      setOtherKeyHolder(updatedOtherKeyHolder);
      
      // Then immediately save to database
      const saveResult = await saveKeyHolders(keyHolders, updatedOtherKeyHolder);
      
      // If saving fails, revert the UI change
      if (!saveResult) {
        setOtherKeyHolder(otherKeyHolder); // Revert to previous state
        setKeyHolderError("Failed to save changes. Please try again.");
      }
    } catch (error) {
      console.error("Error toggling other key holder:", error);
      setKeyHolderError("An error occurred while updating key holders.");
    }
  }

  // Update the "Other" key holder name
  const updateOtherKeyHolderName = (name: string) => {
    const updatedOtherKeyHolder = {
      ...otherKeyHolder,
      name
    };
    setOtherKeyHolder(updatedOtherKeyHolder);
  }

  // Save key holders to the database with optional parameters for immediate updates
  const saveKeyHolders = async (
    currentKeyHolders = keyHolders, 
    currentOtherKeyHolder = otherKeyHolder
  ): Promise<boolean> => {
    try {
      if (!currentKeyHolders || !currentOtherKeyHolder) {
        console.error("Missing key holder data for saving");
        return false;
      }
      
      // Prepare the data to save
      const keyHoldersData = {
        users: currentKeyHolders
          .filter(kh => kh.hasKey) // Only save users who have keys
          .map(kh => ({
            userId: kh.userId,
            username: kh.username,
            hasKey: true
          })),
        other: currentOtherKeyHolder
      };
      
      console.log("Saving key holders data:", keyHoldersData);
      
      // Get the current record
      const { data: existingData, error: selectError } = await supabase
        .from("key_holders")
        .select("id")
        .single();
      
      // If there's an error and it indicates the table doesn't exist, show error
      if (selectError && selectError.code === "42P01") {
        console.error("Table doesn't exist:", selectError);
        setKeyHolderError("The key_holders table doesn't exist in the database. Please run the SQL setup.");
        return false;
      }
      
      let result;
      if (existingData) {
        // Update existing record
        result = await supabase
          .from("key_holders")
          .update({ data: keyHoldersData })
          .eq("id", existingData.id);
      } else {
        // Insert new record
        result = await supabase
          .from("key_holders")
          .insert([{ data: keyHoldersData }]);
      }
      
      if (result.error) {
        console.error("Error saving key holders data:", result.error);
        
        // Check if it's a table doesn't exist error
        if (result.error.code === "42P01") {
          setKeyHolderError("The key_holders table doesn't exist in the database. Please run the SQL setup.");
        } else {
          setKeyHolderError(`Failed to save key holders data: ${result.error.message}`);
        }
        
        return false;
      } else {
        console.log("Successfully saved key holders data");
        return true;
      }
    } catch (error) {
      console.error("Error saving key holders:", error);
      setKeyHolderError("An unexpected error occurred while saving key holders data.");
      return false;
    }
  };

  // Add improved realtime subscription for key holders with better handling
  useEffect(() => {
    if (!supabase || !keyDataInitialized) return;

    console.log("Setting up realtime subscription for key holders");
    
    const channel = supabase
      .channel('key-holders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'key_holders'
        },
        (payload) => {
          console.log("Received key holders update:", payload);
          // Reload data when changes occur
          loadKeyHolders();
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up key holders subscription");
      supabase.removeChannel(channel);
    };
  }, [keyDataInitialized]); // Only set up subscription after initial data load

  // Ensure keyholders are saved when "Other" name is updated
  const handleOtherKeyHolderNameBlur = async () => {
    if (otherKeyHolder.hasKey && otherKeyHolder.name) {
      await saveKeyHolders();
    }
  };

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
                    onBlur={handleOtherKeyHolderNameBlur}
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

