/**
 * FB Auto-Comment Browser Worker
 * 
 * Uses Playwright for browser automation instead of direct API calls.
 * This simulates real user behavior to avoid spam detection.
 * 
 * Deploy to Railway for 24/7 operation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { FacebookBrowser, randomDelay } from './fb-browser';

// Load environment variables
dotenv.config();

// ==================== CONFIG ====================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute

// Limits to avoid detection
const MAX_COMMENTS_PER_RUN = 5; // Maximum comments per run
const MIN_DELAY_BETWEEN_POSTS = 30000; // 30 seconds minimum between posts
const MAX_DELAY_BETWEEN_POSTS = 90000; // 90 seconds maximum between posts

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ==================== TYPES ====================

interface SchedulerConfig {
    id: string;
    enabled: boolean;
    access_token: string; // Now used for cookies JSON
    page_id: string;
    delay_between_comments: number;
    interval_minutes: number;
    comments: string[];
    next_run_at: string | null;
    last_run_at: string | null;
    // New fields for browser mode
    fb_email?: string;
    fb_password?: string;
    fb_cookies?: string;
    use_browser_mode?: boolean;
}

interface ScanState {
    id: string;
    last_processed_post_time: string | null;
    total_posts_processed: number;
    comment_tracking: Record<string, string[]>;
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

// ==================== UTILITY ====================

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

// ==================== BROWSER AUTO-COMMENT LOGIC ====================

async function runBrowserAutoComment(config: SchedulerConfig, scanState: ScanState): Promise<void> {
    await log('info', '🌐 Starting BROWSER auto-comment run...');

    const { page_id, comments, fb_cookies, fb_email, fb_password } = config;
    const commentTracking = { ...scanState.comment_tracking };

    // Initialize Facebook browser
    const fbBrowser = new FacebookBrowser({
        cookies: fb_cookies,
        email: fb_email,
        password: fb_password
    });

    try {
        await fbBrowser.init();

        // Login
        const loggedIn = await fbBrowser.login();
        if (!loggedIn) {
            await log('error', '❌ Failed to login to Facebook');
            await fbBrowser.close();
            return;
        }

        await log('success', '✅ Logged in to Facebook');

        // Get page posts
        const postUrls = await fbBrowser.getPagePosts(page_id, 10);
        await log('info', `Found ${postUrls.length} posts to check`);

        let commentsPosted = 0;
        let postsProcessed = 0;

        for (const postUrl of postUrls) {
            // Check if we've reached the limit
            if (commentsPosted >= MAX_COMMENTS_PER_RUN) {
                await log('info', `⏹️ Reached max comments per run (${MAX_COMMENTS_PER_RUN})`);
                break;
            }

            postsProcessed++;
            const postId = postUrl.split('/').pop() || postUrl;

            await log('info', `📄 [${postsProcessed}/${postUrls.length}] Processing: ${postUrl.substring(0, 60)}...`);

            // Choose a random comment that hasn't been posted yet
            const unpostedComments = comments.filter(c => !isAlreadyCommented(postId, c, commentTracking));

            if (unpostedComments.length === 0) {
                await log('info', `⏭️ All comments already posted on this post`);
                continue;
            }

            // Pick a random comment
            const commentText = unpostedComments[Math.floor(Math.random() * unpostedComments.length)];
            const commentPreview = commentText.substring(0, 50) + (commentText.length > 50 ? '...' : '');

            await log('info', `💬 Posting: "${commentPreview}"`);

            // Post the comment
            const result = await fbBrowser.commentOnPost(postUrl, commentText);

            if (result.success) {
                commentsPosted++;
                await log('success', `✅ Comment posted successfully!`);

                // Update tracking
                if (!commentTracking[postId]) commentTracking[postId] = [];
                commentTracking[postId].push(getFirstNWords(commentText));
            } else {
                await log('warning', `⚠️ Failed to post comment: ${result.error}`);
            }

            // Random delay between posts (30-90 seconds)
            if (postsProcessed < postUrls.length && commentsPosted < MAX_COMMENTS_PER_RUN) {
                const delayMs = MIN_DELAY_BETWEEN_POSTS + Math.random() * (MAX_DELAY_BETWEEN_POSTS - MIN_DELAY_BETWEEN_POSTS);
                await log('info', `⏳ Waiting ${Math.round(delayMs / 1000)}s before next post...`);
                await randomDelay(delayMs, delayMs + 1000);
            }
        }

        // Export new cookies for future sessions
        try {
            const newCookies = await fbBrowser.exportCookies();
            await updateConfig(config.id, { fb_cookies: newCookies });
            await log('info', '🍪 Cookies updated for next session');
        } catch (e) {
            // Ignore cookie export errors
        }

        // Update scan state
        await updateScanState(scanState.id, {
            comment_tracking: commentTracking,
            total_posts_processed: scanState.total_posts_processed + postsProcessed
        });

        await log('success', `🎉 Browser run completed: ${commentsPosted} comments posted on ${postsProcessed} posts`);

    } catch (error) {
        await log('error', `Browser auto-comment error: ${error}`);
        // Take screenshot for debugging
        try {
            await fbBrowser.screenshot(`/tmp/error-${Date.now()}.png`);
        } catch (e) {
            // Ignore screenshot errors
        }
    } finally {
        await fbBrowser.close();
    }
}

// ==================== MAIN LOOP ====================

let isRunning = false;

async function checkAndRun(): Promise<void> {
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
        return;
    }

    // Check if browser mode is enabled
    if (!config.use_browser_mode) {
        console.log('ℹ️ Browser mode not enabled, use regular worker.ts');
        return;
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

    isRunning = true;

    const scanState = await getScanState();
    if (!scanState) {
        await log('error', 'No scan state found');
        isRunning = false;
        return;
    }

    try {
        await runBrowserAutoComment(config, scanState);
    } catch (error) {
        await log('error', `Browser auto-comment failed: ${error}`);
    }

    // Schedule next run
    const nextRun = new Date(Date.now() + config.interval_minutes * 60 * 1000);
    await updateConfig(config.id, {
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun.toISOString()
    });

    await log('info', `📅 Next run scheduled at: ${nextRun.toISOString()}`);

    isRunning = false;
}

// ==================== STARTUP ====================

async function main(): Promise<void> {
    console.log('');
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║   FB Auto-Comment BROWSER Worker Started           ║');
    console.log('║   Using Playwright for human-like behavior         ║');
    console.log('║   Checking every 1 minute...                       ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');

    await log('info', '🌐 Browser worker started');

    // Initial check
    await checkAndRun();

    // Schedule periodic checks
    setInterval(checkAndRun, CHECK_INTERVAL_MS);
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    await log('info', '🛑 Browser worker shutting down');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    await log('info', '🛑 Browser worker shutting down');
    process.exit(0);
});

// Start the worker
main().catch(console.error);
