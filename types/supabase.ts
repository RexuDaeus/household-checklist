export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          created_at: string
          profile_picture_url: string | null
        }
        Insert: {
          id: string
          username: string
          created_at?: string
          profile_picture_url?: string | null
        }
        Update: {
          id?: string
          username?: string
          created_at?: string
          profile_picture_url?: string | null
        }
      }
    }
  }
}
