"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SumikkoHeader } from "@/components/sumikko-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { ProfileAvatar } from "@/components/profile-avatar";
import { EmojiPicker } from "@/components/emoji-picker";

export default function ProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        setIsLoading(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push("/login");
          return;
        }

        // Get current user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setCurrentUser(profile);
          setUsername(profile.username);
          setProfilePictureUrl(profile.profile_picture_url);
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleUsernameUpdate = async () => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username })
        .eq("id", currentUser.id);

      if (error) {
        console.error("Error updating username:", error);
        alert("Failed to update username.");
      } else {
        alert("Username updated successfully!");
        setCurrentUser({
          ...currentUser,
          username
        });
      }
    } catch (error) {
      console.error("Error updating username:", error);
      alert("Failed to update username.");
    }
  };

  const handleEmojiSelect = async (emoji: string) => {
    if (!currentUser) return;
    
    try {
      // Update the user's profile with the selected emoji
      const { error } = await supabase
        .from("profiles")
        .update({ profile_picture_url: emoji })
        .eq("id", currentUser.id);

      if (error) {
        throw error;
      }

      // Update local state
      setProfilePictureUrl(emoji);
      setCurrentUser({
        ...currentUser,
        profile_picture_url: emoji
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error("Error updating profile emoji:", error);
      return Promise.reject(error);
    }
  };

  const handleChangePassword = async () => {
    try {
      setPasswordError(null);
      setPasswordSuccess(null);

      if (newPassword !== confirmPassword) {
        setPasswordError("New passwords do not match");
        return;
      }

      if (newPassword.length < 6) {
        setPasswordError("Password must be at least 6 characters");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error("Error changing password:", error);
        setPasswordError(error.message);
        return;
      }

      setPasswordSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error in password change process:", error);
      setPasswordError("An unexpected error occurred");
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser || deleteConfirmation !== currentUser.username) {
      alert("Please enter your username correctly to confirm account deletion");
      return;
    }

    try {
      // First delete the user's profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", currentUser.id);

      if (profileError) {
        console.error("Error deleting profile:", profileError);
        alert("Failed to delete profile data. Please try again.");
        return;
      }

      // Then sign out and return to login page
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("An error occurred while deleting your account. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SumikkoHeader showBackButton />
        <div className="max-w-xl mx-auto px-4 py-6">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center max-w-7xl mx-auto px-4 py-2">
        <SumikkoHeader showBackButton />
      </div>
      
      <div className="max-w-xl mx-auto px-4 py-6 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Your Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              {currentUser && (
                <EmojiPicker 
                  user={currentUser} 
                  onEmojiSelect={handleEmojiSelect} 
                />
              )}
              <p className="text-sm text-muted-foreground">
                Click on your profile to choose an emoji
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 min-w-[60%]"
                />
                <Button onClick={handleUsernameUpdate}>Update</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Change your account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            
            {passwordSuccess && (
              <p className="text-sm text-green-600">{passwordSuccess}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleChangePassword}>Change Password</Button>
          </CardFooter>
        </Card>
        
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting your account is permanent and cannot be undone. All your data will be removed.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-4">
                  <Label htmlFor="confirm-delete">Type your username to confirm</Label>
                  <Input
                    id="confirm-delete"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={username}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete My Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 