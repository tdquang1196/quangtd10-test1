import axios, { AxiosInstance } from 'axios'
import { getRandomEquipmentSet } from '@/config/equipment'
import fs from 'fs'
import path from 'path'
import { retryWithBackoff } from './utils/retryHelper'

interface UserData {
  id?: string
  username: string
  actualUserName?: string
  displayName: string
  actualDisplayName?: string
  classses: string
  password: string
  phoneNumber: string
  reason?: string
  grade?: number
  age?: number // Calculated age from birth date (year-based)
  accessToken?: string // Store access token from registration to avoid re-login
  loginDisplayName?: string // Store login display name from Phase 1 for fallback in Phase 2

  // State tracking for resume-from-failed-step retry
  state?: {
    registered?: boolean      // Phase 1 complete
    loggedIn?: boolean        // Phase 2 complete
    equipmentSet?: boolean    // Phase 3a complete
    phoneUpdated?: boolean    // Phase 3b complete
    addedToClass?: boolean    // Phase 4 complete
    roleAssigned?: boolean    // Phase 5 complete (teachers only)
  }
  retryCount?: number
}

interface LoginResult {
  accessToken: string
  userId: string
  displayName: string
}

interface GetUsersResult {
  users: Array<{
    userId: string
    username: string
    displayName: string
  }>
}

interface SaveUserGroupResult {
  userGroup: {
    id: string
  }
}

interface UserGroupDTO {
  id: string
  name: string
}

interface GetUserGroupsResult {
  groups: UserGroupDTO[]
}

interface MigrationResult {
  listDataStudent: UserData[]
  listDataTeacher: UserData[]
  listDataClasses: UserData[]
  listUserError: UserData[]
  listClassError: UserData[]
  roleAssignmentError?: string
}

// Role-related interfaces matching C# models
interface Role {
  id: string
  name: string
  description: string
  legacyValue: number
  permissions: string[]
  userIds: string[]
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
  isDeleted: boolean
  deletedAt?: string
  deletedBy?: string
}

interface GetRolesResult {
  roles: Role[]
}

interface SaveRoleCommand {
  id?: string
  name: string
  description: string
  permissions: string[]
  isDeleted: boolean
  legacyValue: number
  userIds: string[]
}

interface SaveRoleResult {
  success?: boolean
  id?: string
}

// Import constants from separate file
import {
  MIN_LENGTH_DISPLAY_NAME,
  MAX_LENGTH_DISPLAY_NAME,
  REGISTER_RATE,
  LOGIN_RATE,
  MAX_CONCURRENT_GROUPS,
  DEFAULT_CLASS_START_DATE,
  DEFAULT_CLASS_END_DATE
} from './migrationConstants'

/**
 * Throttled dispatcher for rate-limited parallel request dispatching.
 * Ensures minimum interval between request sends (not responses).
 */
class ThrottledDispatcher {
  private minInterval: number
  private lastSendTime: number = 0
  private name: string
  private pendingPromise: Promise<void> = Promise.resolve()

  constructor(name: string, requestsPerSecond: number) {
    this.name = name
    this.minInterval = 1200 / requestsPerSecond // 2 req/s = 500ms interval
  }

  async dispatch<T>(fn: () => Promise<T>): Promise<T> {
    // Queue requests to ensure proper spacing
    const execute = this.pendingPromise.then(async () => {
      const now = Date.now()
      const elapsed = now - this.lastSendTime
      const waitTime = Math.max(0, this.minInterval - elapsed)

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      this.lastSendTime = Date.now()
    })

    this.pendingPromise = execute
    await execute

    // Send request immediately after throttle, don't wait for response
    return fn()
  }
}

// Migration status type
export type MigrationStatus = 'idle' | 'running' | 'paused' | 'cancelled' | 'completed'

// Progress callback type
export interface MigrationProgress {
  status: MigrationStatus
  phase: 'registration' | 'login' | 'initialization' | 'classes' | 'roles' | 'completed'
  currentIndex: number
  totalUsers: number
  processedRegistrations: number
  processedLogins: number
  processedInits: number
  processedClasses: number
  totalClasses: number
  students: UserData[]
  teachers: UserData[]
  classes: any[]
  listUserError: UserData[]
  listClassError: any[]
}

export class MigrationService {
  private baseUrl: string
  private adminUsername: string
  private adminPassword: string
  private adminClient?: AxiosInstance
  private adminToken?: string

  // Pause/Resume/Cancel state
  private _status: MigrationStatus = 'idle'
  private _pausePromise: Promise<void> | null = null
  private _pauseResolver: (() => void) | null = null
  private _onProgressCallback?: (progress: MigrationProgress) => void

  // Public getters
  public get status(): MigrationStatus {
    return this._status
  }

  /**
   * Pause the migration process
   * The process will pause at the next checkpoint (after current user completes)
   */
  public pause(): void {
    if (this._status !== 'running') {
      console.log(`[MigrationService] Cannot pause: status is ${this._status}`)
      return
    }
    console.log('[MigrationService] Pausing migration...')
    this._status = 'paused'
    this._pausePromise = new Promise<void>((resolve) => {
      this._pauseResolver = resolve
    })
  }

  /**
   * Resume the migration process after pause
   */
  public resume(): void {
    if (this._status !== 'paused') {
      console.log(`[MigrationService] Cannot resume: status is ${this._status}`)
      return
    }
    console.log('[MigrationService] Resuming migration...')
    this._status = 'running'
    if (this._pauseResolver) {
      this._pauseResolver()
      this._pauseResolver = null
      this._pausePromise = null
    }
  }

  /**
   * Cancel the migration process
   * Created users/classes will be kept (no rollback)
   */
  public cancel(): void {
    if (this._status !== 'running' && this._status !== 'paused') {
      console.log(`[MigrationService] Cannot cancel: status is ${this._status}`)
      return
    }
    console.log('[MigrationService] Cancelling migration...')
    this._status = 'cancelled'
    // If paused, resolve the promise to unblock
    if (this._pauseResolver) {
      this._pauseResolver()
      this._pauseResolver = null
      this._pausePromise = null
    }
  }

  /**
   * Reset status to idle (call after migration completes or is cancelled)
   */
  public reset(): void {
    this._status = 'idle'
    this._pausePromise = null
    this._pauseResolver = null
  }

  /**
   * Set progress callback to receive updates during migration
   */
  public onProgress(callback: (progress: MigrationProgress) => void): void {
    this._onProgressCallback = callback
  }

  /**
   * Check if should pause or cancel, and wait if paused
   * Returns true if should break (cancelled), false to continue
   */
  private async checkPauseOrCancel(): Promise<boolean> {
    if (this._status === 'cancelled') {
      return true // Signal to break
    }

    if (this._status === 'paused' && this._pausePromise) {
      console.log('[MigrationService] Waiting for resume...')
      await this._pausePromise
      // After resume, check if cancelled during pause (read again since status may have changed)
      const statusAfterResume = this._status as MigrationStatus
      if (statusAfterResume === 'cancelled') {
        return true
      }
    }

    return false // Continue processing
  }

  /**
   * Emit progress update
   */
  private emitProgress(progress: Omit<MigrationProgress, 'status'>): void {
    if (this._onProgressCallback) {
      this._onProgressCallback({
        ...progress,
        status: this._status,
      })
    }
  }

  constructor(baseUrl: string, adminUsername: string, adminPassword: string, authToken?: string) {
    this.baseUrl = baseUrl
    this.adminUsername = adminUsername
    this.adminPassword = adminPassword

    // If auth token is provided, initialize client immediately
    if (authToken) {
      this.adminToken = authToken
      this.adminClient = axios.create({
        baseURL: this.baseUrl,
        headers: {
          Authorization: `Bearer ${this.adminToken}`
        }
      })
      console.log('✓ Using provided auth token, skipping admin login')
    }
  }


