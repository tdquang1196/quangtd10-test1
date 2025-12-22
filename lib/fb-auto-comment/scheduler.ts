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
const MAX_LOGS = 500;

interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
}

// Failed posts tracking
interface FailedPost {
    postId: string;
    postPreview: string;
    error: string;
    timestamp: string;
    resolved: boolean;
}

let failedPostsStore: FailedPost[] = [];

// Private posts tracking (Only Me posts - skip commenting)
interface PrivatePost {
    postId: string;
    postPreview: string;
    privacy: string;
    timestamp: string;
}

let privatePostsStore: PrivatePost[] = [];

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
 * Get failed posts
 */
export function getFailedPosts(): FailedPost[] {
    return [...failedPostsStore];
}

/**
 * Add a failed post
 */
function addFailedPost(postId: string, postPreview: string, error: string): void {
    // Check if already exists (don't add duplicates)
    const exists = failedPostsStore.some(fp => fp.postId === postId && !fp.resolved);
    if (!exists) {
        failedPostsStore.push({
            postId,
            postPreview,
            error,
            timestamp: new Date().toISOString(),
            resolved: false
        });
    }
}

/**
 * Mark a failed post as resolved
 */
export function resolveFailedPost(postId: string): void {
    const post = failedPostsStore.find(fp => fp.postId === postId);
    if (post) {
        post.resolved = true;
    }
}

/**
 * Clear all failed posts
 */
export function clearFailedPosts(): void {
    failedPostsStore = [];
}

/**
 * Get private posts (Only Me posts)
 */
export function getPrivatePosts(): PrivatePost[] {
    return [...privatePostsStore];
}

/**
 * Add a private post to skip list
 */
