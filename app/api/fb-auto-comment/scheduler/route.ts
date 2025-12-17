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
    getLogs,
    getFailedPosts,
    resolveFailedPost,
    clearFailedPosts,
    getPrivatePosts,
    removePrivatePost,
    clearPrivatePosts
} from '@/lib/fb-auto-comment/scheduler';
import { ScanMode, FBConfig } from '@/lib/fb-auto-comment/types';

// GET - Get scheduler status, logs, failed posts, and private posts
export async function GET() {
    try {
        const status = getSchedulerStatus();
        const isProcessRunning = getIsProcessRunning();
        const logs = getLogs();
        const failedPosts = getFailedPosts();
        const privatePosts = getPrivatePosts();
        return NextResponse.json({ status, isProcessRunning, logs, failedPosts, privatePosts });
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

            case 'resolveFailedPost':
                const { postId } = body;
                if (!postId) {
                    return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
                }
                resolveFailedPost(postId);
                return NextResponse.json({ success: true, failedPosts: getFailedPosts() });

            case 'clearFailedPosts':
                clearFailedPosts();
                return NextResponse.json({ success: true, failedPosts: [] });

            case 'removePrivatePost':
                const { postId: privatePostId } = body;
                if (!privatePostId) {
                    return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
                }
                removePrivatePost(privatePostId);
                return NextResponse.json({ success: true, privatePosts: getPrivatePosts() });

            case 'clearPrivatePosts':
                clearPrivatePosts();
                return NextResponse.json({ success: true, privatePosts: [] });

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

                // Get scan state from client
                const clientScanState = body.scanState || null;

                // Run with provided config, comments, and scan state
                const result = await runAutoComment(runMode, fbConfig, comments, clientScanState);
                return NextResponse.json({
                    success: true,
                    result,
                    scanState: result.scanState,
                    logs: getLogs(),
                    failedPosts: getFailedPosts(),
                    privatePosts: getPrivatePosts()
                });

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Increase timeout for long-running auto-comment process
// Vercel Free: max 10s, Pro: max 300s
export const maxDuration = 300; // 5 minutes