  /**
   * Group users by their base display name to prevent parallel conflicts
   */
  private groupByDisplayName(users: UserData[]): Map<string, UserData[]> {
    const groups = new Map<string, UserData[]>()

    for (const user of users) {
      const baseDisplayName = user.displayName.toLowerCase()
      if (!groups.has(baseDisplayName)) {
        groups.set(baseDisplayName, [])
      }
      groups.get(baseDisplayName)!.push(user)
    }

    return groups
  }

  /**
   * Group users by base username to prevent conflicts during registration
   */
  private groupByUsername(users: UserData[]): Map<string, UserData[]> {
    const groups = new Map<string, UserData[]>()

    for (const user of users) {
      const baseUsername = user.username.toLowerCase()
      if (!groups.has(baseUsername)) {
        groups.set(baseUsername, [])
      }
      groups.get(baseUsername)!.push(user)
    }

    return groups
  }

  /**
   * Split an array into batches of specified size
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  public async loginAdmin(): Promise<void> {
    // Skip if already logged in (cache for reused instances)
    if (this.adminToken && this.adminClient) {
      console.log('✓ Admin already logged in, reusing token')
      return
    }

    console.log('🔐 Logging in as admin...')
    const response = await axios.post<LoginResult>(`${this.baseUrl}/auth/login`, {
      username: this.adminUsername,
      password: this.adminPassword
    })

    this.adminToken = response.data.accessToken

    this.adminClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.adminToken}`
      }
    })

    console.log('✓ Admin login successful')
  }

  private async getExistingClasses(schoolPrefix: string): Promise<Map<string, string>> {
    try {
      // Search for groups matching the school prefix
      const response = await this.adminClient!.get<GetUserGroupsResult>(
        `/manage/User/Group?pageSize=1000&Text=${encodeURIComponent(schoolPrefix.toUpperCase())}`
      )

      const classMap = new Map<string, string>()

      // Map class/group name to its ID
      response.data.groups.forEach(group => {
        classMap.set(group.name.toLowerCase(), group.id)
      })

      return classMap
    } catch (error) {
      console.error('Failed to fetch existing classes:', error)
      return new Map()
    }
  }

  private async getExistingUsernames(filter: string): Promise<Set<string>> {
    try {
      const response = await this.adminClient!.get<GetUsersResult>(
        `/manage/Users?pageIndex=1&pageSize=1000&filter=${filter}`
      )
      return new Set(
        response.data.users
          .filter(u => u.username.toLowerCase().startsWith(filter.toLowerCase()))
          .map(u => u.username.toLowerCase())
      )
    } catch (error) {
      return new Set()
    }
  }

  private async getExistingDisplayNames(filter: string): Promise<Set<string>> {
    try {
      const response = await this.adminClient!.get<GetUsersResult>(
        `/manage/Users?pageIndex=1&pageSize=1000&filter=${filter}`
      )
      return new Set(
        response.data.users
          .filter(u => u.displayName.toLowerCase().startsWith(filter.toLowerCase()))
          .map(u => u.displayName.toLowerCase())
      )
    } catch (error) {
      return new Set()
    }
  }

  private async registerUser(username: string, password: string): Promise<{ success: boolean; actualUsername?: string; error?: string }> {
    const client = axios.create({ baseURL: this.baseUrl })

    let idx = 0
    while (true) {
      let retryCount503 = 0
      const MAX_503_RETRIES = 100

      try {
        const tryUsername = idx === 0 ? username : `${username}${idx}`
        const response = await client.post('/auth/register', {
          username: tryUsername,
          password: password
        })

        const content = JSON.stringify(response.data)

        if (content.includes('USER_NAME_EXIST')) {
          idx++
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        } else if (content.includes('true') || response.data === true) {
          return { success: true, actualUsername: tryUsername }
        } else {
          return { success: false, error: content }
        }
      } catch (error: any) {
        // Check for 503 error and retry
        if (error.message?.includes('Request failed with status code 503')) {
          retryCount503++
          if (retryCount503 < MAX_503_RETRIES) {
            console.log(`[Register 503] Retry ${retryCount503}/${MAX_503_RETRIES} for ${username}`)
            await new Promise(resolve => setTimeout(resolve, 500))
            continue
          } else {
            return { success: false, error: `Failed after ${MAX_503_RETRIES} retries: ${error.message}` }
          }
        }

        if (error.response?.data?.message?.includes('USER_NAME_EXIST')) {
          idx++
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }
        return { success: false, error: error.message }
      }
    }
  }

  private async loginUser(username: string, password: string): Promise<LoginResult | null> {
    const MAX_503_RETRIES = 100
    let retryCount503 = 0

    while (retryCount503 <= MAX_503_RETRIES) {
      try {
        const response = await axios.post<LoginResult>(`${this.baseUrl}/auth/login`, {
          username,
          password
        })
        return response.data
      } catch (error: any) {
        // Check for 503 error and retry
        if (error.message?.includes('Request failed with status code 503')) {
          retryCount503++
          if (retryCount503 < MAX_503_RETRIES) {
            console.log(`[Login 503] Retry ${retryCount503}/${MAX_503_RETRIES} for ${username}`)
            await new Promise(resolve => setTimeout(resolve, 500))
            continue
          } else {
            console.error(`[Login 503] Failed after ${MAX_503_RETRIES} retries for ${username}`)
            return null
          }
        }
        return null
      }
    }
    return null
  }

  private async validateDisplayName(
    client: AxiosInstance,
    baseDisplayName: string,
    actualUsername: string,
    loginDisplayName: string
  ): Promise<string | null> {
    let displayName = baseDisplayName
    let idx = 0
    let isUpdateToUserName = false
    let isSubstringDisplayName = false

    while (true) {
      try {
        const tryDisplayName = idx === 0 ? displayName : `${displayName}${idx}`
        const response = await client.post('/account/users/validate-display-name', {
          displayName: tryDisplayName
        })

        const content = JSON.stringify(response.data)

        if (content.includes('DISPLAY_NAME_EXISTED')) {
          idx++
          continue
        } else if (content.includes('INVALID_DISPLAY_NAME')) {
          if (!isSubstringDisplayName) {
            const parts = displayName.split(' ')
            displayName = parts[parts.length - 1]
            isSubstringDisplayName = true
            idx = 0
          } else if (!isUpdateToUserName) {
            displayName = actualUsername
            isUpdateToUserName = true
            idx = 0
          } else {
            return loginDisplayName
          }
        } else if (content.includes('true') || response.data === true) {
          return tryDisplayName
        } else {
          return loginDisplayName
        }
      } catch (error: any) {
        // Backend returns 417 status code with error message in response body
        if (error.response?.data?.message) {
          const errorMessage = error.response.data.message

          if (errorMessage.includes('DISPLAY_NAME_EXISTED')) {
            idx++
            continue
          } else if (errorMessage.includes('INVALID_DISPLAY_NAME')) {
            if (!isSubstringDisplayName) {
              const parts = displayName.split(' ')
              displayName = parts[parts.length - 1]
              isSubstringDisplayName = true
              idx = 0
            } else if (!isUpdateToUserName) {
              displayName = actualUsername
              isUpdateToUserName = true
              idx = 0
            } else {
              return loginDisplayName
            }
          } else {
            return loginDisplayName
          }
        } else {
          console.error(`[validateDisplayName] Error validating '${displayName}':`, error.message)
          return null
        }
      }
    }
  }
  /**
   * Set equipment, display name, age, and phone number in a single API call
   * Matches backend: ChangeUserEquipmentCommand { Age, ListItem, DisplayName, PhoneNumber }
   */
  private async setEquipmentAndProfile(
    client: AxiosInstance,
    displayName: string,
    age?: number,
    phoneNumber?: string
  ): Promise<boolean> {
    try {
      // Get random equipment set (HEAD, UPPER_BODY, LOWER_BODY, FOOT)
      const listItem = getRandomEquipmentSet()

      // Build request payload matching ChangeUserEquipmentCommand
      const payload: Record<string, any> = {
        listItem: listItem,
        displayName: displayName
      }

      // Include age if provided (year-based: currentYear - birthYear)
      if (age !== undefined && age !== null) {
        payload.age = age
      }

      // Include phone number if provided (clean non-digit characters)
      if (phoneNumber) {
        const cleanPhone = phoneNumber.replace(/\D/g, '')
        if (cleanPhone) {
          payload.phoneNumber = cleanPhone
        }
      }

      console.log(`[Equipment] Payload: age=${age}, phone=${phoneNumber ? 'yes' : 'no'}, displayName=${displayName}`)
      await client.post('/account/equipment', payload)
      return true
    } catch (error) {
      console.error('Equipment assignment error:', error)
      return false
    }
  }

