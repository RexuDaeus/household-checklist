import Image from "next/image";
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
  
  return (
    <div 
      className={cn(
        "relative rounded-full overflow-hidden border-2 border-primary/20", 
        sizeClass,
        className
      )}
    >
      {user.profile_picture_url ? (
        <Image 
          src={user.profile_picture_url}
          alt={`${user.username}'s profile picture`}
          fill
          className="object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-secondary text-secondary-foreground font-bold">
          {user.username.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
} 