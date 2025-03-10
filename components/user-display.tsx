import { Profile } from "@/lib/supabase";

interface UserDisplayProps {
  user: Profile;
  showYou?: boolean;
  className?: string;
}

/**
 * Component to display a user's name with their profile emoji
 */
export function UserDisplay({ user, showYou = true, className = "" }: UserDisplayProps) {
  // Safely get emoji or use default
  const emoji = user?.profile_picture_url || "😊";
  
  // Get display name (add "You" if it's the current user and showYou is true)
  const displayName = showYou && user.is_current_user 
    ? `${user.username} (You)` 
    : user.username;
  
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="emoji" aria-hidden="true">{emoji}</span>
      <span>{displayName}</span>
    </span>
  );
} 