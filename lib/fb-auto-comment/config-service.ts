/**
 * Config Service for FB Auto-Comment Scheduler
 * CRUD operations for scheduler config, logs, and scan state
 */

import { getSupabaseAdmin, SchedulerConfigRow, SchedulerLogRow, ScanStateRow } from './supabase-client';

// ==================== CONFIG ====================

/**
 * Get scheduler config
 */
export async function getSchedulerConfig(): Promise<SchedulerConfigRow | null> {
    const { data, error } = await getSupabaseAdmin()
        .from('fb_scheduler_config')
        .select('*')
        .single();

    if (error) {
        console.error('[ConfigService] Error getting config:', error);
        return null;
    }
    return data;
}

/**
 * Update scheduler config
 */
export async function updateSchedulerConfig(updates: Partial<SchedulerConfigRow>): Promise<boolean> {
    const { error } = await getSupabaseAdmin()
        .from('fb_scheduler_config')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', (await getSchedulerConfig())?.id);

    if (error) {
        console.error('[ConfigService] Error updating config:', error);
        return false;
    }
    return true;
}

/**
 * Toggle scheduler enabled/disabled
 */
export async function toggleScheduler(enabled: boolean): Promise<boolean> {
    const config = await getSchedulerConfig();
    if (!config) return false;

    const updates: Partial<SchedulerConfigRow> = { enabled };

    // If enabling, set next_run_at to now (run immediately)
    if (enabled && !config.next_run_at) {
        updates.next_run_at = new Date().toISOString();
    }

    return updateSchedulerConfig(updates);
}

/**
 * Update next run time (called after completion)
 */
export async function scheduleNextRun(intervalMinutes?: number): Promise<boolean> {
    const config = await getSchedulerConfig();
    if (!config) return false;

    const interval = intervalMinutes || config.interval_minutes || 30;
    const nextRunAt = new Date(Date.now() + interval * 60 * 1000);

    return updateSchedulerConfig({
        next_run_at: nextRunAt.toISOString(),
        last_run_at: new Date().toISOString()
    });
}

// ==================== LOGS ====================

const MAX_LOGS = 500;

/**
 * Add a log entry
 */
export async function addLog(type: SchedulerLogRow['type'], message: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
        .from('fb_scheduler_logs')
        .insert({ type, message });

    if (error) {
        console.error('[ConfigService] Error adding log:', error);
    }

    // Cleanup old logs (keep last MAX_LOGS)
    await cleanupOldLogs();
}

/**
 * Get recent logs
 */
export async function getLogs(limit: number = 100): Promise<SchedulerLogRow[]> {
    const { data, error } = await getSupabaseAdmin()
        .from('fb_scheduler_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[ConfigService] Error getting logs:', error);
        return [];
    }
    return data || [];
}

/**
 * Clear all logs
 */
export async function clearLogs(): Promise<void> {
    const { error } = await getSupabaseAdmin()
        .from('fb_scheduler_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
        console.error('[ConfigService] Error clearing logs:', error);
    }
}

/**
 * Cleanup old logs to keep database size manageable
 */
async function cleanupOldLogs(): Promise<void> {
    const { data: logs } = await getSupabaseAdmin()
        .from('fb_scheduler_logs')
        .select('id, created_at')
        .order('created_at', { ascending: false });

    if (logs && logs.length > MAX_LOGS) {
        const idsToDelete = logs.slice(MAX_LOGS).map(log => log.id);

        await getSupabaseAdmin()
            .from('fb_scheduler_logs')
            .delete()
            .in('id', idsToDelete);
    }
}

// ==================== SCAN STATE ====================

/**
 * Get scan state
 */
export async function getScanState(): Promise<ScanStateRow | null> {
    const { data, error } = await getSupabaseAdmin()
        .from('fb_scan_state')
        .select('*')
        .single();

    if (error) {
        console.error('[ConfigService] Error getting scan state:', error);
        return null;
    }
    return data;
}

/**
 * Update scan state
 */
export async function updateScanState(updates: Partial<ScanStateRow>): Promise<boolean> {
    const { error } = await getSupabaseAdmin()
        .from('fb_scan_state')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', (await getScanState())?.id);

    if (error) {
        console.error('[ConfigService] Error updating scan state:', error);
        return false;
    }
    return true;
}

/**
 * Reset scan state (for full scan)
 */
export async function resetScanState(): Promise<boolean> {
    return updateScanState({
        last_processed_post_time: null,
        total_posts_processed: 0,
        comment_tracking: {}
    });
}

// ==================== SCHEDULER STATUS ====================

export interface SchedulerStatus {
    enabled: boolean;
    isRunning: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    intervalMinutes: number;
    hasValidConfig: boolean;
}

/**
 * Get full scheduler status
 */
export async function getSchedulerStatus(): Promise<SchedulerStatus> {
    const config = await getSchedulerConfig();

    if (!config) {
        return {
            enabled: false,
            isRunning: false,
            lastRunAt: null,
            nextRunAt: null,
            intervalMinutes: 30,
            hasValidConfig: false
        };
    }

    const hasValidConfig = !!(config.access_token && config.page_id);
    const isTimeToRun = config.next_run_at
        ? new Date(config.next_run_at) <= new Date()
        : false;

    return {
        enabled: config.enabled,
        isRunning: config.enabled && isTimeToRun,
        lastRunAt: config.last_run_at,
        nextRunAt: config.next_run_at,
        intervalMinutes: config.interval_minutes,
        hasValidConfig
    };
}
