import axios, { AxiosInstance } from 'axios'

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
}

interface LoginResult {
  AccessToken: string
  UserId: string
  DisplayName: string
}

interface GetUsersResult {
  Users: Array<{
    Username: string
    DisplayName: string
  }>
}

interface SaveUserGroupResult {
  UserGroup: {
    Id: string
  }
}

interface MigrationResult {
  ListDataStudent: UserData[]
  ListDataTeacher: UserData[]
  ListDataClasses: UserData[]
  ListUserError: UserData[]
  ListClassError: UserData[]
}

const MIN_LENGTH_DISPLAY_NAME = 2
const MAX_LENGTH_DISPLAY_NAME = 20

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

  private async loginAdmin(): Promise<void> {
    const response = await axios.post<LoginResult>(`${this.baseUrl}/auth/login`, {
      username: this.adminUsername,
      password: this.adminPassword
    })

    this.adminToken = response.data.AccessToken

    this.adminClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.adminToken}`
      }
    })
  }

  private async getExistingUsernames(filter: string): Promise<Set<string>> {
    try {
      const response = await this.adminClient!.get<GetUsersResult>(
        `/manage/Users?pageIndex=1&pageSize=1000&filter=${filter}`
      )
      return new Set(
        response.data.Users
          .filter(u => u.Username.toLowerCase().startsWith(filter.toLowerCase()))
          .map(u => u.Username.toLowerCase())
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
        response.data.Users
          .filter(u => u.DisplayName.toLowerCase().startsWith(filter.toLowerCase()))
          .map(u => u.DisplayName.toLowerCase())
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
    let isSubstringUserName = false

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
          } else if (isUpdateToUserName && !isSubstringUserName) {
            displayName = actualUsername.substring(0, Math.min(actualUsername.length, MAX_LENGTH_DISPLAY_NAME))
            isSubstringUserName = true
            idx = 0
          } else {
            return loginDisplayName
          }
        } else if (content.includes('true') || response.data === true) {
          return tryDisplayName
        }
      } catch (error) {
        return null
      }
    }
  }

  private async setEquipmentAndProfile(
    client: AxiosInstance,
    displayName: string
  ): Promise<boolean> {
    try {
      // Note: Equipment items would need to be fetched from backend
      // For now, we'll skip equipment assignment as it requires fetching item catalog
      // In production, you'd fetch items first and select random ones

      await client.post('/account/equipment', {
        listItem: [], // Empty for now - would need real equipment IDs
        displayName: displayName
      })
      return true
    } catch (error) {
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

  private async processUser(user: UserData, listUserError: UserData[]): Promise<void> {
    console.log(`Processing user: ${user.username}`)

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

    // Login as user
    const loginResult = await this.loginUser(user.actualUserName, user.password)
    if (!loginResult) {
      user.reason = 'Login failed'
      listUserError.push({ ...user })
      return
    }

    user.id = loginResult.UserId

    const userClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${loginResult.AccessToken}`
      }
    })

    // Check and validate display name
    const existingDisplayNames = await this.getExistingDisplayNames(user.displayName)

    let tempDisplayIdx = 0
    let baseDisplayName = user.displayName
    let isUpdateToUserName = false
    let isSubstringDisplayName = false
    let isSubstringUserName = false

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
        } else if (isUpdateToUserName && !isSubstringUserName) {
          baseDisplayName = user.actualUserName.substring(0, Math.min(user.actualUserName.length, MAX_LENGTH_DISPLAY_NAME))
          isSubstringUserName = true
          tempDisplayIdx = 0
        } else {
          user.reason = 'Cannot find valid display name'
          listUserError.push({ ...user })
          return
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
      loginResult.DisplayName
    )

    if (!validatedDisplayName) {
      user.reason = 'Display name validation failed'
      listUserError.push({ ...user })
      return
    }

    user.actualDisplayName = validatedDisplayName

    // Set equipment and profile
    await this.setEquipmentAndProfile(userClient, user.actualDisplayName)

    // Update phone number
    await this.updatePhoneNumber(userClient, user.phoneNumber)
  }

  public async migrate(
    students: UserData[],
    teachers: UserData[],
    classes: UserData[]
  ): Promise<MigrationResult> {
    // Login as admin
    await this.loginAdmin()

    const listUserError: UserData[] = []
    const listClassError: UserData[] = []

    // Process students
    console.log(`Processing ${students.length} students...`)
    for (const student of students) {
      await this.processUser(student, listUserError)
    }

    // Process teachers
    console.log(`Processing ${teachers.length} teachers...`)
    for (const teacher of teachers) {
      await this.processUser(teacher, listUserError)
    }

    // Process classes
    console.log(`Processing ${classes.length} classes...`)
    for (const classItem of classes) {
      try {
        // Create user group
        const groupStudents = students
          .filter(s => s.classses === classItem.username && s.id)
          .map(s => s.id)

        if (groupStudents.length === 0) {
          continue
        }

        const createGroupResponse = await this.adminClient!.post<SaveUserGroupResult>('/manage/user/group', {
          name: classItem.username,
          users: groupStudents
        })

        const groupId = createGroupResponse.data.UserGroup.Id

        // Create class
        const classTeachers = teachers
          .filter(t =>
            (t.classses.toLowerCase() === classItem.username.toLowerCase() ||
             classItem.username.toLowerCase().startsWith(t.classses.toLowerCase())) &&
            t.id
          )
          .map(t => t.id)

        await this.adminClient!.post('/manage/classes', {
          name: classItem.username,
          description: classItem.username,
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2026-04-01T00:00:00.000Z',
          targetGroups: [groupId],
          teachers: classTeachers,
          grades: classItem.grade ? [classItem.grade] : []
        })
      } catch (error) {
        console.error(`Failed to create class ${classItem.username}:`, error)
        listClassError.push({ ...classItem })
      }
    }

    return {
      ListDataStudent: students,
      ListDataTeacher: teachers,
      ListDataClasses: classes,
      ListUserError: listUserError,
      ListClassError: listClassError
    }
  }
}
