"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { SumikkoHeader } from "@/components/sumikko-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Trash } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadError(null);
      
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileSize = file.size / 1024 / 1024; // Convert to MB
      
      if (fileSize > 2) {
        setUploadError("File size exceeds 2MB limit");
        return;
      }

      if (!file.type.startsWith("image/")) {
        setUploadError("Only image files are allowed");
        return;
      }

      setUploading(true);

      // Generate a unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
      
      // Try to upload directly to the 'avatars' bucket which is created by default in Supabase
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('avatars')
        .upload(`profiles/${fileName}`, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error("Error uploading profile picture:", uploadError);
        setUploadError(`Failed to upload profile picture: ${uploadError.message}`);
        return;
      }

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(`profiles/${fileName}`);

      // Update the user's profile with the new profile picture URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_picture_url: publicUrl })
        .eq("id", currentUser.id);

      if (updateError) {
        console.error("Error updating profile with new picture URL:", updateError);
        setUploadError("Failed to update profile with new picture");
        return;
      }

      // Update the local state
      setProfilePictureUrl(publicUrl);
      setCurrentUser({
        ...currentUser,
        profile_picture_url: publicUrl
      });

      alert("Profile picture updated successfully!");
    } catch (error) {
      console.error("Error in profile picture upload process:", error);
      setUploadError("An unexpected error occurred");
    } finally {
      setUploading(false);
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
    if (deleteConfirmation !== username) {
      alert("Confirmation text doesn't match your username");
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
        alert("Failed to delete profile");
        return;
      }

      // Then delete the user's auth account
      const { error: authError } = await supabase.auth.admin.deleteUser(
        currentUser.id
      );

      if (authError) {
        console.error("Error deleting auth user:", authError);
        alert("Failed to delete account");
        return;
      }

      // Sign out
      await supabase.auth.signOut();
      
      // Redirect to login
      router.push("/login");
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account. Please try again later.");
    }
  };

  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary border-r-2 border-b-2"></div>
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
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20">
                {profilePictureUrl ? (
                  <Image 
                    src={profilePictureUrl}
                    alt={`${username}'s profile picture`}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary text-secondary-foreground text-4xl font-bold">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="w-full">
                <Label htmlFor="profile-picture" className="block mb-2">Profile Picture</Label>
                <div className="flex flex-col space-y-2">
                  <Input
                    id="profile-picture"
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureUpload}
                    disabled={uploading}
                    className="cursor-pointer w-full"
                  />
                  {uploadError && (
                    <p className="text-sm text-destructive">{uploadError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Supported formats: JPG, PNG, GIF. Max size: 2MB.
                  </p>
                </div>
              </div>
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
            <CardTitle className="text-xl font-bold">Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {passwordSuccess && (
              <Alert className="bg-green-50 text-green-800 border-green-200">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{passwordSuccess}</AlertDescription>
              </Alert>
            )}
            
            {passwordError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            
            <Button 
              onClick={handleChangePassword} 
              className="w-full mt-2"
            >
              Change Password
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-destructive">Delete Account</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. It will permanently delete your account and remove your data from our servers.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    To confirm, please type your username: <strong>{username}</strong>
                  </p>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Enter your username"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmation !== username}
                  >
                    Permanently Delete Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 