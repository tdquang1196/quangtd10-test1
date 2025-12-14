/**
 * File-based storage for FB Auto Comment
 * Data files are pre-created, server only reads/writes
 */

import fs from 'fs';
import path from 'path';
import { FBConfig, PostTrackingRecord, ScanState } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'fb-auto-comment');

// =============================================
// CONFIG
// =============================================
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

export function getConfig(): FBConfig | null {
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        // Return null if empty object
        if (!parsed.accessToken) return null;
        return parsed;
    } catch (error) {
        console.error('Error reading config:', error);
        return null;
    }
}

export function saveConfig(config: FBConfig): void {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

// =============================================
// COMMENTS
// =============================================
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');

export function getComments(): string[] {
    try {
        const data = fs.readFileSync(COMMENTS_FILE, 'utf-8');
        return JSON.parse(data) || [];
    } catch (error) {
        console.error('Error reading comments:', error);
        return [];
    }
}

export function saveComments(comments: string[]): void {
    try {
        fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
    } catch (error) {
        console.error('Error saving comments:', error);
    }
}

// =============================================
// TRACKING
// =============================================
const TRACKING_FILE = path.join(DATA_DIR, 'tracking.json');

export function getTracking(): Map<string, PostTrackingRecord> {
    try {
        const data = fs.readFileSync(TRACKING_FILE, 'utf-8');
        const records: PostTrackingRecord[] = JSON.parse(data) || [];
        const map = new Map<string, PostTrackingRecord>();
        records.forEach(r => map.set(r.postId, r));
        return map;
    } catch (error) {
        console.error('Error reading tracking:', error);
        return new Map();
    }
}

export function saveTracking(tracking: Map<string, PostTrackingRecord>): void {
    try {
        const records = Array.from(tracking.values());
        fs.writeFileSync(TRACKING_FILE, JSON.stringify(records, null, 2));
    } catch (error) {
        console.error('Error saving tracking:', error);
    }
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
    const tracking = getTracking();
    const record = tracking.get(postId);
    if (!record) return false;

    const messagePrefix = getFirstNWords(message, 10);
    return record.commentedMessages.some(
        m => getFirstNWords(m, 10) === messagePrefix
    );
}

export function markAsCommented(postId: string, message: string): void {
    const tracking = getTracking();
    let record = tracking.get(postId);

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

    tracking.set(postId, record);
    saveTracking(tracking);
}

// =============================================
// LOGS
// =============================================
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const MAX_LOGS = 500;

export interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
}

export function getLogs(): LogEntry[] {
    try {
        const data = fs.readFileSync(LOGS_FILE, 'utf-8');
        return JSON.parse(data) || [];
    } catch (error) {
        console.error('Error reading logs:', error);
        return [];
    }
}

export function addLog(type: LogEntry['type'], message: string): void {
    try {
        const logs = getLogs();
        logs.push({
            timestamp: new Date().toISOString(),
            type,
            message,
        });

        // Keep only last MAX_LOGS entries
        const trimmedLogs = logs.slice(-MAX_LOGS);
        fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmedLogs, null, 2));
    } catch (error) {
        console.error('Error adding log:', error);
    }
}

export function clearLogs(): void {
    try {
        fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
    } catch (error) {
        console.error('Error clearing logs:', error);
    }
}

// =============================================
// SCAN STATE
// =============================================
const SCAN_STATE_FILE = path.join(DATA_DIR, 'scan-state.json');

const DEFAULT_SCAN_STATE: ScanState = {
    lastScanAt: null,
    lastProcessedPostId: null,
    lastProcessedPostTime: null,
    totalPostsProcessed: 0,
};

export function getScanState(): ScanState {
    try {
        const data = fs.readFileSync(SCAN_STATE_FILE, 'utf-8');
        return { ...DEFAULT_SCAN_STATE, ...JSON.parse(data) };
    } catch (error) {
        console.error('Error reading scan state:', error);
        return { ...DEFAULT_SCAN_STATE };
    }
}

export function saveScanState(state: Partial<ScanState>): void {
    try {
        const current = getScanState();
        const updated = { ...current, ...state };
        fs.writeFileSync(SCAN_STATE_FILE, JSON.stringify(updated, null, 2));
    } catch (error) {
        console.error('Error saving scan state:', error);
    }
}

export function resetScanState(): void {
    try {
        fs.writeFileSync(SCAN_STATE_FILE, JSON.stringify(DEFAULT_SCAN_STATE, null, 2));
    } catch (error) {
        console.error('Error resetting scan state:', error);
    }
}
