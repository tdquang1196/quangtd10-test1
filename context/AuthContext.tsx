'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { login as loginApi, verifyToken } from '@/lib/api/auth'
import { isTokenExpired, getTokenRemainingTime } from '@/lib/utils/jwt'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Helper function to set token in both localStorage and cookies
  const setToken = (token: string) => {
    localStorage.setItem('auth_token', token)
    // Set cookie for middleware to read
    document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Strict`
  }

  // Helper function to remove token from both localStorage and cookies
  const removeToken = () => {
    localStorage.removeItem('auth_token')
    // Remove cookie
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  }

  // Verify token on mount and when pathname changes
  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('auth_token')

      if (!token) {
        // No token found
        setIsLoading(false)

        // Check if we're on a protected route
        const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
        if (!isPublicRoute) {
          console.log('No token found. Redirecting to login...')
          router.push('/login')
        }
        return
      }

      // STEP 1: Decode JWT and check expiry locally (fast, no API call)
      if (isTokenExpired(token)) {
        console.warn('Token has expired (checked locally)')
        const remainingTime = getTokenRemainingTime(token)
        console.log(`Token expired. Remaining time: ${remainingTime}s`)

        // Token expired, logout user
        removeToken()
        setIsAuthenticated(false)
        setIsLoading(false)

        // Redirect to login if on protected route
        const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
        if (!isPublicRoute) {
          router.push('/login')
        }
        return
      }

      // STEP 2: Token not expired, verify with API to be sure
      console.log('Token not expired locally, verifying with API...')
      const isValid = await verifyToken(token)

      if (isValid) {
        console.log('✅ Token is valid')
        setIsAuthenticated(true)

        // Sync token to cookie (in case it's missing)
        setToken(token)
      } else {
        console.warn('❌ Token validation failed via API')
        // Token invalid, logout user
        removeToken()
        setIsAuthenticated(false)

        // Redirect to login if on protected route
        const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
        if (!isPublicRoute) {
          router.push('/login')
        }
      }

      setIsLoading(false)
    }

    validateToken()
  }, [pathname, router]) // Re-verify when navigating to different pages

  // Login function
  const login = async (username: string, password: string) => {
    try {
      // Call API
      const token = await loginApi({ username, password })

      // Store token in both localStorage and cookies
      setToken(token)

      // Update state
      setIsAuthenticated(true)

      // Redirect to home (or to the page user was trying to access)
      router.push('/')
    } catch (error: any) {
      // Re-throw error for component to handle
      throw error
    }
  }

  // Logout function
  const logout = () => {
    // Clear token from both localStorage and cookies
    removeToken()

    // Reset state
    setIsAuthenticated(false)

    // Redirect to login
    router.push('/login')
  }

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook for consuming auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
