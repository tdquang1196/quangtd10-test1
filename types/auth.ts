export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
}

export interface AuthError {
  message: string
  statusCode?: number
}

export interface User {
  id: string
  username: string
  // Add more fields as needed based on API response
}
