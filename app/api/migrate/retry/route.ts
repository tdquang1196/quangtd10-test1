import { NextRequest, NextResponse } from 'next/server'
import { MigrationService } from '@/lib/migrationService'

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
    accessToken?: string
    loginDisplayName?: string
    state?: {
        registered?: boolean
        loggedIn?: boolean
        equipmentSet?: boolean
        phoneUpdated?: boolean
        addedToClass?: boolean
        roleAssigned?: boolean
    }
    retryCount?: number
}

interface RetryRequest {
    failedUsers: UserData[]
    // Optional: for group/class assignment in batch mode
    schoolPrefix?: string
    classes?: UserData[]
    allStudents?: UserData[]
    allTeachers?: UserData[]
}

export async function POST(request: NextRequest) {
    try {
        const body: RetryRequest = await request.json()

        if (!body.failedUsers || body.failedUsers.length === 0) {
            return NextResponse.json(
                { error: 'No failed users provided' },
                { status: 400 }
            )
        }

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

        // Initialize migration service
        const migrationService = new MigrationService(
            apiUrl,
            adminUsername || '',
            adminPassword || '',
            authToken
        )

        console.log('Starting retry for failed users...')
        console.log(`Failed users to retry: ${body.failedUsers.length}`)
        if (body.schoolPrefix) {
            console.log(`School prefix: ${body.schoolPrefix}`)
            console.log(`Classes: ${body.classes?.length || 0}`)
        }

        // Log state of each user
        body.failedUsers.forEach((user, idx) => {
            const state = user.state || {}
            console.log(`[${idx + 1}] ${user.username}: registered=${state.registered}, loggedIn=${state.loggedIn}, actualUserName=${user.actualUserName || 'N/A'}`)
        })

        // Build options for group/class assignment
        const retryOptions = body.schoolPrefix ? {
            schoolPrefix: body.schoolPrefix,
            classes: body.classes,
            allStudents: body.allStudents,
            allTeachers: body.allTeachers
        } : undefined

        // Execute retry with options
        const result = await migrationService.retryUsers(body.failedUsers, retryOptions)

        console.log('Retry completed')
        console.log(`Success: ${result.successfulUsers.length}`)
        console.log(`Still failed: ${result.stillFailedUsers.length}`)

        return NextResponse.json({
            successfulUsers: result.successfulUsers,
            stillFailedUsers: result.stillFailedUsers
        })
    } catch (error) {
        console.error('Retry API error:', error)

        return NextResponse.json(
            {
                error: 'Retry failed',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        )
    }
}

// Increase timeout for retry operations (5 minutes)
export const maxDuration = 300
