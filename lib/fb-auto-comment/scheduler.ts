/**
 * Server-side scheduler for FB Auto Comment
 * Now receives config and comments from client (no file storage)
 */

import { SchedulerStatus, AutoCommentResult, ScanMode, FBConfig } from './types';
import {
    getAllContent,
    getPageCommentsOnPost,
    postComment
} from './facebook';

// Global scheduler state (in-memory, persists as long as server runs)
let schedulerStatus: SchedulerStatus = {
    isRunning: false,
    currentRun: 0,
    maxRuns: 0,
    lastRunAt: null,
    nextRunAt: null,
};

// Process control
let abortFlag = false;
let isProcessRunning = false;

// In-memory logs (temporary, for current session)
let logsStore: LogEntry[] = [];
const MAX_LOGS = 200;

interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
}

// In-memory tracking (posts already commented in this session)
let commentedPosts: Map<string, string[]> = new Map();

// Scan state (in-memory)
let scanState = {
    lastProcessedPostTime: null as string | null,
    totalPostsProcessed: 0
};

/**
 * Add log entry (in-memory)
 */
function addLog(type: LogEntry['type'], message: string): void {
    logsStore.push({
        timestamp: new Date().toISOString(),
        type,
        message,
    });
    if (logsStore.length > MAX_LOGS) {
        logsStore = logsStore.slice(-MAX_LOGS);
    }
}

/**
 * Get logs
 */
export function getLogs(): LogEntry[] {
    return [...logsStore];
}

/**
 * Clear logs
 */
export function clearLogs(): void {
    logsStore = [];
}

/**
 * Get current scheduler status
 */
export function getSchedulerStatus(): SchedulerStatus {
    return { ...schedulerStatus };
}

/**
 * Check if process is currently running
 */
export function getIsProcessRunning(): boolean {
    return isProcessRunning;
}

/**
 * Request abort of current process
 */
export function requestAbort(): void {
    abortFlag = true;
    addLog('warning', '⚠️ Đang dừng quá trình...');
}

/**
 * Stop scheduler
 */
export function stopScheduler(): void {
    schedulerStatus.isRunning = false;
    requestAbort();
}

/**
 * Get first N words for comparison
 */
function getFirstNWords(text: string, n: number = 10): string {
    return text
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .slice(0, n)
        .join(' ');
}

/**
 * Check if already commented (in-memory tracking)
 */
function isAlreadyCommented(postId: string, message: string): boolean {
    const commented = commentedPosts.get(postId) || [];
    const messagePrefix = getFirstNWords(message, 10);
    return commented.some(m => getFirstNWords(m, 10) === messagePrefix);
}

/**
 * Mark as commented (in-memory tracking)
 */
function markAsCommented(postId: string, message: string): void {
    const commented = commentedPosts.get(postId) || [];
    commented.push(message);
    commentedPosts.set(postId, commented);
}

/**
 * Run the auto-comment process once
 * @param scanMode - 'full' to scan all posts, 'continue' to scan only new posts
 * @param config - Config from client
 * @param comments - Comments from client
 */
