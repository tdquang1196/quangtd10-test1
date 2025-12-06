import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ['/login']

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Check if the route is public
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

    // Get token from cookies or check if it exists in localStorage (client-side will handle this)
    // Since middleware runs on server, we can't access localStorage
    // We'll check if user has auth_token cookie (we'll need to set this)
    const token = request.cookies.get('auth_token')?.value

    // If route is public, allow access
    if (isPublicRoute) {
        // If user is already logged in (has token) and tries to access /login, redirect to home
        if (token && pathname === '/login') {
            return NextResponse.redirect(new URL('/', request.url))
        }
        return NextResponse.next()
    }

    // For protected routes, check if user has token
    // Note: This is a basic check. The actual token validation happens in AuthContext
    if (!token) {
        // No token, redirect to login
        const loginUrl = new URL('/login', request.url)
        // Save the original URL to redirect back after login (optional)
        loginUrl.searchParams.set('from', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // User has token, allow access
    // Token validation will happen on client-side in AuthContext
    return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
    // Run on all routes except static files and API routes
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