function addPrivatePost(postId: string, postPreview: string, privacy: string): void {
    const exists = privatePostsStore.some(pp => pp.postId === postId);
    if (!exists) {
        privatePostsStore.push({
            postId,
            postPreview,
            privacy,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Remove a private post from skip list (when successfully commented)
 */
export function removePrivatePost(postId: string): void {
    privatePostsStore = privatePostsStore.filter(pp => pp.postId !== postId);
}

/**
 * Check if post is in private posts list
 */
function isPrivatePost(postId: string): boolean {
    return privatePostsStore.some(pp => pp.postId === postId);
}

/**
 * Clear all private posts
 */
export function clearPrivatePosts(): void {
    privatePostsStore = [];
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
 * Scan state structure - bao gồm tracking để lưu vào client localStorage
 */
interface ScanStateData {
    lastProcessedPostTime: string | null;
    totalPostsProcessed: number;
    // Option 3: Lưu tracking vào client để persist qua server restart
    commentTracking?: Record<string, string[]>; // postId -> list of comment prefixes (10 words)
}

/**
 * Run the auto-comment process once
 * @param scanMode - 'full' to scan all posts, 'continue' to scan only new posts
 * @param config - Config from client
 * @param comments - Comments from client
 * @param clientScanState - Scan state from client (localStorage)
 */
export async function runAutoComment(
    scanMode: ScanMode = 'continue',
    config: FBConfig,
    comments: string[],
    clientScanState?: ScanStateData
): Promise<AutoCommentResult & { scanState: ScanStateData }> {
    // Prevent multiple runs
    if (isProcessRunning) {
        addLog('warning', 'Đang có quá trình khác chạy, vui lòng đợi...');
        return {
            totalPosts: 0,
            commentsPosted: 0,
            commentsSkipped: 0,
            errors: ['Process already running'],
            scanState: clientScanState || { lastProcessedPostTime: null, totalPostsProcessed: 0 }
        };
    }

    isProcessRunning = true;
    abortFlag = false;

    // Use client scan state or default
    let currentScanState: ScanStateData = clientScanState || {
        lastProcessedPostTime: null,
        totalPostsProcessed: 0
    };

    const result: AutoCommentResult & { scanState: ScanStateData } = {
        totalPosts: 0,
        commentsPosted: 0,
        commentsSkipped: 0,
        errors: [],
        scanState: currentScanState
    };

    // Reset tracking for full scan
    if (scanMode === 'full') {
        addLog('info', `🔄 CHẾ ĐỘ: Quét toàn bộ từ đầu`);
        commentedPosts.clear();
        currentScanState = { lastProcessedPostTime: null, totalPostsProcessed: 0, commentTracking: {} };
    } else {
        // Option 3: Restore tracking từ client localStorage
        if (currentScanState.commentTracking) {
            const trackingCount = Object.keys(currentScanState.commentTracking).length;
            if (trackingCount > 0) {
                addLog('info', `📥 Đã restore tracking từ client: ${trackingCount} posts`);
                // Merge client tracking vào in-memory tracking
                for (const [postId, prefixes] of Object.entries(currentScanState.commentTracking)) {
                    const existing = commentedPosts.get(postId) || [];
                    const merged = [...new Set([...existing, ...prefixes])];
                    commentedPosts.set(postId, merged);
                }
            }
        }

        if (currentScanState.lastProcessedPostTime) {
            addLog('info', `⏩ CHẾ ĐỘ: Quét tiếp từ ${new Date(currentScanState.lastProcessedPostTime).toLocaleString('vi-VN')}`);
        } else {
            addLog('info', `⏩ CHẾ ĐỘ: Quét tiếp (lần đầu - sẽ quét tất cả)`);
        }
    }

    addLog('info', `Bắt đầu auto comment với ${comments.length} comments`);

    try {
        // Get all content
        addLog('info', 'Đang lấy danh sách posts...');
        let allContent = await getAllContent(config.pageId, config.accessToken);
        addLog('info', `Tìm thấy ${allContent.length} posts/videos tổng cộng`);

        // Filter posts in continue mode
        if (scanMode === 'continue' && currentScanState.lastProcessedPostTime) {
            const lastTime = new Date(currentScanState.lastProcessedPostTime).getTime();
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

            addLog('info', `📄 [${postIndex + 1}/${allContent.length}] [Post ${post.id}] ${postPreview}`);

            // Check if post privacy is "Only Me" (SELF) - skip tạm thời, lần sau sẽ check lại
            const privacyValue = post.privacy?.value || 'UNKNOWN';
            if (privacyValue === 'SELF') {
                addLog('warning', `🔒 [SKIP TẠM] Post để chế độ "Only Me" - bỏ qua lần này, sẽ check lại lần sau`);
                // Không lưu vào privatePostsStore - để lần sau check lại phòng user mở lại
                continue;
            }

            // Get existing comments from page (to sync tracking)
            const existingComments = await getPageCommentsOnPost(
                post.id,
                config.pageId,
                config.accessToken
            );

            addLog('info', `📝 Tìm thấy ${existingComments.length} comments đã có từ Page`);

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

                // Check duplicate using BOTH in-memory tracking AND direct comparison with existingComments
                const inMemoryCheck = isAlreadyCommented(post.id, commentText);
                const directCheck = existingComments.some(ec => getFirstNWords(ec, 10) === getFirstNWords(commentText, 10));
                const alreadyExists = inMemoryCheck || directCheck;

                if (alreadyExists) {
                    result.commentsSkipped++;
                    addLog('warning', `⏭️ [Post ${post.id}] [Comment ${cmtIndex + 1}] Đã có, bỏ qua: "${commentPreview}"`);
                    continue;
                }

                // ===== Option 2: Double-check ngay trước khi post =====
                // Fetch lại comments mới nhất từ Facebook để đảm bảo không bị trùng
                const freshComments = await getPageCommentsOnPost(
                    post.id,
                    config.pageId,
                    config.accessToken
                );
                const freshCheck = freshComments.some(fc => getFirstNWords(fc, 10) === getFirstNWords(commentText, 10));
                if (freshCheck) {
                    result.commentsSkipped++;
                    addLog('warning', `⏭️ [Post ${post.id}] [Double-check] Comment đã có trên Facebook: "${commentPreview}"`);
                    // Sync lại vào tracking
                    markAsCommented(post.id, commentText);
                    continue;
                }
                // ===== END Option 2 =====

                // Post comment
                addLog('info', `💬 [Post ${post.id}] [Comment ${cmtIndex + 1}/${comments.length}] Đang post: "${commentPreview}"`);

                const commentResult = await postComment(post.id, commentText, config.accessToken);

                if (commentResult.id) {
                    markAsCommented(post.id, commentText);
                    result.commentsPosted++;
                    addLog('success', `✅ [Post ${post.id}] Thành công! Comment ${cmtIndex + 1}`);

                    // Remove from private posts if it was there (privacy might have changed)
                    removePrivatePost(post.id);

                    // Option 1: Delay để Facebook API sync
                    addLog('info', `⏳ Đợi ${config.delayBetweenComments}s để Facebook sync...`);
                    await new Promise(r => setTimeout(r, config.delayBetweenComments * 1000));
                } else {
                    const errorMsg = commentResult.error || 'Unknown error';
                    addLog('error', `❌ [Post ${post.id}] Lỗi post comment: ${errorMsg}`);

                    // Track failed post
                    addFailedPost(post.id, postPreview, errorMsg);

                    // If permission error, mark as private post to skip in future runs
                    if (errorMsg.includes('200') && errorMsg.toLowerCase().includes('permission')) {
                        addPrivatePost(post.id, postPreview, 'PERMISSION_ERROR');
                        addLog('info', `🔒 Đánh dấu post để skip trong các lần chạy sau`);
                    }

                    // No delay on error - continue immediately
                }
            }

            // Check for abort after post
            if (abortFlag) break;

            // Update scan state
            currentScanState.lastProcessedPostTime = post.created_time;
            currentScanState.totalPostsProcessed++;

            // Option 3: Export tracking để client lưu vào localStorage
            currentScanState.commentTracking = {};
            commentedPosts.forEach((prefixes, postId) => {
                // Chỉ lưu prefix (10 words) để tiết kiệm dung lượng
                currentScanState.commentTracking![postId] = prefixes.map(p => getFirstNWords(p, 10));
            });

            result.scanState = { ...currentScanState };
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

        // Option 3: Luôn export tracking mới nhất
        currentScanState.commentTracking = {};
        commentedPosts.forEach((prefixes, postId) => {
            currentScanState.commentTracking![postId] = prefixes.map(p => getFirstNWords(p, 10));
        });

        result.scanState = { ...currentScanState };
    }

    return result;
}
