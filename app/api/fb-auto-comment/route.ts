/**
 * API route for FB Auto Comment
 * Only handles verify access (config/comments stored in localStorage on client)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccess } from '@/lib/fb-auto-comment/facebook';
import { getLogs, clearLogs } from '@/lib/fb-auto-comment/scheduler';

// GET - Get logs
export async function GET() {
    try {
        const logs = getLogs();
        return NextResponse.json({ logs });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Actions
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, data } = body;

        switch (action) {
            case 'verifyAccess':
                const result = await verifyAccess(data.pageId, data.accessToken);
                return NextResponse.json(result);

            case 'clearLogs':
                clearLogs();
                return NextResponse.json({ success: true });

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
