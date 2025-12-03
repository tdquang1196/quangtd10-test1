import { axiosMeduverse } from '../axios'
import type { LoginRequest, LoginResponse } from '@/types/auth'

/**
 * Login user with username and password
 * @param credentials - Username and password
 * @returns Promise with access token
 * @throws Error with message from API
 */
export async function login(credentials: LoginRequest): Promise<string> {
  try {
    const response = await axiosMeduverse.post<LoginResponse>(
      '/auth/login',
      credentials
    )

    // Extract access token from response
    const accessToken = response.data.accessToken

    if (!accessToken) {
      throw new Error('No access token received from server')
    }

    return accessToken
  } catch (error: any) {
    // Extract error message from API response
    const errorMessage =
      error?.response?.data?.message ||
      error?.response?.data?.title ||
      error?.message ||
      'Login failed. Please try again.'

    throw new Error(errorMessage)
  }
}

/**
 * Verify if token is valid (optional - can be used for token refresh)
 * @param token - JWT token to verify
 * @returns Promise<boolean>
 */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    // This endpoint may not exist yet - placeholder for future
    const response = await axiosMeduverse.get('/auth/verify', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    return response.status === 200
  } catch (error) {
    return false
  }
}
