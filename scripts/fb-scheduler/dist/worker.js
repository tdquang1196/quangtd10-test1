"use strict";
/**
 * FB Auto-Comment Background Worker
 *
 * This worker runs continuously and checks Supabase every minute.
 * When it's time to run (enabled && now >= nextRunAt), it executes auto-comment.
 * After completion, it schedules the next run.
 *
 * Deploy to Railway for 24/7 operation.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
// ==================== CONFIG ====================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_KEY);
// ==================== LOGGING ====================
async function log(type, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    try {
        await supabase.from('fb_scheduler_logs').insert({ type, message });
    }
    catch (error) {
        console.error('Failed to write log to database:', error);
    }
}
// ==================== DATABASE OPERATIONS ====================
async function getConfig() {
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
async function getScanState() {
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
async function updateConfig(id, updates) {
    const { error } = await supabase
        .from('fb_scheduler_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
    return !error;
}
async function updateScanState(id, updates) {
    const { error } = await supabase
        .from('fb_scan_state')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
    return !error;
}
// ==================== FACEBOOK API ====================
const FB_GRAPH_API = 'https://graph.facebook.com/v18.0';
async function getPagePosts(pageId, accessToken, limit = 50) {
    try {
        const url = `${FB_GRAPH_API}/${pageId}/feed?fields=id,message,created_time,privacy&limit=${limit}&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }
        return data.data || [];
    }
    catch (error) {
        await log('error', `Failed to get page posts: ${error}`);
        return [];
    }
}
async function getPageCommentsOnPost(postId, accessToken) {
    try {
        const url = `${FB_GRAPH_API}/${postId}/comments?fields=id,message,from&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }
        return data.data || [];
    }
    catch (error) {
        await log('error', `Failed to get comments for post ${postId}: ${error}`);
        return [];
    }
}
async function postComment(postId, message, accessToken) {
    try {
        const url = `${FB_GRAPH_API}/${postId}/comments`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, access_token: accessToken })
        });
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }
        return !!data.id;
    }
    catch (error) {
        await log('error', `Failed to post comment on ${postId}: ${error}`);
        return false;
    }
}
// ==================== AUTO-COMMENT LOGIC ====================
function getFirstNWords(text, n = 10) {
    return text.split(/\s+/).slice(0, n).join(' ').toLowerCase();
}
function isAlreadyCommented(postId, message, commentTracking) {
    const commented = commentTracking[postId] || [];
    const firstWords = getFirstNWords(message);
    return commented.some(c => c.includes(firstWords) || firstWords.includes(c));
}
async function runAutoComment(config, scanState) {
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
            if (!commentTracking[post.id])
                commentTracking[post.id] = [];
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
            const alreadyOnFB = freshComments.some(c => getFirstNWords(c.message || '') === getFirstNWords(commentText));
            if (alreadyOnFB) {
                commentsSkipped++;
                // Update tracking
                if (!commentTracking[post.id])
                    commentTracking[post.id] = [];
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
                if (!commentTracking[post.id])
                    commentTracking[post.id] = [];
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
async function checkAndRun() {
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
    }
    catch (error) {
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
async function main() {
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