export async function runAutoComment(
    scanMode: ScanMode = 'continue',
    config: FBConfig,
    comments: string[]
): Promise<AutoCommentResult> {
    // Prevent multiple runs
    if (isProcessRunning) {
        addLog('warning', 'Đang có quá trình khác chạy, vui lòng đợi...');
        return {
            totalPosts: 0,
            commentsPosted: 0,
            commentsSkipped: 0,
            errors: ['Process already running'],
        };
    }

    isProcessRunning = true;
    abortFlag = false;

    const result: AutoCommentResult = {
        totalPosts: 0,
        commentsPosted: 0,
        commentsSkipped: 0,
        errors: [],
    };

    // Reset tracking for full scan
    if (scanMode === 'full') {
        addLog('info', `🔄 CHẾ ĐỘ: Quét toàn bộ từ đầu`);
        commentedPosts.clear();
        scanState = { lastProcessedPostTime: null, totalPostsProcessed: 0 };
    } else {
        if (scanState.lastProcessedPostTime) {
            addLog('info', `⏩ CHẾ ĐỘ: Quét tiếp từ ${new Date(scanState.lastProcessedPostTime).toLocaleString('vi-VN')}`);
        } else {
            addLog('info', `⏩ CHẾ ĐỘ: Quét tiếp (lần đầu)`);
        }
    }

    addLog('info', `Bắt đầu auto comment với ${comments.length} comments`);

    try {
        // Get all content
        addLog('info', 'Đang lấy danh sách posts...');
        let allContent = await getAllContent(config.pageId, config.accessToken);
        addLog('info', `Tìm thấy ${allContent.length} posts/videos tổng cộng`);

        // Filter posts in continue mode
        if (scanMode === 'continue' && scanState.lastProcessedPostTime) {
            const lastTime = new Date(scanState.lastProcessedPostTime).getTime();
            const originalCount = allContent.length;
            allContent = allContent.filter(post => {
                const postTime = new Date(post.created_time).getTime();
                return postTime > lastTime;
            });
            addLog('info', `📊 Lọc còn ${allContent.length}/${originalCount} posts mới`);
        }

        result.totalPosts = allContent.length;

        if (allContent.length === 0) {
            addLog('success', '✨ Không có posts mới nào cần xử lý!');
            isProcessRunning = false;
            return result;
        }

        // Sort by created_time ascending (oldest first)
        allContent.sort((a, b) =>
            new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
        );

        // Process each post
        for (let postIndex = 0; postIndex < allContent.length; postIndex++) {
            // Check for abort
            if (abortFlag) {
                addLog('warning', `⛔ Đã dừng! Xử lý được ${postIndex}/${allContent.length} posts`);
                result.errors.push('Process aborted by user');
                break;
            }

            const post = allContent[postIndex];
            const postPreview = post.message
                ? post.message.substring(0, 50) + (post.message.length > 50 ? '...' : '')
                : '(Không có nội dung)';

            addLog('info', `📄 [Post ${postIndex + 1}/${allContent.length}] ${postPreview}`);

            // Get existing comments from page (to sync tracking)
            const existingComments = await getPageCommentsOnPost(
                post.id,
                config.pageId,
                config.accessToken
            );

            // Sync existing comments to tracking
            existingComments.forEach(c => {
                if (!isAlreadyCommented(post.id, c)) {
                    markAsCommented(post.id, c);
                }
            });

            // Process each comment
            for (let cmtIndex = 0; cmtIndex < comments.length; cmtIndex++) {
                const commentText = comments[cmtIndex];
                const commentPreview = commentText.substring(0, 40) + (commentText.length > 40 ? '...' : '');

                // Check for abort
                if (abortFlag) {
                    addLog('warning', `⛔ Đã dừng trong lúc comment!`);
                    break;
                }

                if (isAlreadyCommented(post.id, commentText)) {
                    result.commentsSkipped++;
                    addLog('warning', `⏭️ [Comment ${cmtIndex + 1}] Đã có, bỏ qua: "${commentPreview}"`);
                    continue;
                }

                // Post comment
                addLog('info', `💬 [Comment ${cmtIndex + 1}/${comments.length}] Đang post: "${commentPreview}"`);
                const commentId = await postComment(post.id, commentText, config.accessToken);

                if (commentId) {
                    markAsCommented(post.id, commentText);
                    result.commentsPosted++;
                    addLog('success', `✅ Thành công! Post ${postIndex + 1}, Comment ${cmtIndex + 1}`);
                } else {
                    addLog('error', `❌ Lỗi post comment vào Post ${postIndex + 1}`);
                }

                // Delay
                addLog('info', `⏳ Đợi ${config.delayBetweenComments}s...`);
                await new Promise(r => setTimeout(r, config.delayBetweenComments * 1000));
            }

            // Check for abort after post
            if (abortFlag) break;

            // Update scan state
            scanState.lastProcessedPostTime = post.created_time;
            scanState.totalPostsProcessed++;
        }

        if (!abortFlag) {
            addLog('success', `🎉 Hoàn thành: ${result.commentsPosted} posted, ${result.commentsSkipped} skipped`);
        }
    } catch (error: any) {
        result.errors.push(error.message);
        addLog('error', `Lỗi: ${error.message}`);
    } finally {
        isProcessRunning = false;
        abortFlag = false;
    }

    return result;
}
