'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login as loginApi } from '@/lib/api/auth'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      // Token exists, user is authenticated
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  // Login function
  const login = async (username: string, password: string) => {
    try {
      // Call API
      const token = await loginApi({ username, password })

      // Store token in localStorage
      localStorage.setItem('auth_token', token)

      // Update state
      setIsAuthenticated(true)

      // Redirect to home
      router.push('/')
    } catch (error: any) {
      // Re-throw error for component to handle
      throw error
    }
  }

  // Logout function
  const logout = () => {
    // Clear token from localStorage
    localStorage.removeItem('auth_token')

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
