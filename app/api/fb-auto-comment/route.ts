/**
 * API route for FB Auto Comment config
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig, getComments, saveComments, getLogs, clearLogs, addLog } from '@/lib/fb-auto-comment/storage';
import { verifyAccess } from '@/lib/fb-auto-comment/facebook';
import { FBConfig } from '@/lib/fb-auto-comment/types';

// GET - Fetch config and comments
export async function GET() {
    try {
        const config = getConfig();
        const comments = getComments();
        const logs = getLogs();

        return NextResponse.json({
            config,
            comments,
            logs,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Save config
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, data } = body;

        switch (action) {
            case 'saveConfig':
                const config: FBConfig = {
                    accessToken: data.accessToken,
                    pageId: data.pageId,
                    delayBetweenComments: data.delayBetweenComments || 5,
                };
                saveConfig(config);
                addLog('success', 'Đã lưu cấu hình');
                return NextResponse.json({ success: true });

            case 'saveComments':
                saveComments(data.comments || []);
                addLog('success', `Đã lưu ${data.comments?.length || 0} comments`);
                return NextResponse.json({ success: true });

            case 'verifyAccess':
                const result = await verifyAccess(data.pageId, data.accessToken);
                if (result.success) {
                    addLog('success', `Kết nối thành công với Page: ${result.pageName}`);
                } else {
                    addLog('error', `Lỗi kết nối: ${result.error}`);
                }
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
