/**
 * Server-side scheduler for FB Auto Comment
 * Runs in the background even when browser is closed
 */

import { SchedulerStatus, AutoCommentResult, ScanMode, ScanState } from './types';
import {
    getConfig,
    getComments,
    isAlreadyCommented,
    markAsCommented,
    addLog,
    getTracking,
    saveTracking,
    getScanState,
    saveScanState,
    resetScanState
} from './storage';
import {
    getAllContent,
    getPageCommentsOnPost,
    postComment
} from './facebook';

// Global scan mode
let currentScanMode: ScanMode = 'continue';

// Global scheduler state (persists as long as server runs)
let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let schedulerStatus: SchedulerStatus = {
    isRunning: false,
    currentRun: 0,
    maxRuns: 0,
    lastRunAt: null,
    nextRunAt: null,
};

/**
 * Get current scheduler status
 */
export function getSchedulerStatus(): SchedulerStatus {
    return { ...schedulerStatus };
}

/**
 * Set scan mode for next run
 */
export function setScanMode(mode: ScanMode): void {
    currentScanMode = mode;
}

/**
 * Get current scan mode
 */
export function getScanMode(): ScanMode {
    return currentScanMode;
}

/**
 * Run the auto-comment process once
 * @param scanMode - 'full' to scan all posts, 'continue' to scan only new posts
 */
export async function runAutoComment(scanMode: ScanMode = 'continue'): Promise<AutoCommentResult> {
    const result: AutoCommentResult = {
        totalPosts: 0,
        commentsPosted: 0,
        commentsSkipped: 0,
        errors: [],
    };

    const config = getConfig();
    const comments = getComments();
    const scanState = getScanState();

    if (!config) {
        result.errors.push('Chưa cấu hình Access Token và Page ID');
        addLog('error', 'Chưa cấu hình Access Token và Page ID');
        return result;
    }

    if (comments.length === 0) {
        result.errors.push('Chưa có comment nào trong danh sách');
        addLog('error', 'Chưa có comment nào trong danh sách');
        return result;
    }

    // Log scan mode
    if (scanMode === 'full') {
        addLog('info', `🔄 CHẾ ĐỘ: Quét toàn bộ từ đầu`);
        resetScanState();
    } else {
        if (scanState.lastScanAt) {
            addLog('info', `⏩ CHẾ ĐỘ: Quét tiếp từ ${new Date(scanState.lastScanAt).toLocaleString('vi-VN')}`);
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
            return result;
        }

        // Sort by created_time ascending (oldest first)
        allContent.sort((a, b) =>
            new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
        );

        // Process each post
        for (let postIndex = 0; postIndex < allContent.length; postIndex++) {
            const post = allContent[postIndex];
            const postPreview = post.message
                ? post.message.substring(0, 50) + (post.message.length > 50 ? '...' : '')
                : '(Không có nội dung)';

            addLog('info', `📄 [Post ${postIndex + 1}/${allContent.length}] ${postPreview}`);

            // Get existing comments from page
            const existingComments = await getPageCommentsOnPost(
                post.id,
                config.pageId,
                config.accessToken
            );

            // Sync with tracking
            const tracking = getTracking();
            if (!tracking.has(post.id)) {
                tracking.set(post.id, {
                    postId: post.id,
                    commentedMessages: existingComments,
                    lastUpdated: new Date().toISOString(),
                });
                saveTracking(tracking);
            }

            // Process each comment
            for (let cmtIndex = 0; cmtIndex < comments.length; cmtIndex++) {
                const commentText = comments[cmtIndex];
                const commentPreview = commentText.substring(0, 40) + (commentText.length > 40 ? '...' : '');

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

            // Save scan state after each post
            saveScanState({
                lastProcessedPostId: post.id,
                lastProcessedPostTime: post.created_time,
                totalPostsProcessed: getScanState().totalPostsProcessed + 1,
            });
        }

        // Save final scan state
        saveScanState({
            lastScanAt: new Date().toISOString(),
        });

        addLog('success', `Hoàn thành: ${result.commentsPosted} posted, ${result.commentsSkipped} skipped`);
    } catch (error: any) {
        result.errors.push(error.message);
        addLog('error', `Lỗi: ${error.message}`);
    }

    return result;
}

/**
 * Start the scheduler
 */
export function startScheduler(intervalSeconds: number, maxRuns: number): boolean {
    if (schedulerInterval) {
        return false; // Already running
    }

    const config = getConfig();
    const comments = getComments();

    if (!config) {
        addLog('error', 'Không thể bắt đầu scheduler: Chưa cấu hình');
        return false;
    }

    if (comments.length === 0) {
        addLog('error', 'Không thể bắt đầu scheduler: Chưa có comments');
        return false;
    }

    schedulerStatus = {
        isRunning: true,
        currentRun: 0,
        maxRuns,
        lastRunAt: null,
        nextRunAt: new Date(Date.now() + 1000).toISOString(), // Start in 1 second
    };

    addLog('info', `Scheduler bắt đầu: mỗi ${intervalSeconds}s, ${maxRuns > 0 ? `tối đa ${maxRuns} lần` : 'vô hạn'}`);

    // Run immediately
    setTimeout(async () => {
        await executeScheduledRun();
    }, 1000);

    // Set interval for subsequent runs
    schedulerInterval = setInterval(async () => {
        if (schedulerStatus.isRunning) {
            await executeScheduledRun();
        }
    }, intervalSeconds * 1000);

    return true;
}

async function executeScheduledRun() {
    if (!schedulerStatus.isRunning) return;

    schedulerStatus.currentRun++;
    schedulerStatus.lastRunAt = new Date().toISOString();

    addLog('info', `[Lần ${schedulerStatus.currentRun}${schedulerStatus.maxRuns > 0 ? '/' + schedulerStatus.maxRuns : ''}] Bắt đầu (${currentScanMode === 'full' ? 'Quét toàn bộ' : 'Quét tiếp'})...`);

    await runAutoComment(currentScanMode);

    // Check if should stop
    if (schedulerStatus.maxRuns > 0 && schedulerStatus.currentRun >= schedulerStatus.maxRuns) {
        stopScheduler();
        addLog('success', 'Scheduler hoàn thành tất cả các lần chạy');
    } else if (schedulerStatus.isRunning) {
        // Calculate next run time
        const config = getConfig();
        if (config) {
            schedulerStatus.nextRunAt = new Date(Date.now() + 60000).toISOString(); // Placeholder
        }
    }
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }

    const runs = schedulerStatus.currentRun;
    schedulerStatus = {
        isRunning: false,
        currentRun: runs,
        maxRuns: 0,
        lastRunAt: schedulerStatus.lastRunAt,
        nextRunAt: null,
    };

    addLog('warning', `Scheduler đã dừng sau ${runs} lần chạy`);
}
