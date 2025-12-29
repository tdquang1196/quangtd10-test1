import { NextRequest, NextResponse } from 'next/server'
import { getActiveMigrationService } from '@/lib/migrationState'

// NOTE: setActiveMigrationService and getActiveMigrationService are now in @/lib/migrationState
// Import from there if needed in other files

/**
 * POST /api/migrate/control
 * Control the migration process (pause/resume/cancel)
 */
export async function POST(request: NextRequest) {
    try {
        const { action } = await request.json()

        if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Must be one of: pause, resume, cancel' },
                { status: 400 }
            )
        }

        const activeMigrationService = getActiveMigrationService()
        if (!activeMigrationService) {
            return NextResponse.json(
                { error: 'No active migration to control' },
                { status: 400 }
            )
        }

        switch (action) {
            case 'pause':
                activeMigrationService.pause()
                console.log('[MigrationControl] Migration paused')
                return NextResponse.json({
                    success: true,
                    status: activeMigrationService.status,
                    message: 'Migration paused'
                })

            case 'resume':
                activeMigrationService.resume()
                console.log('[MigrationControl] Migration resumed')
                return NextResponse.json({
                    success: true,
                    status: activeMigrationService.status,
                    message: 'Migration resumed'
                })

            case 'cancel':
                activeMigrationService.cancel()
                console.log('[MigrationControl] Migration cancelled')
                return NextResponse.json({
                    success: true,
                    status: activeMigrationService.status,
                    message: 'Migration cancelled. Created users/classes have been kept.'
                })

            default:
                return NextResponse.json(
                    { error: 'Unknown action' },
                    { status: 400 }
                )
        }
    } catch (error: any) {
        console.error('[MigrationControl] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to control migration' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/migrate/control
 * Get the current migration status
 */
export async function GET() {
    try {
        const activeMigrationService = getActiveMigrationService()
        if (!activeMigrationService) {
            return NextResponse.json({
                status: 'idle',
                message: 'No active migration'
            })
        }

        return NextResponse.json({
            status: activeMigrationService.status,
            message: `Migration is ${activeMigrationService.status}`
        })
    } catch (error: any) {
        console.error('[MigrationControl] Error getting status:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to get migration status' },
            { status: 500 }
        )
    }
}
