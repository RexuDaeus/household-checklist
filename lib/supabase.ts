import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Helper function to get the site URL based on environment
export function getSiteUrl() {
  if (typeof window !== 'undefined') {
    // Client-side
    return window.location.origin;
  }
  // Server-side
  return process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types for our database tables
export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

export type Bill = {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  created_by: string;
  payers: string[];
  created_at: string;
};

export type Chore = {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  assigned_to: string;
  created_at: string;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  caption: string;
  image_url: string;
  created_at: string;
}; 