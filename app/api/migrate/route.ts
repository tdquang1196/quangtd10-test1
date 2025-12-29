import { NextRequest, NextResponse } from 'next/server'
import { MigrationService } from '@/lib/migrationService'
import { setActiveMigrationService } from '@/lib/migrationState'

interface UserData {
  username: string
  displayName: string
  password: string
  classses: string
  phoneNumber: string
  grade?: number
  age?: number // Calculated from birth date
}

interface MigrationRequest {
  ListDataStudent: UserData[]
  ListDataTeacher: UserData[]
  ListDataClasses: UserData[]
}

export async function POST(request: NextRequest) {
  try {
    const body: MigrationRequest = await request.json()

    // Validate environment variables
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    const adminUsername = process.env.ADMIN_USERNAME
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!apiUrl) {
      return NextResponse.json(
        { error: 'API URL not configured' },
        { status: 500 }
      )
    }

    // Extract auth token from request header
    const authHeader = request.headers.get('authorization')
    const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined

    if (!authToken && (!adminUsername || !adminPassword)) {
      return NextResponse.json(
        { error: 'Authentication required. Please provide Authorization header or configure Admin credentials.' },
        { status: 401 }
      )
    }

    // Extract grade from class name (e.g., "HYTKLTT_1A_2025" -> 1)
    const extractGrade = (className: string): number => {
      const match = className.match(/_(\d+)[A-Z]_/)
      return match ? parseInt(match[1]) : 0
    }

    // Add grade to classes
    const classesWithGrade = body.ListDataClasses.map(c => ({
      ...c,
      grade: extractGrade(c.classses)
    }))

    // Initialize migration service
    const migrationService = new MigrationService(
      apiUrl,
      adminUsername || '',
      adminPassword || '',
      authToken
    )

    // Store reference for pause/resume/cancel control
    setActiveMigrationService(migrationService)

    // Execute migration
    console.log('Starting migration...')
    console.log(`Students: ${body.ListDataStudent.length}`)
    console.log(`Teachers: ${body.ListDataTeacher.length}`)
    console.log(`Classes: ${body.ListDataClasses.length}`)

    const result = await migrationService.migrate(
      body.ListDataStudent,
      body.ListDataTeacher,
      classesWithGrade
    )

    console.log('Migration completed')
    console.log(`Success: ${result.listDataStudent.length - result.listUserError.length} users`)
    console.log(`Failed: ${result.listUserError.length} users`)
    console.log(`Class errors: ${result.listClassError.length}`)

    // Transform to PascalCase for frontend compatibility
    const response = {
      ListDataStudent: result.listDataStudent,
      ListDataTeacher: result.listDataTeacher,
      ListDataClasses: result.listDataClasses,
      ListUserError: result.listUserError,
      ListClassError: result.listClassError,
      roleAssignmentError: result.roleAssignmentError,
      migrationStatus: migrationService.status,
    }

    // Clear the active migration service reference
    setActiveMigrationService(null)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Migration API error:', error)

    // Clear the active migration service reference on error
    setActiveMigrationService(null)

    return NextResponse.json(
      {
        error: 'Migration failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

// Increase timeout for migration operations (10 minutes)
export const maxDuration = 300
