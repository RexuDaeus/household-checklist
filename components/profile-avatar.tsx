import { Profile } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  user: Profile;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProfileAvatar({ user, size = "md", className }: ProfileAvatarProps) {
  const sizeMap = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-16 h-16 text-xl"
  };

  const sizeClass = sizeMap[size];
  
  // Get user's chosen emoji or use a default
  const getProfileEmoji = (): string => {
    if (!user || !user.profile_picture_url) {
      // Default emoji if none is set
      return "😊";
    }
    
    // If profile_picture_url contains an emoji, return it
    try {
      // Return the stored emoji from profile_picture_url (which now stores the emoji)
      return user.profile_picture_url;
    } catch {
      return "😊"; // Default fallback emoji
    }
  };
  
  // Render the emoji avatar
  const renderEmojiAvatar = () => {
    if (!user || !user.username) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-secondary text-secondary-foreground">
          😊
        </div>
      );
    }
    
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/30">
        {getProfileEmoji()}
      </div>
    );
  };
  
  if (!user) {
    return (
      <div 
        className={cn(
          "relative rounded-full overflow-hidden border-2 border-primary/20", 
          sizeClass,
          className
        )}
      >
        {renderEmojiAvatar()}
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        "relative rounded-full overflow-hidden border-2 border-primary/20", 
        sizeClass,
        className
      )}
    >
      {renderEmojiAvatar()}
    </div>
  );
} 