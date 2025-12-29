/**
 * Supabase Client for FB Auto-Comment Scheduler
 * Handles database operations for scheduler config, logs, and scan state
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Public client (for client-side usage)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (for server-side usage with full access)
export const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase;

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
