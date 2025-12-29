/**
 * API: GET /api/fb-scheduler/status
 * Get scheduler status and recent logs
 */

import { NextResponse } from 'next/server';
import { getSchedulerStatus, getLogs, getScanState } from '@/lib/fb-auto-comment/config-service';

// GET - Get scheduler status
export async function GET() {
    try {
        const [status, logs, scanState] = await Promise.all([
            getSchedulerStatus(),
            getLogs(50),
            getScanState()
        ]);

        return NextResponse.json({
            status,
            logs,
            scanState: scanState ? {
                lastProcessedPostTime: scanState.last_processed_post_time,
                totalPostsProcessed: scanState.total_posts_processed
            } : null
        });
    } catch (error: any) {
        console.error('[API:status] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
