import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

interface UserGroupDTO {
  id: string
  name: string
}

interface GetUserGroupsResult {
  groups: UserGroupDTO[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schoolPrefix, classNames } = body as { schoolPrefix: string; classNames: string[] }

    if (!schoolPrefix) {
      return NextResponse.json(
        { error: 'School prefix is required' },
        { status: 400 }
      )
    }

    // Validate environment variables
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    const adminUsername = process.env.ADMIN_USERNAME
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!apiUrl || !adminUsername || !adminPassword) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Login as admin
    const loginResponse = await axios.post(`${apiUrl}/auth/login`, {
      username: adminUsername,
      password: adminPassword
    })

    const token = loginResponse.data.accessToken

    // Fetch existing groups
    const groupsResponse = await axios.get<GetUserGroupsResult>(
      `${apiUrl}/manage/User/Group?pageSize=1000&Text=${encodeURIComponent(schoolPrefix.toUpperCase())}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    // Create a map of existing class names
    const existingClassNames = new Set(
      groupsResponse.data.groups.map(g => g.name.toLowerCase())
    )

    // Check which classes exist
    const classStatus = classNames.map(className => ({
      className,
      exists: existingClassNames.has(className.toLowerCase())
    }))

    return NextResponse.json({
      existingClasses: classStatus.filter(c => c.exists).map(c => c.className),
      newClasses: classStatus.filter(c => !c.exists).map(c => c.className),
      classStatus
    })
  } catch (error) {
    console.error('Check existing classes error:', error)

    return NextResponse.json(
      {
        error: 'Failed to check existing classes',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
