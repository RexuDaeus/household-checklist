"use client"

type Chore = {
  id: string;
  name?: string;
  title?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  completedBy?: string;
  lastReset?: string;
  assigned_to?: string;
  created_at?: string;
};

export function checkAndResetChores(): void {
  try {
    // Get the current time in Sydney timezone (GMT+11)
    const now = new Date();
    const sydneyTimezoneOffset = 11 * 60; // GMT+11 in minutes
    const utcOffset = now.getTimezoneOffset(); // Local timezone offset in minutes
    const sydneyOffset = utcOffset + sydneyTimezoneOffset; // Combined offset
    
    // Get Sydney time
    const sydneyTime = new Date(now.getTime() + sydneyOffset * 60 * 1000);
    const sydneyHour = sydneyTime.getHours();
    const sydneyDay = sydneyTime.getDate();
    const sydneyWeekDay = sydneyTime.getDay(); // 0 = Sunday, 1 = Monday
    
    // Only process resets if it's around 4 AM (between 3:30 AM and 4:30 AM)
    // This gives some buffer in case the user isn't active exactly at 4 AM
    if (sydneyHour < 3 || sydneyHour > 4) {
      return;
    }
    
    // Get chores from localStorage
    const savedChores = localStorage.getItem("chores");
    if (!savedChores) {
      return;
    }
    
    let chores: Chore[] = JSON.parse(savedChores);
    let hasChanges = false;
    
    // Process chores
    chores = chores.map(chore => {
      const lastReset = chore.lastReset ? new Date(chore.lastReset) : null;
      const lastResetDate = lastReset ? lastReset.getDate() : 0;
      const lastResetMonth = lastReset ? lastReset.getMonth() : -1;
      
      // Daily chores: reset every day at 4 AM
      if (chore.frequency === "daily" && chore.completed) {
        // If the last reset date is different from today, or
        // if there was no last reset, reset the chore
        if (!lastReset || lastResetDate !== sydneyDay) {
          hasChanges = true;
          return {
            ...chore,
            completed: false,
            completedBy: undefined,
            lastReset: sydneyTime.toISOString()
          };
        }
      }
      
      // Weekly chores: reset every Monday at 4 AM
      if (chore.frequency === "weekly" && chore.completed) {
        if (sydneyWeekDay === 1) { // Monday
          if (!lastReset || daysSince(lastReset, now) >= 7) {
            hasChanges = true;
            return {
              ...chore,
              completed: false,
              completedBy: undefined,
              lastReset: sydneyTime.toISOString()
            };
          }
        }
      }
      
      // Monthly chores: reset on the 1st of each month at 4 AM
      if (chore.frequency === "monthly" && chore.completed) {
        if (sydneyDay === 1) { // 1st of the month
          if (!lastReset || monthsSince(lastReset, sydneyTime) >= 1) {
            hasChanges = true;
            return {
              ...chore,
              completed: false,
              completedBy: undefined,
              lastReset: sydneyTime.toISOString()
            };
          }
        }
      }
      
      return chore;
    });
    
    // Save the updated chores back to localStorage if any changes were made
    if (hasChanges) {
      localStorage.setItem("chores", JSON.stringify(chores));
      console.log("Chores have been automatically reset based on frequency");
    }
  } catch (error) {
    console.error("Error in checkAndResetChores:", error);
  }
}

// Helper function to calculate days since a given date
function daysSince(date: Date, now: Date): number {
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Helper function to calculate months since a given date
function monthsSince(date: Date, now: Date): number {
  return (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
} 