import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Profile } from "@/lib/supabase";

// Common emoji categories
const EMOJI_SETS = {
  faces: ["😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊", "😋", "😎", "🥰", "😍", "😘", "🙂", "🙃", "😇"],
  animals: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦"],
  food: ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑"],
  activities: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🥊", "🎯", "🎲", "🎮", "🧩", "🎨"],
};

interface EmojiPickerProps {
  user: Profile;
  onEmojiSelect: (emoji: string) => Promise<void>;
}

export function EmojiPicker({ user, onEmojiSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(user?.profile_picture_url || "😊");
  const [currentCategory, setCurrentCategory] = useState<keyof typeof EMOJI_SETS>("faces");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSelect = async (emoji: string) => {
    setSelectedEmoji(emoji);
  };
  
  const handleSave = async () => {
    if (!selectedEmoji) return;
    
    setIsSubmitting(true);
    try {
      await onEmojiSelect(selectedEmoji);
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving emoji:", error);
      alert("Failed to update your profile emoji. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          className="p-0 h-auto bg-transparent hover:bg-transparent"
          onClick={() => setIsOpen(true)}
        >
          <div className="relative cursor-pointer group">
            <ProfileAvatar user={user} size="lg" />
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-white text-xs font-medium">Change</span>
            </div>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Choose Your Profile Emoji</DialogTitle>
          <DialogDescription>
            Select an emoji that represents you!
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 flex items-center justify-center text-5xl bg-gradient-to-br from-primary/20 to-secondary/30 rounded-full">
              {selectedEmoji}
            </div>
          </div>
          
          <div className="flex space-x-2 mb-4">
            {(Object.keys(EMOJI_SETS) as Array<keyof typeof EMOJI_SETS>).map(category => (
              <Button 
                key={category} 
                variant={currentCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentCategory(category)}
                className="capitalize"
              >
                {category}
              </Button>
            ))}
          </div>
          
          <div className="grid grid-cols-6 gap-2 p-2 border rounded-md h-48 overflow-y-auto">
            {EMOJI_SETS[currentCategory].map(emoji => (
              <button
                key={emoji}
                onClick={() => handleSelect(emoji)}
                className={`text-2xl p-2 rounded-md hover:bg-primary/10 transition-colors ${
                  selectedEmoji === emoji ? 'bg-primary/20 ring-2 ring-primary/50' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Emoji"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 