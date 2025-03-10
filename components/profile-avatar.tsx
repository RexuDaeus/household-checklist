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
  const [imageUrl, setImageUrl] = useState<string | null>(user?.profile_picture_url || null);
  
  // Reset error state when URL changes or user changes
  useEffect(() => {
    if (!user) return;
    
    setImageError(false);
    // Force a re-render with the updated URL by adding a timestamp parameter
    const url = user.profile_picture_url;
    if (url) {
      // Add a cache-busting parameter to the URL if it doesn't already have one
      const hasQueryParams = url.includes('?');
      const cacheParam = `_t=${Date.now()}`;
      const updatedUrl = hasQueryParams ? `${url}&${cacheParam}` : `${url}?${cacheParam}`;
      setImageUrl(updatedUrl);
    } else {
      setImageUrl(null);
    }
  }, [user, user?.profile_picture_url]);
  
  const sizeMap = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-16 h-16 text-xl"
  };

  const sizeClass = sizeMap[size];
  
  const renderFallbackAvatar = () => {
    if (!user || !user.username) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-secondary text-secondary-foreground font-bold">
          ?
        </div>
      );
    }
    
    return (
      <div className="w-full h-full flex items-center justify-center bg-secondary text-secondary-foreground font-bold">
        {user.username.charAt(0).toUpperCase()}
      </div>
    );
  };
  
  // Safely parse the size number from the class string
  const getSizePixels = (): number => {
    try {
      const match = sizeClass.match(/w-(\d+)/);
      return match ? parseInt(match[1]) * 4 : 24; // Tailwind w-10 means 2.5rem or 40px (10 * 4px)
    } catch {
      return 24; // Default fallback size
    }
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
        {renderFallbackAvatar()}
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
      {imageUrl && !imageError ? (
        <div className="w-full h-full">
          <Image 
            src={imageUrl}
            alt={`${user.username}'s profile picture`}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            unoptimized={true} // Skip Next.js image optimization for Supabase Storage URLs
            sizes={`${getSizePixels()}px`}
            priority // Load image with higher priority
          />
        </div>
      ) : renderFallbackAvatar()}
    </div>
  );
} 