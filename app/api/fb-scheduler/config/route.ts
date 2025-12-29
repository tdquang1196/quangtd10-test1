/**
 * API: GET/POST /api/fb-scheduler/config
 * Manage scheduler configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSchedulerConfig, updateSchedulerConfig } from '@/lib/fb-auto-comment/config-service';

// GET - Get current config
export async function GET() {
    try {
        const config = await getSchedulerConfig();

        if (!config) {
            return NextResponse.json({ error: 'Config not found' }, { status: 404 });
        }

        // Don't expose access token fully (mask it)
        const maskedConfig = {
            ...config,
            access_token: config.access_token
                ? `${config.access_token.substring(0, 10)}...${config.access_token.slice(-10)}`
                : ''
        };

        return NextResponse.json(maskedConfig);
    } catch (error: any) {
        console.error('[API:config] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Update config
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accessToken, pageId, delayBetweenComments, intervalMinutes, comments } = body;

        const updates: any = {};

        if (accessToken !== undefined) updates.access_token = accessToken;
        if (pageId !== undefined) updates.page_id = pageId;
        if (delayBetweenComments !== undefined) updates.delay_between_comments = delayBetweenComments;
        if (intervalMinutes !== undefined) updates.interval_minutes = intervalMinutes;
        if (comments !== undefined) updates.comments = comments;

        const success = await updateSchedulerConfig(updates);

        if (!success) {
            return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Config updated' });
    } catch (error: any) {
        console.error('[API:config] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