  private writeResultsToFile(
    students: UserData[],
    teachers: UserData[],
    classes: UserData[],
    listUserError: UserData[],
    listClassError: UserData[]
  ): string {
    try {
      // Create 'output data' folder if it doesn't exist
      const outputDir = path.join(process.cwd(), 'output data')
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `migration-results-${timestamp}.json`
      const filepath = path.join(outputDir, filename)

      const fileContent = {
        migrationTimestamp: new Date().toISOString(),
        summary: {
          totalStudents: students.length,
          totalTeachers: teachers.length,
          totalClasses: classes.length,
          successfulUsers: students.length + teachers.length - listUserError.length,
          failedUsers: listUserError.length,
          failedClasses: listClassError.length
        },
        students: students,
        teachers: teachers,
        classes: classes,
        errors: {
          failedUsers: listUserError,
          failedClasses: listClassError
        }
      }

      fs.writeFileSync(filepath, JSON.stringify(fileContent, null, 2), 'utf-8')
      return filepath
    } catch (error) {
      console.error('Failed to write results to file:', error)
      return ''
    }
  }

  /**
   * Phase 1: Register user account and get username + access token
   * This phase creates the account and immediately gets the access token to avoid re-login in Phase 2
   */
  private async registerUserAccount(user: UserData, listUserError: UserData[]): Promise<void> {
    // Check existing usernames
    const existingUsernames = await this.getExistingUsernames(user.username)
    let tempIdx = 0
    let finalUsername = user.username
    while (existingUsernames.has(finalUsername.toLowerCase())) {
      tempIdx++
      finalUsername = `${user.username}${tempIdx}`
    }
    user.username = finalUsername

    // Register user
    const registerResult = await this.registerUser(user.username, user.password)
    if (!registerResult.success) {
      user.reason = registerResult.error || 'Registration failed'
      listUserError.push({ ...user })
      return
    }

    user.actualUserName = registerResult.actualUsername!

    // Login to get user ID and access token (save token to avoid re-login in Phase 2)
    const loginResult = await this.loginUser(user.actualUserName, user.password)
    if (!loginResult) {
      user.reason = 'Login failed after registration'
      listUserError.push({ ...user })
      return
    }

    user.id = loginResult.userId
    user.accessToken = loginResult.accessToken // ✨ Save access token for Phase 2
    user.loginDisplayName = loginResult.displayName // ✨ Save login display name for Phase 2
  }

