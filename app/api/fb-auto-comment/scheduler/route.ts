/**
 * API route for FB Auto Comment scheduler
 * Now receives config and comments from client (localStorage)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getSchedulerStatus,
    stopScheduler,
    runAutoComment,
    requestAbort,
    getIsProcessRunning,
    getLogs
} from '@/lib/fb-auto-comment/scheduler';
import { ScanMode, FBConfig } from '@/lib/fb-auto-comment/types';

// GET - Get scheduler status and logs
export async function GET() {
    try {
        const status = getSchedulerStatus();
        const isProcessRunning = getIsProcessRunning();
        const logs = getLogs();
        return NextResponse.json({ status, isProcessRunning, logs });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Control scheduler
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, scanMode, config, comments } = body;

        switch (action) {
            case 'stop':
                stopScheduler();
                requestAbort();
                return NextResponse.json({ success: true, status: getSchedulerStatus() });

            case 'abort':
                requestAbort();
                return NextResponse.json({ success: true, message: 'Abort requested' });

            case 'runOnce':
                // Validate required data from client
                if (!config || !config.accessToken || !config.pageId) {
                    return NextResponse.json({
                        success: false,
                        error: 'Missing config (accessToken, pageId)'
                    }, { status: 400 });
                }
                if (!comments || comments.length === 0) {
                    return NextResponse.json({
                        success: false,
                        error: 'No comments provided'
                    }, { status: 400 });
                }

                const runMode: ScanMode = scanMode || 'continue';
                const fbConfig: FBConfig = {
                    accessToken: config.accessToken,
                    pageId: config.pageId,
                    delayBetweenComments: config.delayBetweenComments || 5
                };

                // Run with provided config and comments
                const result = await runAutoComment(runMode, fbConfig, comments);
                return NextResponse.json({
                    success: true,
                    result,
                    logs: getLogs()
                });

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
