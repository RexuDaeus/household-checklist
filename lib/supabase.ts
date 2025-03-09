import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

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
  payee?: string;
};

export type Chore = {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  assigned_to: string | null;
  created_by?: string;
  is_completed?: boolean;
  created_at: string;
  lastReset?: string;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  caption: string;
  image_url: string;
  created_at: string;
}; 