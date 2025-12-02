import { NextRequest, NextResponse } from 'next/server'
import { MigrationService } from '@/lib/migrationService'

interface UserData {
  username: string
  displayName: string
  password: string
  classses: string
  phoneNumber: string
  grade?: number
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

    if (!adminUsername || !adminPassword) {
      return NextResponse.json(
        { error: 'Admin credentials not configured' },
        { status: 500 }
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
      adminUsername,
      adminPassword
    )

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
    console.log(`Success: ${result.ListDataStudent.length - result.ListUserError.length} users`)
    console.log(`Failed: ${result.ListUserError.length} users`)
    console.log(`Class errors: ${result.ListClassError.length}`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Migration API error:', error)

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
export const maxDuration = 600
