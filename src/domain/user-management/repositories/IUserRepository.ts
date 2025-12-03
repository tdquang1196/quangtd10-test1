/**
 * Repository Interface: User Repository
 * Defines contract for user data access
 */

import { User } from '../entities/User'
import { Result } from '../../shared/Result'

export interface IUserRepository {
  /**
   * Check if username exists in the system
   */
  existsByUsername(username: string): Promise<Result<boolean>>

  /**
   * Check if display name exists in the system
   */
  existsByDisplayName(displayName: string): Promise<Result<boolean>>

  /**
   * Register a new user
   */
  register(user: User): Promise<Result<User>>

  /**
   * Authenticate user and get auth token
   */
  login(username: string, password: string): Promise<Result<string>>

  /**
   * Update user display name
   */
  updateDisplayName(userId: string, displayName: string): Promise<Result<void>>

  /**
   * Update user phone number
   */
  updatePhoneNumber(userId: string, phoneNumber: string): Promise<Result<void>>

  /**
   * Assign equipment to user
   */
  assignEquipment(userId: string, equipmentIds: string[]): Promise<Result<void>>

  /**
   * Find user by ID
   */
  findById(userId: string): Promise<Result<User | null>>

  /**
   * Find user by username
   */
  findByUsername(username: string): Promise<Result<User | null>>
}
