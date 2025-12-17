/**
 * Types for FB Auto Comment feature
 */

export interface FBConfig {
    accessToken: string;
    pageId: string;
    delayBetweenComments: number; // seconds
}

export interface FBComment {
    id: string;
    text: string;
    createdAt: string;
}

export interface SchedulerConfig {
    intervalSeconds: number;
    maxRuns: number; // 0 = unlimited
}

export interface SchedulerStatus {
    isRunning: boolean;
    currentRun: number;
    maxRuns: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
}

export interface PostTrackingRecord {
    postId: string;
    commentedMessages: string[];
    lastUpdated: string;
}

export interface FBPost {
    id: string;
    message?: string;
    created_time: string;
    privacy?: {
        value: string; // EVERYONE, ALL_FRIENDS, SELF, CUSTOM, etc.
        description?: string;
    };
}

export interface AutoCommentResult {
    totalPosts: number;
    commentsPosted: number;
    commentsSkipped: number;
    errors: string[];
}

export type ScanMode = 'full' | 'continue';

export interface ScanState {
    lastScanAt: string | null;
    lastProcessedPostId: string | null;
    lastProcessedPostTime: string | null;
    totalPostsProcessed: number;
}
