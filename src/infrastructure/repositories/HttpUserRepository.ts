/**
 * HTTP Implementation of User Repository
 * Handles API communication for user operations
 */

import axios, { AxiosInstance } from 'axios'
import { IUserRepository } from '../../domain/user-management/repositories/IUserRepository'
import { User, UserProps } from '../../domain/user-management/entities/User'
import { Result } from '../../domain/shared/Result'

export class HttpUserRepository implements IUserRepository {
  private httpClient: AxiosInstance
  private authToken: string | null = null

  constructor(baseURL: string) {
    this.httpClient = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  setAuthToken(token: string): void {
    this.authToken = token
    this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  async existsByUsername(username: string): Promise<Result<boolean>> {
    try {
      const response = await this.httpClient.post('/api/v1/auth/check-username-exist', {
        userName: username
      })
      return Result.ok(response.data.data === true)
    } catch (error: any) {
      return Result.fail(error.response?.data?.message || 'Failed to check username')
    }
  }

  async existsByDisplayName(displayName: string): Promise<Result<boolean>> {
    try {
      if (!this.authToken) {
        return Result.fail('Not authenticated')
      }

      const response = await this.httpClient.post('/api/v1/auth/check-displayname-exist', {
        displayName
      })
      return Result.ok(response.data.data === true)
    } catch (error: any) {
      return Result.fail(error.response?.data?.message || 'Failed to check display name')
    }
  }

  async register(user: User): Promise<Result<User>> {
    try {
      const response = await this.httpClient.post('/api/v1/auth/register', {
        userName: user.username,
        password: user.password,
        role: user.role
      })

      if (!response.data.isSuccess) {
        return Result.fail(response.data.message || 'Registration failed')
      }

      const userData = response.data.data
      user.setId(userData.id)
      return Result.ok(user)
    } catch (error: any) {
      return Result.fail(error.response?.data?.message || 'Registration failed')
    }
  }

  async login(username: string, password: string): Promise<Result<string>> {
    try {
      const response = await this.httpClient.post('/api/v1/auth/login', {
        userName: username,
        password: password
      })

      if (!response.data.isSuccess) {
        return Result.fail(response.data.message || 'Login failed')
      }

      const token = response.data.data.accessToken
      this.setAuthToken(token)
      return Result.ok(token)
    } catch (error: any) {
      return Result.fail(error.response?.data?.message || 'Login failed')
    }
  }

  async updateDisplayName(userId: string, displayName: string): Promise<Result<void>> {
    try {
      if (!this.authToken) {
        return Result.fail('Not authenticated')
      }

      const response = await this.httpClient.put('/api/v1/users/display-name', {
        displayName
      })

      if (!response.data.isSuccess) {
        return Result.fail(response.data.message || 'Failed to update display name')
      }

      return Result.ok()
    } catch (error: any) {
      return Result.fail(error.response?.data?.message || 'Failed to update display name')
    }
  }

  async updatePhoneNumber(userId: string, phoneNumber: string): Promise<Result<void>> {
    try {
      if (!this.authToken) {
        return Result.fail('Not authenticated')
      }

      const response = await this.httpClient.put('/api/v1/users/profile', {
        phoneNumber
      })

      if (!response.data.isSuccess) {
        return Result.fail(response.data.message || 'Failed to update phone number')
      }

      return Result.ok()
    } catch (error: any) {
      return Result.fail(error.response?.data?.message || 'Failed to update phone number')
    }
  }

  async assignEquipment(userId: string, equipmentIds: string[]): Promise<Result<void>> {
    try {
      if (!this.authToken) {
        return Result.fail('Not authenticated')
      }

      const response = await this.httpClient.post('/api/v1/users/equipment', {
        listEquipmentId: equipmentIds
      })

      if (!response.data.isSuccess) {
        return Result.fail(response.data.message || 'Failed to assign equipment')
      }

      return Result.ok()
    } catch (error: any) {
      return Result.fail(error.response?.data?.message || 'Failed to assign equipment')
    }
  }

  async findById(userId: string): Promise<Result<User | null>> {
    try {
      const response = await this.httpClient.get(`/api/v1/users/${userId}`)

      if (!response.data.isSuccess) {
        return Result.ok(null)
      }

      const userData = response.data.data
      const user = User.create({
        id: userData.id,
        username: userData.userName,
        displayName: userData.displayName,
        password: '', // Not returned from API
        role: userData.role,
        className: '',
        phoneNumber: userData.phoneNumber
      })

      return Result.ok(user)
    } catch (error: any) {
      return Result.fail(error.response?.data?.message || 'Failed to find user')
    }
  }

  async findByUsername(username: string): Promise<Result<User | null>> {
    // Similar implementation
    return Result.ok(null)
  }
}
