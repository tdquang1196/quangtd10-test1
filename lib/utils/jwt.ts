/**
 * JWT Utility Functions
 * Used to decode and validate JWT tokens on the client-side
 */

interface JWTPayload {
    exp?: number // Expiration time (Unix timestamp in seconds)
    iat?: number // Issued at time
    sub?: string // Subject (usually user ID)
    [key: string]: any
}

/**
 * Decode JWT token without verification (client-side only)
 * This only decodes the payload, does NOT verify the signature
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
export function decodeJWT(token: string): JWTPayload | null {
    try {
        // JWT format: header.payload.signature
        const parts = token.split('.')
        if (parts.length !== 3) {
            console.warn('Invalid JWT format')
            return null
        }

        // Decode the payload (second part)
        const payload = parts[1]

        // Base64 decode (handle URL-safe base64)
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        )

        return JSON.parse(jsonPayload) as JWTPayload
    } catch (error) {
        console.error('Failed to decode JWT:', error)
        return null
    }
}

/**
 * Check if JWT token is expired
 * @param token - JWT token string
 * @param bufferSeconds - Optional buffer time in seconds (default: 60s)
 *                        Token will be considered expired if it expires within this buffer
 * @returns true if expired or invalid, false if still valid
 */
export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean {
    const payload = decodeJWT(token)

    if (!payload || !payload.exp) {
        // No expiration time = treat as expired for safety
        return true
    }

    // exp is in seconds, Date.now() is in milliseconds
    const expirationTime = payload.exp * 1000
    const currentTime = Date.now()
    const bufferTime = bufferSeconds * 1000

    // Check if token is expired or will expire within buffer time
    return currentTime >= (expirationTime - bufferTime)
}

/**
 * Get token expiration time as Date object
 * @param token - JWT token string
 * @returns Date object or null if token is invalid
 */
export function getTokenExpiration(token: string): Date | null {
    const payload = decodeJWT(token)

    if (!payload || !payload.exp) {
        return null
    }

    return new Date(payload.exp * 1000)
}

/**
 * Get remaining time until token expires (in seconds)
 * @param token - JWT token string
 * @returns Seconds until expiration, or 0 if already expired/invalid
 */
export function getTokenRemainingTime(token: string): number {
    const expirationDate = getTokenExpiration(token)

    if (!expirationDate) {
        return 0
    }

    const remainingMs = expirationDate.getTime() - Date.now()
    return Math.max(0, Math.floor(remainingMs / 1000))
}
