/**
 * In-memory storage for FB Auto Comment
 * Data is stored in RAM - will be lost when server restarts
 * Much faster than file-based storage
 */

import { FBConfig, PostTrackingRecord, ScanState } from './types';

// =============================================
// IN-MEMORY DATA STORES
// =============================================
let configStore: FBConfig | null = null;
let commentsStore: string[] = [];
let trackingStore: Map<string, PostTrackingRecord> = new Map();
let logsStore: LogEntry[] = [];
let scanStateStore: ScanState = {
    lastScanAt: null,
    lastProcessedPostId: null,
    lastProcessedPostTime: null,
    totalPostsProcessed: 0,
};

const MAX_LOGS = 500;

// =============================================
// CONFIG
// =============================================
export function getConfig(): FBConfig | null {
    return configStore;
}

export function saveConfig(config: FBConfig): void {
    configStore = { ...config };
}

// =============================================
// COMMENTS
// =============================================
export function getComments(): string[] {
    return [...commentsStore];
}

export function saveComments(comments: string[]): void {
    commentsStore = [...comments];
}

// =============================================
// TRACKING
// =============================================
export function getTracking(): Map<string, PostTrackingRecord> {
    return trackingStore;
}

export function saveTracking(tracking: Map<string, PostTrackingRecord>): void {
    trackingStore = tracking;
}

/**
 * Get first N words from a string for comparison
 */
function getFirstNWords(text: string, n: number = 10): string {
    return text
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .slice(0, n)
        .join(' ');
}

export function isAlreadyCommented(postId: string, message: string): boolean {
    const record = trackingStore.get(postId);
    if (!record) return false;

    const messagePrefix = getFirstNWords(message, 10);
    return record.commentedMessages.some(
        m => getFirstNWords(m, 10) === messagePrefix
    );
}

export function markAsCommented(postId: string, message: string): void {
    let record = trackingStore.get(postId);

    if (!record) {
        record = {
            postId,
            commentedMessages: [],
            lastUpdated: new Date().toISOString(),
        };
    }

    const messagePrefix = getFirstNWords(message, 10);
    const isDuplicate = record.commentedMessages.some(
        m => getFirstNWords(m, 10) === messagePrefix
    );

    if (!isDuplicate) {
        record.commentedMessages.push(message);
        record.lastUpdated = new Date().toISOString();
    }

    trackingStore.set(postId, record);
}

// =============================================
// LOGS
// =============================================
export interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
}

export function getLogs(): LogEntry[] {
    return [...logsStore];
}

export function addLog(type: LogEntry['type'], message: string): void {
    logsStore.push({
        timestamp: new Date().toISOString(),
        type,
        message,
    });

    // Keep only last MAX_LOGS entries
    if (logsStore.length > MAX_LOGS) {
        logsStore = logsStore.slice(-MAX_LOGS);
    }
}

export function clearLogs(): void {
    logsStore = [];
}

// =============================================
// SCAN STATE
// =============================================
export function getScanState(): ScanState {
    return { ...scanStateStore };
}

export function saveScanState(state: Partial<ScanState>): void {
    scanStateStore = { ...scanStateStore, ...state };
}

export function resetScanState(): void {
    scanStateStore = {
        lastScanAt: null,
        lastProcessedPostId: null,
        lastProcessedPostTime: null,
        totalPostsProcessed: 0,
    };
}

// =============================================
// CLEAR ALL DATA (for testing/reset)
// =============================================
export function clearAllData(): void {
    configStore = null;
    commentsStore = [];
    trackingStore = new Map();
    logsStore = [];
    resetScanState();
}
