import axios, { AxiosInstance } from 'axios'
import { getRandomEquipmentSet } from '@/config/equipment'
import fs from 'fs'
import path from 'path'

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
  accessToken?: string // Store access token from registration to avoid re-login
  loginDisplayName?: string // Store login display name from Phase 1 for fallback in Phase 2
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
}

const MIN_LENGTH_DISPLAY_NAME = 2
const MAX_LENGTH_DISPLAY_NAME = 20

// Batch processing configuration
// Note: Registration runs sequentially (1 thread) to avoid server spam prevention
const INIT_BATCH_SIZE = 5 // Number of users to initialize concurrently in Phase 2
const MAX_CONCURRENT_GROUPS = 5 // Maximum number of display name groups to process in parallel

export class MigrationService {
  private baseUrl: string
  private adminUsername: string
  private adminPassword: string
  private adminClient?: AxiosInstance
  private adminToken?: string

  constructor(baseUrl: string, adminUsername: string, adminPassword: string) {
    this.baseUrl = baseUrl
    this.adminUsername = adminUsername
    this.adminPassword = adminPassword
  }

  /**
   * Group users by their base username to prevent parallel conflicts
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
   * Split an array into batches of specified size
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  private async loginAdmin(): Promise<void> {
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
    try {
      const response = await axios.post<LoginResult>(`${this.baseUrl}/auth/login`, {
        username,
        password
      })
      return response.data
    } catch (error) {
      return null
    }
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

  private async setEquipmentAndProfile(
    client: AxiosInstance,
    displayName: string
  ): Promise<boolean> {
    try {
      // Get random equipment set (HEAD, UPPER_BODY, LOWER_BODY, FOOT)
      const listItem = getRandomEquipmentSet()

      await client.post('/account/equipment', {
        listItem: listItem,
        displayName: displayName
      })
      return true
    } catch (error) {
      console.error('Equipment assignment error:', error)
      return false
    }
  }

  private async updatePhoneNumber(
    client: AxiosInstance,
    phoneNumber: string
  ): Promise<boolean> {
    try {
      if (!phoneNumber) return true

      const cleanPhone = phoneNumber.replace(/\D/g, '')
      if (!cleanPhone) return true

      await client.put('/account/users/update-phone-number', {
        phoneNumber: cleanPhone
      })
      return true
    } catch (error) {
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

    // Set equipment and profile (continue even if this fails)
    try {
      await this.setEquipmentAndProfile(userClient, user.actualDisplayName)
    } catch (error) {
      console.error('Equipment setup failed, continuing with phone number update:', error)
    }

    // Always update phone number (even if display name validation or equipment failed)
    try {
      await this.updatePhoneNumber(userClient, user.phoneNumber)
    } catch (error) {
      console.error('Phone number update failed:', error)
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

  public async migrate(
    students: UserData[],
    teachers: UserData[],
    classes: UserData[]
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    const getTimestamp = () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const now = new Date().toLocaleTimeString('en-US', { hour12: false })
      return `[${now}] [+${elapsed}s]`
    }

    // Login as admin
    await this.loginAdmin()

    // Extract school prefix from first class name (format: SCHOOLPREFIX_GRADE_YEAR)
    const schoolPrefix = classes.length > 0 ? classes[0].username.split('_')[0] : ''

    // Fetch existing classes
    console.log(`${getTimestamp()} Fetching existing classes for prefix: ${schoolPrefix}...`)
    const existingClasses = await this.getExistingClasses(schoolPrefix)
    console.log(`${getTimestamp()} Found ${existingClasses.size} existing classes`)

    // Check if admin teacher needs to be fetched
    const hasAdminTeacherInList = teachers.some(t => t.classses.toUpperCase() === schoolPrefix.toUpperCase())
    let existingAdminTeacherId: string | null = null

    if (!hasAdminTeacherInList) {
      console.log(`${getTimestamp()} Admin teacher not in create list, checking if one exists...`)
      const existingAdminTeacher = await this.getExistingAdminTeacher(schoolPrefix)
      if (existingAdminTeacher) {
        existingAdminTeacherId = existingAdminTeacher.id
        console.log(`${getTimestamp()} Will add existing admin teacher ${existingAdminTeacher.username} to all new classes`)
      } else {
        console.log(`${getTimestamp()} No existing admin teacher found`)
      }
    }

    const listUserError: UserData[] = []
    const listClassError: UserData[] = []

    // Filter teachers - only keep teachers for NEW classes (classes that don't exist yet)
    // BUT always keep the admin teacher (the one with className === schoolPrefix.toUpperCase())
    const teachersToCreate = teachers.filter(teacher => {
      // Check if this is the admin teacher (general teacher for all classes)
      const isAdminTeacher = teacher.classses.toUpperCase() === schoolPrefix.toUpperCase()

      if (isAdminTeacher) {
        return true // Always include admin teacher
      }

      // Check if teacher's class already exists
      const classExists = existingClasses.has(teacher.classses.toLowerCase())
      if (classExists) {
        console.log(`${getTimestamp()} Skipping teacher ${teacher.username} - class ${teacher.classses} already exists`)
      }
      return !classExists
    })

    console.log(`${getTimestamp()} Teachers to create: ${teachersToCreate.length} (skipped ${teachers.length - teachersToCreate.length} for existing classes)`)

    // Preserve original order from Excel file by adding index
    students.forEach((student, index) => {
      (student as any).originalIndex = index
    })
    teachersToCreate.forEach((teacher, index) => {
      (teacher as any).originalIndex = students.length + index
    })

    // ===== PHASE 1: USER REGISTRATION (Sequential - to avoid spam prevention) =====
    console.log(`\n${getTimestamp()} ========== PHASE 1: USER REGISTRATION (Sequential) ==========`)
    const allUsers = [...students, ...teachersToCreate]
    console.log(`${getTimestamp()} Processing ${allUsers.length} user registrations sequentially to avoid spam prevention`)

    let processedRegistrations = 0
    // Process users one by one sequentially
    for (const user of allUsers) {
      await this.registerUserAccount(user, listUserError)
      processedRegistrations++
      console.log(`${getTimestamp()} [Registration] ${processedRegistrations}/${allUsers.length} - Registered: ${user.actualUserName || user.username}`)
    }

    console.log(`${getTimestamp()} Phase 1 complete: ${processedRegistrations} registrations processed, ${listUserError.length} failed`)

    // ===== PHASE 2: CHARACTER INITIALIZATION (Grouped by Display Name) =====
    console.log(`\n${getTimestamp()} ========== PHASE 2: CHARACTER INITIALIZATION ==========`)

    // Only initialize characters for successfully registered users
    const successfullyRegistered = allUsers.filter(u => u.actualUserName && !listUserError.some(err => err.username === u.username))
    console.log(`${getTimestamp()} ${successfullyRegistered.length} users successfully registered, proceeding to character initialization`)

    // Group by display name to prevent conflicts
    const displayNameGroups = this.groupByDisplayName(successfullyRegistered)
    console.log(`${getTimestamp()} Grouped ${successfullyRegistered.length} users into ${displayNameGroups.size} display name groups`)

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
          await this.initializeUserCharacter(user, listUserError)
          processedInits++
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

    console.log(`${getTimestamp()} Phase 2 complete: ${processedInits} characters initialized`)

    // Restore original order from Excel file
    students.sort((a, b) => ((a as any).originalIndex || 0) - ((b as any).originalIndex || 0))
    teachersToCreate.sort((a, b) => ((a as any).originalIndex || 0) - ((b as any).originalIndex || 0))

    // Process classes
    console.log(`${getTimestamp()} Processing ${classes.length} classes...`)
    for (let i = 0; i < classes.length; i++) {
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

          await this.adminClient!.put('/manage/User/Group/Set', {
            groupId: existingGroupId,
            userIds: groupStudents
          })

          console.log(`${getTimestamp()} [${i + 1}/${classes.length}] ✅ Added ${groupStudents.length} students to existing class ${classItem.username} (teachers not created)`)
        } else {
          // Class doesn't exist - create new class and group with teachers
          console.log(`${getTimestamp()} [${i + 1}/${classes.length}] Creating new class: ${classItem.username}`)

          const createGroupResponse = await this.adminClient!.post<SaveUserGroupResult>('/manage/user/group', {
            name: classItem.username,
            users: groupStudents
          })

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

          await this.adminClient!.post('/manage/classes', {
            name: classItem.username,
            description: classItem.username,
            startDate: '2025-01-01T00:00:00.000Z',
            endDate: '2026-04-01T00:00:00.000Z',
            targetGroups: [groupId],
            teachers: classTeachers,
            grades: classItem.grade ? [classItem.grade] : []
          })

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
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`${getTimestamp()} Migration completed in ${totalTime}s`)
    console.log(`${getTimestamp()} Success: ${students.length + teachersToCreate.length - listUserError.length} users (${students.length} students, ${teachersToCreate.length} teachers)`)
    console.log(`${getTimestamp()} Failed: ${listUserError.length} users`)
    console.log(`${getTimestamp()} Teachers skipped (existing classes): ${teachers.length - teachersToCreate.length}`)
    console.log(`${getTimestamp()} Class errors: ${listClassError.length}`)

    // Log JSON data for students
    console.log(`\n${getTimestamp()} === STUDENTS JSON DATA ===`)
    console.log(JSON.stringify(students, null, 2))

    // Log JSON data for teachers (only those created)
    console.log(`\n${getTimestamp()} === TEACHERS JSON DATA (Created) ===`)
    console.log(JSON.stringify(teachersToCreate, null, 2))

    // Log JSON data for classes
    console.log(`\n${getTimestamp()} === CLASSES JSON DATA ===`)
    console.log(JSON.stringify(classes, null, 2))

    // Log JSON data for errors
    if (listUserError.length > 0) {
      console.log(`\n${getTimestamp()} === USER ERRORS JSON DATA ===`)
      console.log(JSON.stringify(listUserError, null, 2))
    }

    if (listClassError.length > 0) {
      console.log(`\n${getTimestamp()} === CLASS ERRORS JSON DATA ===`)
      console.log(JSON.stringify(listClassError, null, 2))
    }

    // Write results to file
    const filepath = this.writeResultsToFile(students, teachersToCreate, classes, listUserError, listClassError)
    if (filepath) {
      console.log(`\n${getTimestamp()} Results saved to file: ${filepath}`)
    }

    return {
      listDataStudent: students,
      listDataTeacher: teachersToCreate,
      listDataClasses: classes,
      listUserError: listUserError,
      listClassError: listClassError
    }
  }
}
