import axios from 'axios'

// Create axios instance with base configuration
export const axiosMeduverse = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://coreservice-testing.meduverse.ai',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
axiosMeduverse.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
axiosMeduverse.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      // Only handle on client-side
      if (typeof window !== 'undefined') {
        // Clear auth token
        localStorage.removeItem('auth_token')

        // Redirect to login page
        window.location.href = '/login'

        console.error('Session expired. Redirecting to login...')
      }
    }
    return Promise.reject(error)
  }
)
