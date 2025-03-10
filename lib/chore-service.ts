"use client"

import { supabase } from "@/lib/supabase"
import type { Chore } from "@/lib/supabase"

export async function checkAndResetChores(): Promise<void> {
  try {
    console.log("Running checkAndResetChores...");
    
    // Get the current time in UTC (database uses UTC)
    const now = new Date();
    
    // Get all chores that are completed
    const { data: chores, error: fetchError } = await supabase
      .from("chores")
      .select("*")
      .eq("is_completed", true);

    if (fetchError) {
      console.error("Error fetching chores:", fetchError);
      return;
    }

    if (!chores || chores.length === 0) {
      console.log("No completed chores to check");
      return;
    }

    console.log(`Found ${chores.length} completed chores to check`);

    // Process each chore
    for (const chore of chores) {
      if (!chore.lastReset) {
        console.log(`Chore ${chore.id} (${chore.title}) has no lastReset time, skipping`);
        continue;
      }
      
      const lastReset = new Date(chore.lastReset);
      let shouldReset = false;
      const daysSinceReset = daysSince(lastReset, now);
      
      console.log(`Checking chore: ${chore.title} (${chore.frequency}), last reset: ${lastReset.toISOString()}, days since: ${daysSinceReset}`);

      // Daily chores: reset if it's been more than 24 hours
      if (chore.frequency === "daily") {
        if (daysSinceReset >= 1) {
          shouldReset = true;
          console.log(`Daily chore ${chore.title} needs reset (${daysSinceReset} days since last reset)`);
        }
      }
      
      // Weekly chores: reset if it's been 7 or more days
      else if (chore.frequency === "weekly") {
        if (daysSinceReset >= 7) {
          shouldReset = true;
          console.log(`Weekly chore ${chore.title} needs reset (${daysSinceReset} days since last reset)`);
        }
      }
      
      // Monthly chores: reset if it's been a month or more
      else if (chore.frequency === "monthly") {
        if (monthsSince(lastReset, now) >= 1) {
          shouldReset = true;
          console.log(`Monthly chore ${chore.title} needs reset (${monthsSince(lastReset, now)} months since last reset)`);
        }
      }

      // Reset the chore if needed
      if (shouldReset) {
        console.log(`Resetting chore: ${chore.title}`);
        
        const { error: updateError } = await supabase
          .from("chores")
          .update({
            is_completed: false,
            lastReset: now.toISOString()
          })
          .eq("id", chore.id);

        if (updateError) {
          console.error(`Error resetting chore ${chore.id}:`, updateError);
        } else {
          console.log(`Successfully reset chore: ${chore.title}`);
        }
      } else {
        console.log(`No reset needed for ${chore.title}`);
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