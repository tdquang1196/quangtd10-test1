import { NextRequest, NextResponse } from 'next/server'
import { MigrationService } from '@/lib/migrationService'

interface TeacherData {
    id?: string
    username: string
    displayName: string
    actualUserName?: string
}

interface RetryRoleAssignmentRequest {
    teachers: TeacherData[]
}

export async function POST(request: NextRequest) {
    try {
        const body: RetryRoleAssignmentRequest = await request.json()

        // Validate environment variables
        const apiUrl = process.env.NEXT_PUBLIC_API_URL
        const adminUsername = process.env.ADMIN_USERNAME
        const adminPassword = process.env.ADMIN_PASSWORD

        if (!apiUrl) {
            return NextResponse.json(
                { success: false, error: 'API URL not configured' },
                { status: 500 }
            )
        }

        // Extract auth token from request header
        const authHeader = request.headers.get('authorization')
        const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined

        if (!authToken && (!adminUsername || !adminPassword)) {
            return NextResponse.json(
                { success: false, error: 'Authentication required' },
                { status: 401 }
            )
        }

        // Initialize migration service
        const migrationService = new MigrationService(
            apiUrl,
            adminUsername || '',
            adminPassword || '',
            authToken
        )

        // Get teacher IDs that were successfully created
        const teacherIds = body.teachers
            .filter(t => t.id)
            .map(t => t.id!)

        if (teacherIds.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No teachers with IDs found'
            })
        }

        console.log(`Retrying role assignment for ${teacherIds.length} teachers...`)

        // Login as admin first
        await migrationService.loginAdmin()

        // Retry role assignment
        const success = await migrationService.assignTeachersToRole(teacherIds)

        if (success) {
            console.log('✅ Role assignment retry succeeded')
            return NextResponse.json({
                success: true,
                assignedCount: teacherIds.length
            })
        } else {
            console.log('❌ Role assignment retry failed')
            return NextResponse.json({
                success: false,
                error: 'Role assignment failed after retry'
            })
        }
    } catch (error) {
        console.error('Retry role assignment API error:', error)

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        )
    }
}

// Reasonable timeout for role assignment (2 minutes)
export const maxDuration = 120
