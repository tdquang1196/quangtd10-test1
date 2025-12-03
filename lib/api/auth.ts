import type { LoginRequest } from '@/types/auth'

/**
 * Login user with username and password (local validation)
 * @param credentials - Username and password
 * @returns Promise with mock access token
 * @throws Error with validation message
 */
export async function login(credentials: LoginRequest): Promise<string> {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 500))

  // Validate against environment variables
  const validUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || process.env.ADMIN_USERNAME
  const validPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD

  if (credentials.username !== validUsername || credentials.password !== validPassword) {
    throw new Error('Invalid username or password')
  }

  // Generate a mock token
  const mockToken = `mock-token-${Date.now()}-${credentials.username}`

  return mockToken
}

/**
 * Verify if token is valid (local validation)
 * @param token - Token to verify
 * @returns Promise<boolean>
 */
export async function verifyToken(token: string): Promise<boolean> {
  // Simple check: token should start with 'mock-token-'
  return token.startsWith('mock-token-')
}
