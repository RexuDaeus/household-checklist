import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // For debugging
  console.log("Middleware running for path:", req.nextUrl.pathname);
  
  // Check Supabase auth
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Also check for cookie-based auth (used by the dashboard)
  const cookies = req.cookies;
  const userCookie = cookies.get('user');
  const hasCookieAuth = !!userCookie?.value;
  
  // Debug info
  console.log("Auth state:", { 
    hasSupabaseSession: !!session, 
    hasCookieAuth, 
    path: req.nextUrl.pathname 
  });

  // If there's no session/cookie and the user is trying to access a protected route
  const isAuthRoute = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register');
  const isAuthenticated = !!session || hasCookieAuth;
  
  // If not authenticated and trying to access protected route
  if (!isAuthenticated && !isAuthRoute && req.nextUrl.pathname !== '/') {
    console.log("Not authenticated, redirecting to login");
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated and trying to access auth routes
  if (isAuthenticated && isAuthRoute) {
    console.log("Already authenticated, redirecting to dashboard");
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 