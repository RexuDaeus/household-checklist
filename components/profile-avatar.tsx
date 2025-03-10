import Image from "next/image";
import { Profile } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface ProfileAvatarProps {
  user: Profile;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProfileAvatar({ user, size = "md", className }: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(user.profile_picture_url || null);
  
  // Reset error state when URL changes
  useEffect(() => {
    setImageError(false);
    setImageUrl(user.profile_picture_url || null);
  }, [user.profile_picture_url]);
  
  const sizeMap = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-16 h-16 text-xl"
  };

  const sizeClass = sizeMap[size];
  
  const renderFallbackAvatar = () => (
    <div className="w-full h-full flex items-center justify-center bg-secondary text-secondary-foreground font-bold">
      {user.username.charAt(0).toUpperCase()}
    </div>
  );
  
  // Safely parse the size number from the class string
  const getSizePixels = (): number => {
    try {
      return parseInt(sizeClass.split("w-")[1]) || 24;
    } catch {
      return 24; // Default fallback size
    }
  };
  
  return (
    <div 
      className={cn(
        "relative rounded-full overflow-hidden border-2 border-primary/20", 
        sizeClass,
        className
      )}
    >
      {imageUrl && !imageError ? (
        <Image 
          src={imageUrl}
          alt={`${user.username}'s profile picture`}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
          unoptimized // Skip Next.js image optimization
          sizes={`(max-width: 768px) ${getSizePixels()}px, ${getSizePixels()}px`}
        />
      ) : renderFallbackAvatar()}
    </div>
  );
} 