  /**
   * Phase 2: Initialize user character (display name, equipment, phone)
   * This phase uses the access token saved from Phase 1, avoiding re-login
   */
  private async initializeUserCharacter(user: UserData, listUserError: UserData[]): Promise<void> {
    // Skip if user doesn't have actualUserName or accessToken (registration failed)
    if (!user.actualUserName || !user.accessToken) {
      return
    }

    // ✨ Use saved access token from Phase 1 (no need to login again)
    const userClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${user.accessToken}`
      }
    })

    // ✨ Use saved login display name from Phase 1 (no need to call API again)
    const defaultDisplayName = user.loginDisplayName || user.actualUserName

    // Check and validate display name
    const existingDisplayNames = await this.getExistingDisplayNames(user.displayName)

    let tempDisplayIdx = 0
    let baseDisplayName = user.displayName
    let isUpdateToUserName = false
    let isSubstringDisplayName = false

    while (true) {
      const tryDisplayName = tempDisplayIdx === 0 ? baseDisplayName : `${baseDisplayName}${tempDisplayIdx}`

      if (existingDisplayNames.has(tryDisplayName.toLowerCase())) {
        tempDisplayIdx++
        continue
      } else if (tryDisplayName.length < MIN_LENGTH_DISPLAY_NAME || tryDisplayName.length > MAX_LENGTH_DISPLAY_NAME) {
        if (!isSubstringDisplayName) {
          const parts = baseDisplayName.split(' ')
          baseDisplayName = parts[parts.length - 1]
          isSubstringDisplayName = true
          tempDisplayIdx = 0
        } else if (!isUpdateToUserName) {
          baseDisplayName = user.actualUserName
          isUpdateToUserName = true
          tempDisplayIdx = 0
        } else {
          baseDisplayName = defaultDisplayName
          tempDisplayIdx = 0
        }
      } else {
        user.displayName = tryDisplayName
        break
      }
    }

    // Validate display name with backend
    const validatedDisplayName = await this.validateDisplayName(
      userClient,
      user.displayName,
      user.actualUserName,
      defaultDisplayName
    )

    // Use validated display name or fallback to default display name
    user.actualDisplayName = validatedDisplayName || defaultDisplayName

    // Set equipment, profile, age, and phone number in a single API call
    // This combines equipmentSet and phoneUpdated into one step
    if (!user.state?.equipmentSet || !user.state?.phoneUpdated) {
      try {
        await retryWithBackoff(
          () => this.setEquipmentAndProfile(userClient, user.actualDisplayName!, user.age, user.phoneNumber),
          { context: `Equipment+Phone ${user.actualUserName}`, maxRetries: 3 }
        )
        user.state = { ...user.state, equipmentSet: true, phoneUpdated: true }
      } catch (error) {
        console.error('Equipment/Phone setup failed after retries:', error)
      }
    }
  }

  /**
   * Legacy method kept for backward compatibility
   * Uses the new two-phase approach internally
   */
  private async processUser(user: UserData, listUserError: UserData[]): Promise<void> {
    await this.registerUserAccount(user, listUserError)
    await this.initializeUserCharacter(user, listUserError)
  }

  private async getExistingAdminTeacher(schoolPrefix: string): Promise<{ id: string; username: string; displayName: string } | null> {
    try {
      const adminTeacherUsername = `${schoolPrefix.toLowerCase()}gv`
      console.log(`Searching for existing admin teacher: ${adminTeacherUsername}`)

      const response = await this.adminClient!.get<GetUsersResult>(
        `/manage/Users?pageIndex=1&pageSize=100&filter=${adminTeacherUsername}`
      )

      const adminTeacher = response.data.users.find(u =>
        u.username.toLowerCase() === adminTeacherUsername
      )

      if (adminTeacher) {
        console.log(`Found existing admin teacher: ${adminTeacher.username} (${adminTeacher.displayName})`)

        // Use userId from the response
        if (adminTeacher.userId) {
          return {
            id: adminTeacher.userId,
            username: adminTeacher.username,
            displayName: adminTeacher.displayName
          }
        } else {
          console.error('Admin teacher found but userId is missing')
          return null
        }
      }

      console.log(`No existing admin teacher found for: ${adminTeacherUsername}`)
      return null
    } catch (error) {
      console.error('Failed to fetch existing admin teacher:', error)
      return null
    }
  }

  /**
   * Get all roles from the system
   */
  private async getRoles(): Promise<Role[]> {
    try {
      const response = await this.adminClient!.get<GetRolesResult>(
        '/manage/user/roles?pageSize=1000&pageIndex=1'
      )
      return response.data.roles || []
    } catch (error) {
      console.error('Failed to fetch roles:', error)
      return []
    }
  }

  /**
   * Save or update a role with new user IDs
   * Data pushed to server will append to current data
   */
  private async saveRole(roleCommand: SaveRoleCommand): Promise<boolean> {
    try {
      await this.adminClient!.post('/manage/user/roles', roleCommand)
      console.log(`✓ Role "${roleCommand.name}" updated with ${roleCommand.userIds.length} users`)
      return true
    } catch (error: any) {
      console.error(`Failed to save role "${roleCommand.name}":`, error.message)
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data))
      }
      return false
    }
  }

  /**
   * Assign teachers to the Teacher role
   * Only adds teacher user IDs to the role's userIds list
   */
  public async assignTeachersToRole(teacherIds: string[]): Promise<boolean> {
    try {
      if (teacherIds.length === 0) {
        console.log('No teachers to assign to role')
        return true
      }

      console.log(`Assigning ${teacherIds.length} teachers to Teacher role...`)

      // Get all roles with retry
      const roles = await retryWithBackoff(
        () => this.getRoles(),
        { context: 'Get roles', maxRetries: 3 }
      )

      // Find the Teacher role (by name)
      const teacherRole = roles.find(r => r.name.toLowerCase() === 'teacher' || r.name.toLowerCase() === 'giáo viên')

      if (!teacherRole) {
        console.error('Teacher role not found in system')
        return false
      }

      // Merge existing userIds with new teacher IDs (append, don't replace)
      const existingUserIds = teacherRole.userIds || []
      const allUserIds = [...new Set([...existingUserIds, ...teacherIds])] // Remove duplicates

      // Prepare save command
      const saveCommand: SaveRoleCommand = {
        id: teacherRole.id,
        name: teacherRole.name,
        description: teacherRole.description,
        permissions: teacherRole.permissions || [],
        isDeleted: false,
        legacyValue: teacherRole.legacyValue,
        userIds: allUserIds
      }

      // Save updated role with retry (5 attempts with exponential backoff)
      const success = await retryWithBackoff(
        () => this.saveRole(saveCommand),
        { context: `Save role "${teacherRole.name}"`, maxRetries: 5 }
      )

      if (success) {
        console.log(`✓ Successfully assigned ${teacherIds.length} teachers to role "${teacherRole.name}"`)
        console.log(`  Total users in role: ${allUserIds.length} (added ${teacherIds.length} new)`)
      }

      return success
    } catch (error: any) {
      console.error('Failed to assign teachers to role after retries:', error.message)
      return false
    }
  }

  public async migrate(
    students: UserData[],
    teachers: UserData[],
    classes: UserData[]
  ): Promise<MigrationResult> {
    // Set status to running
    this._status = 'running'

    const startTime = Date.now()
    const getTimestamp = () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const now = new Date().toLocaleTimeString('en-US', { hour12: false })
      return `[${now}] [+${elapsed}s]`
    }

    // Progress tracking variables for pause/resume (prefixed to avoid name collision)
    let _pReg = 0
    let _pLog = 0
    let _pInit = 0
    let _pClass = 0

    // Helper to emit progress
    const emitCurrentProgress = (phase: 'registration' | 'login' | 'initialization' | 'classes' | 'roles' | 'completed') => {
      this.emitProgress({
        phase,
        currentIndex: _pReg + _pLog + _pInit + _pClass,
        totalUsers: students.length + teachers.length,
        processedRegistrations: _pReg,
        processedLogins: _pLog,
        processedInits: _pInit,
        processedClasses: _pClass,
        totalClasses: classes.length,
        students,
        teachers,
        classes,
        listUserError,
        listClassError,
      })
    }

    // Login as admin
    await this.loginAdmin()

    // Extract school prefix from first class name (format: SCHOOLPREFIX_GRADE_YEAR)
    const schoolPrefix = classes.length > 0 ? classes[0].username.split('_')[0] : ''

    // Fetch existing classes
    console.log(`${getTimestamp()} Fetching existing classes for prefix: ${schoolPrefix}...`)
    const existingClasses = await this.getExistingClasses(schoolPrefix)
    console.log(`${getTimestamp()} Found ${existingClasses.size} existing classes`)

    let existingAdminTeacherId: string | null = null
    const listUserError: UserData[] = []
    const listClassError: UserData[] = []

    // Check if admin teacher already exists in the system
    console.log(`${getTimestamp()} Checking for existing admin teacher...`)
    const existingAdminTeacher = await this.getExistingAdminTeacher(schoolPrefix)
    const adminTeacherExists = existingAdminTeacher !== null

    if (adminTeacherExists) {
      console.log(`${getTimestamp()} Admin teacher already exists: ${existingAdminTeacher!.username}, will use for class assignments`)
      existingAdminTeacherId = existingAdminTeacher!.id
    } else {
      console.log(`${getTimestamp()} No existing admin teacher found, will create new one if present in data`)
    }

    // Filter teachers based on existing classes and admin teacher status
    const teachersToCreate = teachers.filter(teacher => {
      // Check if this is the admin teacher (general teacher for all classes)
      const isAdminTeacher = teacher.classses.toUpperCase() === schoolPrefix.toUpperCase()

      if (isAdminTeacher) {
        // Skip admin teacher if it already exists in the system
        if (adminTeacherExists) {
          console.log(`${getTimestamp()} Skipping admin teacher ${teacher.username} - already exists in system`)
          return false
        }
        // Create admin teacher if it doesn't exist
        console.log(`${getTimestamp()} Will create admin teacher ${teacher.username}`)
        return true
      }

      // Check if teacher's class already exists
      const classExists = existingClasses.has(teacher.classses.toLowerCase())
      if (classExists) {
        console.log(`${getTimestamp()} Skipping teacher ${teacher.username} - class ${teacher.classses} already exists`)
      }
      return !classExists
    })

    console.log(`${getTimestamp()} Teachers to create: ${teachersToCreate.length} (skipped ${teachers.length - teachersToCreate.length} for existing classes/admin)`)

    // Preserve original order from Excel file by adding index
    students.forEach((student, index) => {
      (student as any).originalIndex = index
    })
    teachersToCreate.forEach((teacher, index) => {
      (teacher as any).originalIndex = students.length + index
    })

    // ===== PHASE 1: USER REGISTRATION (Grouped by Username) =====
    console.log(`\n${getTimestamp()} ========== PHASE 1: USER REGISTRATION (${REGISTER_RATE} req/s) ==========`)
    const allUsers = [...students, ...teachersToCreate]
    console.log(`${getTimestamp()} Registering ${allUsers.length} user accounts with grouped parallel dispatch`)

    // Group by username to prevent conflicts
    const usernameGroups = this.groupByUsername(allUsers)
    console.log(`${getTimestamp()} Grouped ${allUsers.length} users into ${usernameGroups.size} username groups`)

    // Create throttled dispatcher for registration
    const registerDispatcher = new ThrottledDispatcher('Register', REGISTER_RATE)

    let completedRegistrations = 0

    // Convert groups to array
    const registrationGroupEntries = Array.from(usernameGroups.entries())

    // Process username groups with concurrency pool
    let registrationActiveGroups = 0
    let registrationCurrentIndex = 0
    const registrationTotalGroups = registrationGroupEntries.length

    const processNextRegistrationGroup = async (): Promise<void> => {
      if (registrationCurrentIndex >= registrationTotalGroups) return

      const index = registrationCurrentIndex++
      const [baseUsername, usersInGroup] = registrationGroupEntries[index]

      registrationActiveGroups++
      console.log(`${getTimestamp()} [Registration] Processing username group: ${baseUsername} (${usersInGroup.length} users) [${registrationActiveGroups} active groups]`)

      try {
        // Process users in this group sequentially to ensure unique usernames
        for (const user of usersInGroup) {
          // Check for pause/cancel at start of each user
          if (await this.checkPauseOrCancel()) {
            console.log(`${getTimestamp()} [Registration] Migration cancelled/paused`)
            return // Exit this group processing
          }

          try {
            // Skip if already registered
            if (user.state?.registered) {
              console.log(`${getTimestamp()} [Registration] Skip ${user.username} (already registered)`)
              completedRegistrations++
              _pReg++
              emitCurrentProgress('registration')
              continue
            }

            // Check existing usernames first (uses admin client, not rate limited)
            const existingUsernames = await this.getExistingUsernames(user.username)
            let tempIdx = 0
            let finalUsername = user.username
            while (existingUsernames.has(finalUsername.toLowerCase())) {
              tempIdx++
              finalUsername = `${user.username}${tempIdx}`
            }
            user.username = finalUsername

            // Wrap registration with retry (3 attempts with backoff)
            const registerResult = await retryWithBackoff(
              () => registerDispatcher.dispatch(() =>
                this.registerUser(user.username, user.password)
              ),
              { context: `Register ${user.username}`, maxRetries: 3 }
            )

            if (!registerResult.success) {
              user.reason = registerResult.error || 'Registration failed'
              listUserError.push({ ...user })
              completedRegistrations++
              _pReg++
              emitCurrentProgress('registration')
              console.log(`${getTimestamp()} [Registration] ${completedRegistrations}/${allUsers.length} - FAILED: ${user.username}`)
              continue
            }

            user.actualUserName = registerResult.actualUsername!
            user.state = { ...user.state, registered: true }
            user.retryCount = 0
            completedRegistrations++
            _pReg++
            emitCurrentProgress('registration')
            console.log(`${getTimestamp()} [Registration] ${completedRegistrations}/${allUsers.length} - OK: ${user.actualUserName}`)
          } catch (error: any) {
            user.reason = error.message || 'Unknown error'
            user.retryCount = (user.retryCount || 0) + 1
            listUserError.push({ ...user })
            completedRegistrations++
            _pReg++
            emitCurrentProgress('registration')
            console.log(`${getTimestamp()} [Registration] ${completedRegistrations}/${allUsers.length} - ERROR: ${user.username} - ${error.message}`)
          }
        }
      } finally {
        registrationActiveGroups--
        // When this group finishes, start the next one
        await processNextRegistrationGroup()
      }
    }

    // Start initial batch of groups
    const registrationInitialPromises = []
    for (let i = 0; i < Math.min(MAX_CONCURRENT_GROUPS, registrationTotalGroups); i++) {
      registrationInitialPromises.push(processNextRegistrationGroup())
    }

    await Promise.all(registrationInitialPromises)

    console.log(`${getTimestamp()} Phase 1 complete: ${completedRegistrations} registrations processed, ${listUserError.length} failed`)

    // ===== PHASE 2: USER LOGIN (Parallel with Rate Limiting) =====
    console.log(`\n${getTimestamp()} ========== PHASE 2: USER LOGIN (${LOGIN_RATE} req/s) ==========`)

    // Only login successfully registered users
    const registeredUsers = allUsers.filter(u => u.actualUserName && !listUserError.some(err => err.username === u.username))
    console.log(`${getTimestamp()} Logging in ${registeredUsers.length} users to get access tokens`)

    const loginDispatcher = new ThrottledDispatcher('Login', LOGIN_RATE)
    let completedLogins = 0

    const loginPromises = registeredUsers.map(async (user) => {
      // Check for pause/cancel
      if (await this.checkPauseOrCancel()) {
        console.log(`${getTimestamp()} [Login] Migration cancelled/paused`)
        return
      }

      try {
        // Skip if already logged in
        if (user.state?.loggedIn) {
          console.log(`${getTimestamp()} [Login] Skip ${user.actualUserName} (already logged in)`)
          completedLogins++
          _pLog++
          emitCurrentProgress('login')
          return
        }

        // Wrap login with retry (3 attempts with backoff)
        const loginResult = await retryWithBackoff(
          () => loginDispatcher.dispatch(() =>
            this.loginUser(user.actualUserName!, user.password)
          ),
          { context: `Login ${user.actualUserName}`, maxRetries: 3 }
        )

        if (!loginResult) {
          user.reason = 'Login failed after registration'
          listUserError.push({ ...user })
          completedLogins++
          _pLog++
          emitCurrentProgress('login')
          console.log(`${getTimestamp()} [Login] ${completedLogins}/${registeredUsers.length} - FAILED: ${user.actualUserName}`)
          return
        }

        user.id = loginResult.userId
        user.accessToken = loginResult.accessToken
        user.loginDisplayName = loginResult.displayName
        user.state = { ...user.state, loggedIn: true }

        completedLogins++
        _pLog++
        emitCurrentProgress('login')
        console.log(`${getTimestamp()} [Login] ${completedLogins}/${registeredUsers.length} - OK: ${user.actualUserName}`)
      } catch (error: any) {
        user.reason = error.message || 'Login error'
        user.retryCount = (user.retryCount || 0) + 1
        listUserError.push({ ...user })
        completedLogins++
        _pLog++
        emitCurrentProgress('login')
        console.log(`${getTimestamp()} [Login] ${completedLogins}/${registeredUsers.length} - ERROR: ${user.actualUserName} - ${error.message}`)
      }
    })

    await Promise.all(loginPromises)

    console.log(`${getTimestamp()} Phase 2 complete: ${completedLogins} logins processed, ${listUserError.length} total failed`)

    // ===== PHASE 3: CHARACTER INITIALIZATION (Grouped by Display Name) =====
    console.log(`\n${getTimestamp()} ========== PHASE 3: CHARACTER INITIALIZATION ==========`)

    // Only initialize characters for successfully registered users
    const successfullyRegistered = allUsers.filter(u => u.actualUserName && !listUserError.some(err => err.username === u.username))
    console.log(`${getTimestamp()} ${successfullyRegistered.length} users successfully registered, proceeding to character initialization`)

    // Group by display name to prevent conflicts
    const displayNameGroups = this.groupByDisplayName(successfullyRegistered)
    console.log(`${getTimestamp()} Grouped ${successfullyRegistered.length} users into ${displayNameGroups.size} display name groups`)


    // Counter for this phase
    let processedInits = 0

    // Convert groups to array
    const groupEntries = Array.from(displayNameGroups.entries())

    // Process display name groups with concurrency pool
    // When a group finishes, immediately start the next one
    // This ensures we always have MAX_CONCURRENT_GROUPS running
    let activeGroups = 0
    let currentIndex = 0
    const totalGroups = groupEntries.length

    const processNextGroup = async (): Promise<void> => {
      if (currentIndex >= totalGroups) return

      const index = currentIndex++
      const [baseDisplayName, usersInGroup] = groupEntries[index]

      activeGroups++
      console.log(`${getTimestamp()} [Initialization] Processing display name group: ${baseDisplayName} (${usersInGroup.length} users) [${activeGroups} active groups]`)

      try {
        // Process users in this group sequentially to ensure unique display names
        for (const user of usersInGroup) {
          // Check for pause/cancel
          if (await this.checkPauseOrCancel()) {
            console.log(`${getTimestamp()} [Initialization] Migration cancelled/paused`)
            return
          }

          await this.initializeUserCharacter(user, listUserError)
          processedInits++
          _pInit++
          emitCurrentProgress('initialization')
          console.log(`${getTimestamp()} [Initialization] ${processedInits}/${successfullyRegistered.length} - Initialized: ${user.actualUserName} (${user.actualDisplayName || user.displayName})`)
        }
      } finally {
        activeGroups--
        // When this group finishes, start the next one
        await processNextGroup()
      }
    }

    // Start initial batch of groups
    const initialPromises = []
    for (let i = 0; i < Math.min(MAX_CONCURRENT_GROUPS, totalGroups); i++) {
      initialPromises.push(processNextGroup())
    }

    await Promise.all(initialPromises)

    console.log(`${getTimestamp()} Phase 3 complete: ${processedInits} characters initialized`)

    // Restore original order from Excel file
    students.sort((a, b) => ((a as any).originalIndex || 0) - ((b as any).originalIndex || 0))
    teachersToCreate.sort((a, b) => ((a as any).originalIndex || 0) - ((b as any).originalIndex || 0))

    // Process classes
    console.log(`${getTimestamp()} Processing ${classes.length} classes...`)
    for (let i = 0; i < classes.length; i++) {
      // Check for pause/cancel
      if (await this.checkPauseOrCancel()) {
        console.log(`${getTimestamp()} [Classes] Migration cancelled/paused`)
        break
      }

      const classItem = classes[i]
      console.log(`${getTimestamp()} [${i + 1}/${classes.length}] Processing class: ${classItem.username}`)
      try {
        // Get students for this class
        const groupStudents = students
          .filter(s => s.classses === classItem.username && s.id)
          .map(s => s.id)

        if (groupStudents.length === 0) {
          console.log(`${getTimestamp()} [${i + 1}/${classes.length}] Skipping class ${classItem.username} - no students`)
          continue
        }

        // Check if class already exists in the system
        const existingGroupId = existingClasses.get(classItem.username.toLowerCase())

        if (existingGroupId) {
          // Class exists - just add students to existing group (no teachers)
          console.log(`${getTimestamp()} [${i + 1}/${classes.length}] Class ${classItem.username} already exists (Group ID: ${existingGroupId}), adding ${groupStudents.length} students...`)

          // Retry adding students to group
          await retryWithBackoff(
            () => this.adminClient!.put('/manage/User/Group/Set', {
              groupId: existingGroupId,
              userIds: groupStudents
            }),
            { context: `Add students to group ${classItem.username}`, maxRetries: 5 }
          )

          console.log(`${getTimestamp()} [${i + 1}/${classes.length}] ✅ Added ${groupStudents.length} students to existing class ${classItem.username} (teachers not created)`)
        } else {
          // Class doesn't exist - create new class and group with teachers
          console.log(`${getTimestamp()} [${i + 1}/${classes.length}] Creating new class: ${classItem.username}`)

          // Retry group creation
          const createGroupResponse = await retryWithBackoff(
            () => this.adminClient!.post<SaveUserGroupResult>('/manage/user/group', {
              name: classItem.username,
              users: groupStudents
            }),
            { context: `Create group ${classItem.username}`, maxRetries: 5 }
          )

          const groupId = createGroupResponse.data.userGroup.id

          // Find teachers for this NEW class (only from teachersToCreate)
          // This includes:
          // 1. Class-specific teacher (e.g., hytklttgv1a for class HYTKLTT_1A_2025)
          // 2. Admin teacher if exists (e.g., hytklttgv for all classes)
          const classTeachers = teachersToCreate
            .filter(t => {
              if (!t.id) return false

              // Adminteacher (className is schoolPrefix) - add to ALL classes
              const isAdminTeacher = t.classses.toUpperCase() === schoolPrefix.toUpperCase()
              if (isAdminTeacher) return true

              // Class-specific teacher
              return t.classses.toLowerCase() === classItem.username.toLowerCase() ||
                classItem.username.toLowerCase().startsWith(t.classses.toLowerCase())
            })
            .map(t => t.id)

          // Add existing admin teacher if available
          if (existingAdminTeacherId && !classTeachers.includes(existingAdminTeacherId)) {
            console.log(`${getTimestamp()} [${i + 1}/${classes.length}] Adding existing admin teacher to class ${classItem.username}`)
            classTeachers.push(existingAdminTeacherId)
          }

          // Retry class creation
          await retryWithBackoff(
            () => this.adminClient!.post('/manage/classes', {
              name: classItem.username,
              description: classItem.username,
              startDate: DEFAULT_CLASS_START_DATE,
              endDate: DEFAULT_CLASS_END_DATE,
              targetGroups: [groupId],
              teachers: classTeachers,
              grades: classItem.grade ? [classItem.grade] : []
            }),
            { context: `Create class ${classItem.username}`, maxRetries: 5 }
          )

          console.log(`${getTimestamp()} [${i + 1}/${classes.length}] ✅ Class ${classItem.username} created (${groupStudents.length} students, ${classTeachers.length} teachers)`)
        }
      } catch (error: any) {
        console.error(`${getTimestamp()} [${i + 1}/${classes.length}] ❌ Failed to process class ${classItem.username}:`, error.message)
        if (error.response) {
          console.error(`${getTimestamp()} Response status: ${error.response.status}`)
          console.error(`${getTimestamp()} Response data:`, JSON.stringify(error.response.data))
        }
        classItem.reason = error.response?.data?.message || error.message
        listClassError.push({ ...classItem })
      }

      // Update progress after each class
      _pClass++
      emitCurrentProgress('classes')
    }

    // ===== PHASE 4: ASSIGN TEACHERS TO ROLE =====
    console.log(`\\n${getTimestamp()} ========== PHASE 4: TEACHER ROLE ASSIGNMENT ==========`)

    // Collect all successfully created teacher IDs (only teachers, not students)
    const successfulTeacherIds = teachersToCreate
      .filter(t => t.id && !listUserError.some(err => err.username === t.username))
      .map(t => t.id!)

    console.log(`${getTimestamp()} Found ${successfulTeacherIds.length} successfully created teachers to assign to role`)

    let roleAssignmentError: string | undefined

    if (successfulTeacherIds.length > 0) {
      const roleAssignmentSuccess = await this.assignTeachersToRole(successfulTeacherIds)
      if (!roleAssignmentSuccess) {
        roleAssignmentError = 'Failed to assign teachers to role'
        console.error(`${getTimestamp()} ❌ ${roleAssignmentError}`)
      } else {
        console.log(`${getTimestamp()} ✅ Successfully assigned ${successfulTeacherIds.length} teachers to Teacher role`)
      }
    } else {
      console.log(`${getTimestamp()} No teachers to assign to role`)
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

    // Set final status (read into variable to avoid TS narrowing issue)
    const finalStatus = this._status as MigrationStatus
    if (finalStatus === 'cancelled') {
      console.log(`${getTimestamp()} Migration CANCELLED after ${totalTime}s`)
      emitCurrentProgress('completed')
    } else {
      this._status = 'completed'
      console.log(`${getTimestamp()} Migration completed in ${totalTime}s`)
      emitCurrentProgress('completed')
    }

    console.log(`${getTimestamp()} Success: ${students.length + teachersToCreate.length - listUserError.length} users (${students.length} students, ${teachersToCreate.length} teachers)`)
    console.log(`${getTimestamp()} Failed: ${listUserError.length} users`)
    console.log(`${getTimestamp()} Teachers skipped (existing classes): ${teachers.length - teachersToCreate.length}`)
    console.log(`${getTimestamp()} Class errors: ${listClassError.length}`)

    // Write results to file
    const filepath = this.writeResultsToFile(students, teachersToCreate, classes, listUserError, listClassError)
    if (filepath) {
      console.log(`\\n${getTimestamp()} Results saved to file: ${filepath}`)
    }

    return {
      listDataStudent: students,
      listDataTeacher: teachersToCreate,
      listDataClasses: classes,
      listUserError: listUserError,
      listClassError: listClassError,
      roleAssignmentError: roleAssignmentError
    }
  }

  /**
   * Retry failed users by resuming from the step they failed at.
   * This method checks the user's state and continues from where it left off:
   * - If not registered: run full registration + login + init
   * - If registered but not logged in: run login + init
   * - If logged in but not initialized: run just init
   * - After all phases, add users to their groups/classes
   * 
   * @param failedUsers - List of users that failed during migration
   * @param options - Optional: schoolPrefix and classes for group/class assignment
   */
  public async retryUsers(
    failedUsers: UserData[],
    options?: {
      schoolPrefix?: string
      classes?: UserData[]
      allStudents?: UserData[]
      allTeachers?: UserData[]
    }
  ): Promise<{
    successfulUsers: UserData[]
    stillFailedUsers: UserData[]
  }> {
    const startTime = Date.now()
    const getTimestamp = () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const now = new Date().toLocaleTimeString('en-US', { hour12: false })
      return `[${now}] [+${elapsed}s]`
    }

    console.log(`\n${getTimestamp()} ========== RETRY: Resume from failed step ==========`)
    console.log(`${getTimestamp()} Retrying ${failedUsers.length} failed users`)

    // Login admin if needed
    await this.loginAdmin()

    const successfulUsers: UserData[] = []
    const stillFailedUsers: UserData[] = []

    // Create dispatchers for rate limiting
    const registerDispatcher = new ThrottledDispatcher('Register', REGISTER_RATE)
    const loginDispatcher = new ThrottledDispatcher('Login', LOGIN_RATE)

    for (let i = 0; i < failedUsers.length; i++) {
      const user = { ...failedUsers[i] } // Clone to avoid mutating original
      console.log(`${getTimestamp()} [${i + 1}/${failedUsers.length}] Processing: ${user.username}`)

      try {
        // STEP 1: Registration (skip if already registered)
        if (!user.state?.registered || !user.actualUserName) {
          console.log(`${getTimestamp()} [${i + 1}] Phase 1: Registering user...`)

          // Check existing usernames
          const existingUsernames = await this.getExistingUsernames(user.username)
          let tempIdx = 0
          let finalUsername = user.username
          while (existingUsernames.has(finalUsername.toLowerCase())) {
            tempIdx++
            finalUsername = `${user.username}${tempIdx}`
          }
          user.username = finalUsername

          const registerResult = await retryWithBackoff(
            () => registerDispatcher.dispatch(() =>
              this.registerUser(user.username, user.password)
            ),
            { context: `Register ${user.username}`, maxRetries: 3 }
          )

          if (!registerResult.success) {
            user.reason = registerResult.error || 'Registration failed'
            stillFailedUsers.push(user)
            console.log(`${getTimestamp()} [${i + 1}] ❌ Registration failed: ${user.reason}`)
            continue
          }

          user.actualUserName = registerResult.actualUsername!
          user.state = { ...user.state, registered: true }
          console.log(`${getTimestamp()} [${i + 1}] ✓ Registered as: ${user.actualUserName}`)
        } else {
          console.log(`${getTimestamp()} [${i + 1}] Phase 1: Skip (already registered as ${user.actualUserName})`)
        }

        // STEP 2: Login (skip if already logged in with valid token)
        if (!user.state?.loggedIn || !user.accessToken) {
          console.log(`${getTimestamp()} [${i + 1}] Phase 2: Logging in...`)

          const loginResult = await retryWithBackoff(
            () => loginDispatcher.dispatch(() =>
              this.loginUser(user.actualUserName!, user.password)
            ),
            { context: `Login ${user.actualUserName}`, maxRetries: 3 }
          )

          if (!loginResult) {
            user.reason = 'Login failed after registration'
            stillFailedUsers.push(user)
            console.log(`${getTimestamp()} [${i + 1}] ❌ Login failed`)
            continue
          }

          user.id = loginResult.userId
          user.accessToken = loginResult.accessToken
          user.loginDisplayName = loginResult.displayName
          user.state = { ...user.state, loggedIn: true }
          console.log(`${getTimestamp()} [${i + 1}] ✓ Logged in, userId: ${user.id}`)
        } else {
          console.log(`${getTimestamp()} [${i + 1}] Phase 2: Skip (already logged in)`)
        }

        // STEP 3: Character initialization (equipment + phone)
        if (!user.state?.equipmentSet || !user.state?.phoneUpdated) {
          console.log(`${getTimestamp()} [${i + 1}] Phase 3: Initializing character...`)

          const userClient = axios.create({
            baseURL: this.baseUrl,
            headers: {
              Authorization: `Bearer ${user.accessToken}`
            }
          })

          const defaultDisplayName = user.loginDisplayName || user.actualUserName!

          // Validate display name if not done before
          if (!user.actualDisplayName) {
            const validatedDisplayName = await this.validateDisplayName(
              userClient,
              user.displayName,
              user.actualUserName!,
              defaultDisplayName
            )
            user.actualDisplayName = validatedDisplayName || defaultDisplayName
          }

          // Set equipment, age, and phone in a single API call if not done
          if (!user.state?.equipmentSet || !user.state?.phoneUpdated) {
            try {
              await retryWithBackoff(
                () => this.setEquipmentAndProfile(userClient, user.actualDisplayName!, user.age, user.phoneNumber),
                { context: `Equipment+Phone ${user.actualUserName}`, maxRetries: 3 }
              )
              user.state = { ...user.state, equipmentSet: true, phoneUpdated: true }
              console.log(`${getTimestamp()} [${i + 1}] ✓ Equipment+Phone set`)
            } catch (error) {
              console.error(`${getTimestamp()} [${i + 1}] ⚠ Equipment/Phone setup failed, continuing...`)
            }
          }
        } else {
          console.log(`${getTimestamp()} [${i + 1}] Phase 3: Skip (already initialized)`)
        }

        // Clear error reason and add to successful
        user.reason = undefined
        successfulUsers.push(user)
        console.log(`${getTimestamp()} [${i + 1}] ✅ User completed successfully: ${user.actualUserName}`)

      } catch (error: any) {
        user.reason = error.message || 'Unknown error during retry'
        user.retryCount = (user.retryCount || 0) + 1
        stillFailedUsers.push(user)
        console.log(`${getTimestamp()} [${i + 1}] ❌ Error: ${error.message}`)
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n${getTimestamp()} Retry completed in ${totalTime}s`)
    console.log(`${getTimestamp()} Success: ${successfulUsers.length} | Still failed: ${stillFailedUsers.length}`)

