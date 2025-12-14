/**
 * File-based storage for FB Auto Comment
 * Data persists across server restarts
 */

import fs from 'fs';
import path from 'path';
import { FBConfig, FBComment, SchedulerConfig, PostTrackingRecord, ScanState } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'fb-auto-comment');

// Ensure data directory exists
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

// =============================================
// CONFIG
// =============================================
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

export function getConfig(): FBConfig | null {
    ensureDataDir();
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading config:', error);
    }
    return null;
}

export function saveConfig(config: FBConfig): void {
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// =============================================
// COMMENTS
// =============================================
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');

export function getComments(): string[] {
    ensureDataDir();
    try {
        if (fs.existsSync(COMMENTS_FILE)) {
            const data = fs.readFileSync(COMMENTS_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading comments:', error);
    }
    return [];
}

export function saveComments(comments: string[]): void {
    ensureDataDir();
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
}

// =============================================
// TRACKING
// =============================================
const TRACKING_FILE = path.join(DATA_DIR, 'tracking.json');

export function getTracking(): Map<string, PostTrackingRecord> {
    ensureDataDir();
    try {
        if (fs.existsSync(TRACKING_FILE)) {
            const data = fs.readFileSync(TRACKING_FILE, 'utf-8');
            const records: PostTrackingRecord[] = JSON.parse(data);
            const map = new Map<string, PostTrackingRecord>();
            records.forEach(r => map.set(r.postId, r));
            return map;
        }
    } catch (error) {
        console.error('Error reading tracking:', error);
    }
    return new Map();
}

export function saveTracking(tracking: Map<string, PostTrackingRecord>): void {
    ensureDataDir();
    const records = Array.from(tracking.values());
    fs.writeFileSync(TRACKING_FILE, JSON.stringify(records, null, 2));
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
    ensureDataDir();
    try {
        if (fs.existsSync(LOGS_FILE)) {
            const data = fs.readFileSync(LOGS_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading logs:', error);
    }
    return [];
}

export function addLog(type: LogEntry['type'], message: string): void {
    ensureDataDir();
    const logs = getLogs();
    logs.push({
        timestamp: new Date().toISOString(),
        type,
        message,
    });

    // Keep only last MAX_LOGS entries
    const trimmedLogs = logs.slice(-MAX_LOGS);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmedLogs, null, 2));
}

export function clearLogs(): void {
    ensureDataDir();
    fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
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
    ensureDataDir();
    try {
        if (fs.existsSync(SCAN_STATE_FILE)) {
            const data = fs.readFileSync(SCAN_STATE_FILE, 'utf-8');
            return { ...DEFAULT_SCAN_STATE, ...JSON.parse(data) };
        }
    } catch (error) {
        console.error('Error reading scan state:', error);
    }
    return { ...DEFAULT_SCAN_STATE };
}

export function saveScanState(state: Partial<ScanState>): void {
    ensureDataDir();
    const current = getScanState();
    const updated = { ...current, ...state };
    fs.writeFileSync(SCAN_STATE_FILE, JSON.stringify(updated, null, 2));
}

export function resetScanState(): void {
    ensureDataDir();
    fs.writeFileSync(SCAN_STATE_FILE, JSON.stringify(DEFAULT_SCAN_STATE, null, 2));
}
