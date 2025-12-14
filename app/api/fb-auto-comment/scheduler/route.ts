/**
 * API route for FB Auto Comment scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getSchedulerStatus,
    startScheduler,
    stopScheduler,
    runAutoComment,
    setScanMode
} from '@/lib/fb-auto-comment/scheduler';
import { addLog, getScanState, resetScanState } from '@/lib/fb-auto-comment/storage';
import { ScanMode } from '@/lib/fb-auto-comment/types';

// GET - Get scheduler status
export async function GET() {
    try {
        const status = getSchedulerStatus();
        const scanState = getScanState();
        return NextResponse.json({ status, scanState });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Control scheduler
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, intervalSeconds, maxRuns, scanMode } = body;

        switch (action) {
            case 'start':
                const mode: ScanMode = scanMode || 'continue';
                setScanMode(mode);
                const started = startScheduler(intervalSeconds || 60, maxRuns || 0);
                if (!started) {
                    return NextResponse.json({
                        success: false,
                        error: 'Scheduler đang chạy hoặc thiếu cấu hình'
                    });
                }
                return NextResponse.json({ success: true, status: getSchedulerStatus() });

            case 'stop':
                stopScheduler();
                return NextResponse.json({ success: true, status: getSchedulerStatus() });

            case 'runOnce':
                const runMode: ScanMode = scanMode || 'continue';
                addLog('info', `🚀 Chạy thủ công (${runMode === 'full' ? 'Quét toàn bộ' : 'Quét tiếp'})`);
                const result = await runAutoComment(runMode);
                return NextResponse.json({ success: true, result, scanState: getScanState() });

            case 'resetScanState':
                resetScanState();
                addLog('info', '🔄 Đã reset trạng thái quét');
                return NextResponse.json({ success: true, scanState: getScanState() });

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