    // ===== PHASE 4: ADD USERS TO GROUPS/CLASSES =====
    // Only if we have schoolPrefix and classes info from options
    // Filter users that haven't been added to class yet
    const usersNeedingClassAssignment = successfulUsers.filter(u => !u.state?.addedToClass)

    if (options?.schoolPrefix && options?.classes && usersNeedingClassAssignment.length > 0) {
      console.log(`\n${getTimestamp()} ========== PHASE 4: ADD USERS TO GROUPS/CLASSES ==========`)
      console.log(`${getTimestamp()} ${usersNeedingClassAssignment.length} users need class assignment (${successfulUsers.length - usersNeedingClassAssignment.length} already assigned)`)

      const schoolPrefix = options.schoolPrefix
      const classes = options.classes
      const allStudents = options.allStudents || []
      const allTeachers = options.allTeachers || []

      // Get existing classes from system
      const existingClasses = await this.getExistingClasses(schoolPrefix)
      console.log(`${getTimestamp()} Found ${existingClasses.size} existing classes for prefix: ${schoolPrefix}`)

      // Check for existing admin teacher
      const existingAdminTeacher = await this.getExistingAdminTeacher(schoolPrefix)
      const existingAdminTeacherId = existingAdminTeacher?.id || null

      // Process each class that has users needing assignment
      const classesWithNewUsers = new Set(usersNeedingClassAssignment.map(u => u.classses))

      for (const className of classesWithNewUsers) {
        if (!className) continue

        const classItem = classes.find((c: UserData) => c.username === className)
        if (!classItem) continue

        console.log(`${getTimestamp()} Processing class: ${className}`)

        try {
          // Get all students (including newly succeeded ones) for this class
          const combinedStudents = [...allStudents]
          successfulUsers.forEach(u => {
            const existingIdx = combinedStudents.findIndex(s => s.username === u.username || s.actualUserName === u.actualUserName)
            if (existingIdx >= 0) {
              combinedStudents[existingIdx] = { ...combinedStudents[existingIdx], ...u }
            }
          })

          const groupStudents = combinedStudents
            .filter(s => s.classses === className && s.id)
            .map(s => s.id!)

          if (groupStudents.length === 0) {
            console.log(`${getTimestamp()} Skipping class ${className} - no students with IDs`)
            continue
          }

          // Check if class already exists
          const existingGroupId = existingClasses.get(className.toLowerCase())

          if (existingGroupId) {
            // Add students to existing group
            console.log(`${getTimestamp()} Adding ${groupStudents.length} students to existing class ${className}`)
            await retryWithBackoff(
              () => this.adminClient!.put('/manage/User/Group/Set', {
                groupId: existingGroupId,
                userIds: groupStudents
              }),
              { context: `Add students to group ${className}`, maxRetries: 5 }
            )

            // Also add new teachers to the existing class if any
            const combinedTeachers = [...allTeachers]
            successfulUsers.forEach(u => {
              const existingIdx = combinedTeachers.findIndex(t => t.username === u.username || t.actualUserName === u.actualUserName)
              if (existingIdx >= 0) {
                combinedTeachers[existingIdx] = { ...combinedTeachers[existingIdx], ...u }
              }
            })

            // Find teachers that belong to this class
            const newTeachers = combinedTeachers
              .filter(t => {
                if (!t.id) return false
                // Check if this teacher was in the retry list (newly succeeded)
                const wasRetried = successfulUsers.some(u =>
                  u.username === t.username || u.actualUserName === t.actualUserName
                )
                if (!wasRetried) return false

                const isAdminTeacher = t.classses?.toUpperCase() === schoolPrefix.toUpperCase()
                if (isAdminTeacher) return true
                return t.classses?.toLowerCase() === className.toLowerCase() ||
                  className.toLowerCase().startsWith(t.classses?.toLowerCase() || '')
              })
              .map(t => t.id!)

            if (newTeachers.length > 0) {
              console.log(`${getTimestamp()} Adding ${newTeachers.length} teachers to existing class ${className}`)
              try {
                // Add teachers to the class using the class update API
                await retryWithBackoff(
                  () => this.adminClient!.put('/manage/classes/teachers', {
                    groupId: existingGroupId,
                    teacherIds: newTeachers
                  }),
                  { context: `Add teachers to class ${className}`, maxRetries: 3 }
                )
                console.log(`${getTimestamp()} ✅ Added ${newTeachers.length} teachers to class ${className}`)
              } catch (teacherError: any) {
                console.error(`${getTimestamp()} ⚠ Could not add teachers to existing class (API may not support this):`, teacherError.message)
              }
            }

            console.log(`${getTimestamp()} ✅ Added students to existing class ${className}`)
          } else {
            // Create new group and class
            console.log(`${getTimestamp()} Creating new class: ${className}`)

            const createGroupResponse = await retryWithBackoff(
              () => this.adminClient!.post<SaveUserGroupResult>('/manage/user/group', {
                name: className,
                users: groupStudents
              }),
              { context: `Create group ${className}`, maxRetries: 5 }
            )

            const groupId = createGroupResponse.data.userGroup.id

            // Find teachers for this class
            const combinedTeachers = [...allTeachers]
            successfulUsers.forEach(u => {
              const existingIdx = combinedTeachers.findIndex(t => t.username === u.username || t.actualUserName === u.actualUserName)
              if (existingIdx >= 0) {
                combinedTeachers[existingIdx] = { ...combinedTeachers[existingIdx], ...u }
              }
            })

            const classTeachers = combinedTeachers
              .filter(t => {
                if (!t.id) return false
                const isAdminTeacher = t.classses.toUpperCase() === schoolPrefix.toUpperCase()
                if (isAdminTeacher) return true
                return t.classses.toLowerCase() === className.toLowerCase() ||
                  className.toLowerCase().startsWith(t.classses.toLowerCase())
              })
              .map(t => t.id!)

            // Add existing admin teacher if available
            if (existingAdminTeacherId && !classTeachers.includes(existingAdminTeacherId)) {
              classTeachers.push(existingAdminTeacherId)
            }

            // Create the class
            await retryWithBackoff(
              () => this.adminClient!.post('/manage/classes', {
                name: className,
                description: className,
                startDate: DEFAULT_CLASS_START_DATE,
                endDate: DEFAULT_CLASS_END_DATE,
                targetGroups: [groupId],
                teachers: classTeachers,
                grades: classItem.grade ? [classItem.grade] : []
              }),
              { context: `Create class ${className}`, maxRetries: 5 }
            )

            console.log(`${getTimestamp()} ✅ Created class ${className} with ${groupStudents.length} students, ${classTeachers.length} teachers`)
          }

          // Mark all users in this class as addedToClass
          usersNeedingClassAssignment
            .filter(u => u.classses === className)
            .forEach(u => {
              u.state = { ...u.state, addedToClass: true }
            })

        } catch (error: any) {
          console.error(`${getTimestamp()} ❌ Failed to process class ${className}:`, error.message)
          // Don't fail the entire retry, just log the error
        }
      }

      console.log(`${getTimestamp()} Phase 4 complete`)
    } else if (usersNeedingClassAssignment.length === 0 && successfulUsers.length > 0) {
      console.log(`\n${getTimestamp()} Phase 4: Skip (all users already added to class)`)
    }

