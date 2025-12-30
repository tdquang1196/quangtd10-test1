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

        // Return config with masked token for display
        // But include a flag indicating token exists
        const responseConfig = {
            ...config,
            // Mask the token for display security
            access_token: config.access_token
                ? `${config.access_token.substring(0, 10)}...${config.access_token.slice(-10)}`
                : '',
            // Flag to indicate if real token exists
            has_access_token: !!config.access_token && config.access_token.length > 50
        };

        return NextResponse.json(responseConfig);
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

        // Only update access_token if it's a NEW token (not the masked one)
        // Masked tokens contain "..." and are shorter than real tokens
        if (accessToken !== undefined) {
            const isMaskedToken = accessToken.includes('...') && accessToken.length < 50;
            if (!isMaskedToken && accessToken.length > 0) {
                updates.access_token = accessToken;
            }
            // If masked or empty, don't update (keep existing token)
        }

        if (pageId !== undefined) updates.page_id = pageId;
        if (delayBetweenComments !== undefined) updates.delay_between_comments = delayBetweenComments;
        if (intervalMinutes !== undefined) updates.interval_minutes = intervalMinutes;
        if (comments !== undefined) updates.comments = comments;

        // Only update if there are changes
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: true, message: 'No changes to save' });
        }

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
