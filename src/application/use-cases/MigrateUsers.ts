/**
 * Use Case: Migrate Users
 * Orchestrates the complete user migration process
 */

import { Result } from '../../domain/shared/Result'
import { User } from '../../domain/user-management/entities/User'
import { IUserRepository } from '../../domain/user-management/repositories/IUserRepository'
import { IClassRepository } from '../../domain/user-management/repositories/IClassRepository'
import { MigrationRequestDTO, MigrationResultDTO } from '../dtos/UserMigrationDTO'
import { EQUIPMENT_ITEMS } from '../../../config/equipment'

interface MigrateUsersConfig {
  adminUsername: string
  adminPassword: string
}

export class MigrateUsers {
  constructor(
    private userRepository: IUserRepository,
    private classRepository: IClassRepository,
    private config: MigrateUsersConfig
  ) {}

  async execute(request: MigrationRequestDTO): Promise<Result<MigrationResultDTO>> {
    try {
      // Step 1: Admin login
      const loginResult = await this.userRepository.login(
        this.config.adminUsername,
        this.config.adminPassword
      )

      if (loginResult.isFailure) {
        return Result.fail(`Admin login failed: ${loginResult.error}`)
      }

      // Step 2: Migrate students
      const studentResults = await this.migrateStudents(request.ListDataStudent)

      // Step 3: Migrate teachers
      const teacherResults = await this.migrateTeachers(request.ListDataTeacher)

      // Step 4: Create classes
      // (Implementation would go here)

      // Combine results
      const result: MigrationResultDTO = {
        ListDataStudent: studentResults.success,
        ListDataTeacher: teacherResults.success,
        ListDataClasses: [],
        ListUserError: [...studentResults.errors, ...teacherResults.errors],
        ListClassError: []
      }

      return Result.ok(result)
    } catch (error: any) {
      return Result.fail(`Migration failed: ${error.message}`)
    }
  }

  private async migrateStudents(students: any[]) {
    const success: any[] = []
    const errors: any[] = []

    for (const studentData of students) {
      try {
        const result = await this.migrateUser(studentData, 'student')
        if (result.isSuccess) {
          success.push(result.value)
        } else {
          errors.push({
            ...studentData,
            reason: result.error
          })
        }
      } catch (error: any) {
        errors.push({
          ...studentData,
          reason: error.message
        })
      }
    }

    return { success, errors }
  }

  private async migrateTeachers(teachers: any[]) {
    const success: any[] = []
    const errors: any[] = []

    for (const teacherData of teachers) {
      try {
        const result = await this.migrateUser(teacherData, 'teacher')
        if (result.isSuccess) {
          success.push(result.value)
        } else {
          errors.push({
            ...teacherData,
            reason: result.error
          })
        }
      } catch (error: any) {
        errors.push({
          ...teacherData,
          reason: error.message
        })
      }
    }

    return { success, errors }
  }

  private async migrateUser(userData: any, role: 'student' | 'teacher'): Promise<Result<any>> {
    // Check if username exists
    const usernameExistsResult = await this.userRepository.existsByUsername(userData.username)
    if (usernameExistsResult.isFailure) {
      return Result.fail(usernameExistsResult.error)
    }

    let finalUsername = userData.username
    let attempt = 1

    // Handle username conflicts
    while (usernameExistsResult.value && attempt <= 10) {
      finalUsername = `${userData.username}${attempt}`
      const checkResult = await this.userRepository.existsByUsername(finalUsername)
      if (checkResult.isSuccess && !checkResult.value) {
        break
      }
      attempt++
    }

    // Create user entity
    const user = User.create({
      username: finalUsername,
      displayName: userData.displayName,
      password: userData.password,
      phoneNumber: userData.phoneNumber || '',
      role,
      className: userData.classses
    })

    // Register user
    const registerResult = await this.userRepository.register(user)
    if (registerResult.isFailure) {
      return Result.fail(registerResult.error)
    }

    const registeredUser = registerResult.value

    // Login as user
    const loginResult = await this.userRepository.login(finalUsername, userData.password)
    if (loginResult.isFailure) {
      return Result.fail(`Login failed: ${loginResult.error}`)
    }

    // Set display name
    await this.setDisplayName(registeredUser.id!, userData.displayName)

    // Assign equipment for students
    if (role === 'student') {
      await this.assignRandomEquipment(registeredUser.id!)
    }

    // Update phone number
    if (userData.phoneNumber) {
      await this.userRepository.updatePhoneNumber(registeredUser.id!, userData.phoneNumber)
    }

    return Result.ok({
      id: registeredUser.id,
      username: userData.username,
      actualUserName: finalUsername,
      displayName: userData.displayName,
      password: userData.password,
      classses: userData.classses,
      phoneNumber: userData.phoneNumber
    })
  }

  private async setDisplayName(userId: string, displayName: string): Promise<void> {
    const strategies = [
      displayName,
      `${displayName}1`,
      `user${Math.floor(Math.random() * 10000)}`
    ]

    for (const name of strategies) {
      const checkResult = await this.userRepository.existsByDisplayName(name)
      if (checkResult.isSuccess && !checkResult.value) {
        await this.userRepository.updateDisplayName(userId, name)
        return
      }
    }
  }

  private async assignRandomEquipment(userId: string): Promise<void> {
    const equipmentIds: string[] = []

    Object.values(EQUIPMENT_ITEMS).forEach(items => {
      const randomIndex = Math.floor(Math.random() * items.length)
      equipmentIds.push(items[randomIndex])
    })

    await this.userRepository.assignEquipment(userId, equipmentIds)
  }
}