    // ===== PHASE 5: ASSIGN TEACHER ROLE =====
    // Find all successful teachers that haven't been assigned role yet
    const successfulTeachers = successfulUsers.filter(u => {
      // Skip if already assigned role
      if (u.state?.roleAssigned) return false

      // Check if this user is a teacher by comparing with allTeachers
      if (options?.allTeachers) {
        return options.allTeachers.some(t =>
          t.username === u.username || t.actualUserName === u.actualUserName
        )
      }
      // Fallback: check if classses matches schoolPrefix (admin teacher pattern)
      if (options?.schoolPrefix && u.classses?.toUpperCase() === options.schoolPrefix.toUpperCase()) {
        return true
      }
      return false
    })

    if (successfulTeachers.length > 0) {
      console.log(`\n${getTimestamp()} ========== PHASE 5: ASSIGN TEACHER ROLE ==========`)
      console.log(`${getTimestamp()} Found ${successfulTeachers.length} teachers needing role assignment`)

      const teacherIds = successfulTeachers
        .filter(t => t.id)
        .map(t => t.id!)

      if (teacherIds.length > 0) {
        try {
          const roleSuccess = await this.assignTeachersToRole(teacherIds)
          if (roleSuccess) {
            console.log(`${getTimestamp()} ✅ Successfully assigned ${teacherIds.length} teachers to Teacher role`)
            // Mark all teachers as roleAssigned
            successfulTeachers.forEach(t => {
              t.state = { ...t.state, roleAssigned: true }
            })
          } else {
            console.error(`${getTimestamp()} ❌ Failed to assign teachers to role`)
          }
        } catch (error: any) {
          console.error(`${getTimestamp()} ❌ Error assigning teachers to role:`, error.message)
        }
      }

      console.log(`${getTimestamp()} Phase 5 complete`)
    } else {
      const alreadyAssigned = successfulUsers.filter(u => u.state?.roleAssigned).length
      if (alreadyAssigned > 0) {
        console.log(`\n${getTimestamp()} Phase 5: Skip (${alreadyAssigned} teachers already have role assigned)`)
      }
    }

    return { successfulUsers, stillFailedUsers }
  }
}
