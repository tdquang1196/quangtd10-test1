/**
 * API: POST /api/fb-scheduler/toggle
 * Toggle scheduler on/off
 */

import { NextRequest, NextResponse } from 'next/server';
import { toggleScheduler, getSchedulerStatus, getSchedulerConfig, addLog } from '@/lib/fb-auto-comment/config-service';

// POST - Toggle scheduler
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { enabled } = body;

        if (typeof enabled !== 'boolean') {
            return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
        }

        // Validate config before enabling
        if (enabled) {
            const config = await getSchedulerConfig();
            if (!config?.access_token || !config?.page_id) {
                return NextResponse.json({
                    error: 'Cannot enable scheduler: Missing access token or page ID'
                }, { status: 400 });
            }
            if (!config.comments || config.comments.length === 0) {
                return NextResponse.json({
                    error: 'Cannot enable scheduler: No comments configured'
                }, { status: 400 });
            }
        }

        const success = await toggleScheduler(enabled);

        if (!success) {
            return NextResponse.json({ error: 'Failed to toggle scheduler' }, { status: 500 });
        }

        // Log the action
        await addLog('info', enabled ? 'Scheduler enabled' : 'Scheduler disabled');

        const status = await getSchedulerStatus();
        return NextResponse.json({ success: true, status });
    } catch (error: any) {
        console.error('[API:toggle] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
