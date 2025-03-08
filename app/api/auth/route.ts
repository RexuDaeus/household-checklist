import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  return NextResponse.json({ session })
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  
  // Get the action from the request body
  const { action } = await request.json()

  if (action === 'signOut') {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Signed out successfully' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
} 