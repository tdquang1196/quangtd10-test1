/**
 * Domain Entity: User
 * Represents a user in the system with business rules and validations
 */

export type UserRole = 'student' | 'teacher'

export interface UserProps {
  id?: string
  username: string
  displayName: string
  password: string
  phoneNumber?: string
  role: UserRole
  className: string
  fullName?: string
  grade?: string
  actualUserName?: string
}

export class User {
  private constructor(private props: UserProps) {
    this.validate()
  }

  static create(props: UserProps): User {
    return new User(props)
  }

  private validate(): void {
    if (!this.props.username || this.props.username.length < 6) {
      throw new Error('Username must be at least 6 characters')
    }

    if (!this.props.username || this.props.username.length > 20) {
      throw new Error('Username must not exceed 20 characters')
    }

    if (!this.props.displayName) {
      throw new Error('Display name is required')
    }

    if (!this.props.password || this.props.password.length < 4) {
      throw new Error('Password must be at least 4 characters')
    }

    if (!this.props.className) {
      throw new Error('Class name is required')
    }
  }

  // Getters
  get id(): string | undefined {
    return this.props.id
  }

  get username(): string {
    return this.props.username
  }

  get displayName(): string {
    return this.props.displayName
  }

  get password(): string {
    return this.props.password
  }

  get phoneNumber(): string | undefined {
    return this.props.phoneNumber
  }

  get role(): UserRole {
    return this.props.role
  }

  get className(): string {
    return this.props.className
  }

  get fullName(): string | undefined {
    return this.props.fullName
  }

  get grade(): string | undefined {
    return this.props.grade
  }

  get actualUserName(): string | undefined {
    return this.props.actualUserName
  }

  // Business methods
  updateDisplayName(newDisplayName: string): void {
    if (!newDisplayName || newDisplayName.length === 0) {
      throw new Error('Display name cannot be empty')
    }
    this.props.displayName = newDisplayName
  }

  updatePhoneNumber(phoneNumber: string): void {
    this.props.phoneNumber = phoneNumber
  }

  setActualUserName(actualUserName: string): void {
    this.props.actualUserName = actualUserName
  }

  setId(id: string): void {
    this.props.id = id
  }

  // Convert to plain object for serialization
  toJSON(): UserProps {
    return { ...this.props }
  }
}
