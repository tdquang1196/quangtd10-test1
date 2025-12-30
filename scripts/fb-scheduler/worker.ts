/**
 * FB Auto-Comment Background Worker
 * 
 * This worker runs continuously and checks Supabase every minute.
 * When it's time to run (enabled && now >= nextRunAt), it executes auto-comment.
 * After completion, it schedules the next run.
 * 
 * Deploy to Railway for 24/7 operation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ==================== CONFIG ====================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ==================== TYPES ====================

interface SchedulerConfig {
    id: string;
    enabled: boolean;
    access_token: string;
    page_id: string;
    delay_between_comments: number;
    interval_minutes: number;
    comments: string[];
    next_run_at: string | null;
    last_run_at: string | null;
}

interface ScanState {
    id: string;
    last_processed_post_time: string | null;
    total_posts_processed: number;
    comment_tracking: Record<string, string[]>;
}

interface FBPost {
    id: string;
    message?: string;
    created_time: string;
    privacy?: {
        value: string;
    };
}

// Facebook API response types
interface FBApiResponse {
    data?: FBPost[];
    error?: {
        message: string;
    };
}

interface FBCommentsResponse {
    data?: Array<{ id: string; message?: string; from?: any }>;
    error?: {
        message: string;
    };
}

interface FBPostCommentResponse {
    id?: string;
    error?: {
        message: string;
    };
}

// ==================== LOGGING ====================

async function log(type: 'info' | 'success' | 'warning' | 'error', message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);

    try {
        await supabase.from('fb_scheduler_logs').insert({ type, message });
    } catch (error) {
        console.error('Failed to write log to database:', error);
    }
}

// ==================== DATABASE OPERATIONS ====================

async function getConfig(): Promise<SchedulerConfig | null> {
    const { data, error } = await supabase
        .from('fb_scheduler_config')
        .select('*')
        .single();

    if (error) {
        console.error('Error getting config:', error);
        return null;
    }
    return data;
}

async function getScanState(): Promise<ScanState | null> {
    const { data, error } = await supabase
        .from('fb_scan_state')
        .select('*')
        .single();

    if (error) {
        console.error('Error getting scan state:', error);
        return null;
    }
    return data;
}

async function updateConfig(id: string, updates: Partial<SchedulerConfig>): Promise<boolean> {
    const { error } = await supabase
        .from('fb_scheduler_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

    return !error;
}

async function updateScanState(id: string, updates: Partial<ScanState>): Promise<boolean> {
    const { error } = await supabase
        .from('fb_scan_state')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

    return !error;
}

// ==================== FACEBOOK API ====================

const FB_GRAPH_API = 'https://graph.facebook.com/v18.0';

async function getPagePosts(pageId: string, accessToken: string, limit: number = 50): Promise<FBPost[]> {
    try {
        const url = `${FB_GRAPH_API}/${pageId}/feed?fields=id,message,created_time,privacy&limit=${limit}&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json() as FBApiResponse;

        if (data.error) {
            throw new Error(data.error.message);
        }

        return data.data || [];
    } catch (error) {
        await log('error', `Failed to get page posts: ${error}`);
        return [];
    }
}

async function getPageCommentsOnPost(postId: string, accessToken: string): Promise<any[]> {
    try {
        const url = `${FB_GRAPH_API}/${postId}/comments?fields=id,message,from&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json() as FBCommentsResponse;

        if (data.error) {
            throw new Error(data.error.message);
        }

        return data.data || [];
    } catch (error) {
        await log('error', `Failed to get comments for post ${postId}: ${error}`);
        return [];
    }
}

async function postComment(postId: string, message: string, accessToken: string): Promise<boolean> {
    try {
        const url = `${FB_GRAPH_API}/${postId}/comments`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, access_token: accessToken })
        });
        const data = await response.json() as FBPostCommentResponse;

        if (data.error) {
            throw new Error(data.error.message);
        }

        return !!data.id;
    } catch (error) {
        await log('error', `Failed to post comment on ${postId}: ${error}`);
        return false;
    }
}

// ==================== AUTO-COMMENT LOGIC ====================

function getFirstNWords(text: string, n: number = 10): string {
    return text.split(/\s+/).slice(0, n).join(' ').toLowerCase();
}

function isAlreadyCommented(
    postId: string,
    message: string,
    commentTracking: Record<string, string[]>
): boolean {
    const commented = commentTracking[postId] || [];
    const firstWords = getFirstNWords(message);
    return commented.some(c => c.includes(firstWords) || firstWords.includes(c));
}

async function runAutoComment(config: SchedulerConfig, scanState: ScanState): Promise<void> {
    await log('info', '🚀 Starting auto-comment run...');

    const { access_token, page_id, delay_between_comments, comments } = config;
    const commentTracking = { ...scanState.comment_tracking };

    // Get page posts
    const posts = await getPagePosts(page_id, access_token);
    await log('info', `Found ${posts.length} posts to check`);

    let commentsPosted = 0;
    let commentsSkipped = 0;
    let postsProcessed = 0;

    for (const post of posts) {
        // Skip private posts
        if (post.privacy?.value === 'SELF') {
            await log('info', `🔒 Skipping private post: ${post.id}`);
            continue;
        }

        // Skip if no message
        if (!post.message) {
            continue;
        }

        postsProcessed++;
        const postPreview = post.message.substring(0, 50) + (post.message.length > 50 ? '...' : '');
        await log('info', `📄 [${postsProcessed}/${posts.length}] Post ${post.id}: ${postPreview}`);

        // Get existing comments on this post from Facebook
        const existingComments = await getPageCommentsOnPost(post.id, access_token);

        // Sync existing comments to tracking
        for (const ec of existingComments) {
            if (!commentTracking[post.id]) commentTracking[post.id] = [];
            const prefix = getFirstNWords(ec.message || '');
            if (!commentTracking[post.id].includes(prefix)) {
                commentTracking[post.id].push(prefix);
            }
        }

        // Loop through ALL comments (like web version)
        for (let cmtIndex = 0; cmtIndex < comments.length; cmtIndex++) {
            const commentText = comments[cmtIndex];
            const commentPreview = commentText.substring(0, 40) + (commentText.length > 40 ? '...' : '');

            // Check if already commented
            if (isAlreadyCommented(post.id, commentText, commentTracking)) {
                commentsSkipped++;
                continue;
            }

            // Double-check on Facebook before posting
            const freshComments = await getPageCommentsOnPost(post.id, access_token);
            const alreadyOnFB = freshComments.some(c =>
                getFirstNWords(c.message || '') === getFirstNWords(commentText)
            );

            if (alreadyOnFB) {
                commentsSkipped++;
                // Update tracking
                if (!commentTracking[post.id]) commentTracking[post.id] = [];
                commentTracking[post.id].push(getFirstNWords(commentText));
                await log('info', `⏭️ Comment đã có trên Facebook: "${commentPreview}"`);
                continue;
            }

            // Post the comment
            await log('info', `💬 [Comment ${cmtIndex + 1}/${comments.length}] Đang post: "${commentPreview}"`);
            const success = await postComment(post.id, commentText, access_token);

            if (success) {
                commentsPosted++;
                await log('success', `✅ Posted comment ${cmtIndex + 1} on post ${post.id}`);

                // Update tracking
                if (!commentTracking[post.id]) commentTracking[post.id] = [];
                commentTracking[post.id].push(getFirstNWords(commentText));

                // Delay between comments
                if (delay_between_comments > 0) {
                    await log('info', `⏳ Waiting ${delay_between_comments}s...`);
                    await new Promise(r => setTimeout(r, delay_between_comments * 1000));
                }
            }
        }
    }

    // Update scan state
    await updateScanState(scanState.id, {
        comment_tracking: commentTracking,
        total_posts_processed: scanState.total_posts_processed + postsProcessed,
        last_processed_post_time: posts[0]?.created_time || scanState.last_processed_post_time
    });

    await log('success', `🎉 Run completed: ${commentsPosted} posted, ${commentsSkipped} skipped, ${postsProcessed} posts processed`);
}

// ==================== MAIN LOOP ====================

// Flag to prevent concurrent runs
let isRunning = false;

async function checkAndRun(): Promise<void> {
    // Prevent concurrent runs
    if (isRunning) {
        console.log('⏸️ Previous run still in progress, skipping...');
        return;
    }

    const config = await getConfig();

    if (!config) {
        console.log('⚠️ No config found');
        return;
    }

    if (!config.enabled) {
        return; // Silently skip if disabled
    }

    // Check if it's time to run
    const now = new Date();
    const nextRunAt = config.next_run_at ? new Date(config.next_run_at) : null;

    if (!nextRunAt || now < nextRunAt) {
        const timeUntil = nextRunAt
            ? Math.round((nextRunAt.getTime() - now.getTime()) / 1000 / 60)
            : '?';
        console.log(`⏳ Next run in ${timeUntil} minutes`);
        return;
    }

    // Time to run! Set flag
    isRunning = true;

    const scanState = await getScanState();
    if (!scanState) {
        await log('error', 'No scan state found');
        isRunning = false;
        return;
    }

    try {
        await runAutoComment(config, scanState);
    } catch (error) {
        await log('error', `Auto-comment failed: ${error}`);
    }

    // Schedule next run (now + interval)
    const nextRun = new Date(Date.now() + config.interval_minutes * 60 * 1000);
    await updateConfig(config.id, {
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun.toISOString()
    });

    await log('info', `📅 Next run scheduled at: ${nextRun.toISOString()}`);

    // Clear flag
    isRunning = false;
}

// ==================== STARTUP ====================

async function main(): Promise<void> {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   FB Auto-Comment Worker Started           ║');
    console.log('║   Checking every 1 minute...               ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    await log('info', '🔄 Worker started');

    // Initial check
    await checkAndRun();

    // Schedule periodic checks
    setInterval(checkAndRun, CHECK_INTERVAL_MS);
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    await log('info', '🛑 Worker shutting down');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    await log('info', '🛑 Worker shutting down');
    process.exit(0);
});

// Start the worker
main().catch(console.error);
