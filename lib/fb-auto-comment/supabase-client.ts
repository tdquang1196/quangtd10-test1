/**
 * Supabase Client for FB Auto-Comment Scheduler
 * Handles database operations for scheduler config, logs, and scan state
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-load clients to avoid build-time errors when env vars are not set
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
    }
    return url;
}

function getSupabaseAnonKey(): string {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) {
        throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
    }
    return key;
}

// Public client (for client-side usage) - lazy loaded
export function getSupabase(): SupabaseClient {
    if (!_supabase) {
        _supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
    }
    return _supabase;
}

// Admin client (for server-side usage with full access) - lazy loaded
export function getSupabaseAdmin(): SupabaseClient {
    if (!_supabaseAdmin) {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
            _supabaseAdmin = createClient(getSupabaseUrl(), serviceKey);
        } else {
            _supabaseAdmin = getSupabase();
        }
    }
    return _supabaseAdmin;
}

// Legacy exports for backwards compatibility (use functions above instead)
export const supabase = { get: getSupabase };
export const supabaseAdmin = { get: getSupabaseAdmin };

// Types matching database schema
export interface SchedulerConfigRow {
    id: string;
    enabled: boolean;
    access_token: string;
    page_id: string;
    delay_between_comments: number;
    interval_minutes: number;
    comments: string[];
    next_run_at: string | null;
    last_run_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SchedulerLogRow {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    created_at: string;
}

export interface ScanStateRow {
    id: string;
    last_processed_post_time: string | null;
    total_posts_processed: number;
    comment_tracking: Record<string, string[]>;
    updated_at: string;
}
