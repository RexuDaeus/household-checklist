"use client"

import { supabase } from "@/lib/supabase"
import type { Chore } from "@/lib/supabase"

export async function checkAndResetChores(): Promise<void> {
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
    if (sydneyHour < 3 || sydneyHour > 4) {
      return;
    }

    // Get all completed chores
    const { data: chores, error: fetchError } = await supabase
      .from("chores")
      .select("*")
      .eq("is_completed", true);

    if (fetchError) {
      console.error("Error fetching chores:", fetchError);
      return;
    }

    if (!chores || chores.length === 0) {
      return;
    }

    // Process each chore
    for (const chore of chores) {
      const lastReset = chore.lastReset ? new Date(chore.lastReset) : null;
      const lastResetDate = lastReset ? lastReset.getDate() : 0;
      const lastResetMonth = lastReset ? lastReset.getMonth() : -1;
      let shouldReset = false;

      // Daily chores: reset every day at 4 AM
      if (chore.frequency === "daily") {
        if (!lastReset || lastResetDate !== sydneyDay) {
          shouldReset = true;
        }
      }
      
      // Weekly chores: reset every Monday at 4 AM
      else if (chore.frequency === "weekly" && sydneyWeekDay === 1) { // Monday
        if (!lastReset || daysSince(lastReset, now) >= 7) {
          shouldReset = true;
        }
      }
      
      // Monthly chores: reset on the 1st of each month at 4 AM
      else if (chore.frequency === "monthly" && sydneyDay === 1) {
        if (!lastReset || monthsSince(lastReset, sydneyTime) >= 1) {
          shouldReset = true;
        }
      }

      // Reset the chore if needed
      if (shouldReset) {
        const { error: updateError } = await supabase
          .from("chores")
          .update({
            is_completed: false,
            lastReset: sydneyTime.toISOString()
          })
          .eq("id", chore.id);

        if (updateError) {
          console.error(`Error resetting chore ${chore.id}:`, updateError);
        } else {
          console.log(`Successfully reset chore: ${chore.title}`);
        }
      }
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