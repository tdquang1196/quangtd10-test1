'use client';

/**
 * Background Scheduler Panel Component
 * Manages the 24/7 background scheduler via Supabase
 */

import { useState, useEffect, useCallback } from 'react';

interface SchedulerConfig {
    id: string;
    enabled: boolean;
    access_token: string;
    page_id: string;
    delay_between_comments: number;
    interval_minutes: number;
    comments: string[];
    next_run_at: string | null;
    last_run_at: string | null;
    // Browser mode fields
    fb_email?: string;
    fb_password?: string;
    fb_cookies?: string;
    use_browser_mode?: boolean;
}

interface SchedulerStatus {
    enabled: boolean;
    isRunning: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    intervalMinutes: number;
    hasValidConfig: boolean;
}

interface LogEntry {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    created_at: string;
}

export default function BackgroundSchedulerPanel() {
    // Config state
    const [config, setConfig] = useState<Partial<SchedulerConfig>>({
        access_token: '',
        page_id: '',
        delay_between_comments: 5,
        interval_minutes: 30,
        comments: []
    });

    // Status state
    const [status, setStatus] = useState<SchedulerStatus | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [newComment, setNewComment] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [showCookies, setShowCookies] = useState(false);
    const [activeTab, setActiveTab] = useState<'api' | 'browser'>('api');

    // Unhide comments state
    const [unhideLoading, setUnhideLoading] = useState(false);
    const [unhideResult, setUnhideResult] = useState<{
        postsScanned?: number;
        totalUnhidden?: number;
        totalFailed?: number;
    } | null>(null);

    // Railway control state
    const [railwayStatus, setRailwayStatus] = useState<{
        configured: boolean;
        status?: string;
        serviceName?: string;
        error?: string;
    } | null>(null);
    const [railwayLoading, setRailwayLoading] = useState(false);

    // Fetch status and config
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/fb-scheduler/status');
            const data = await res.json();
            if (data.status) {
                setStatus(data.status);
            }
            if (data.logs) {
                setLogs(data.logs);
            }
        } catch (err) {
            console.error('Failed to fetch status:', err);
        }
    }, []);

    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/fb-scheduler/config');
            const data = await res.json();
            if (data && !data.error) {
                setConfig({
                    ...data,
                    // Don't show full token, just indicator
                    access_token: data.access_token || ''
                });
            }
        } catch (err) {
            console.error('Failed to fetch config:', err);
        }
    }, []);

    // Fetch Railway status
    const fetchRailwayStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/railway');
            const data = await res.json();
            setRailwayStatus(data);
        } catch (err) {
            console.error('Failed to fetch Railway status:', err);
        }
    }, []);

    // Railway control
    const controlRailway = async (action: 'start' | 'stop') => {
        setRailwayLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/railway', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            const data = await res.json();

            if (data.error) {
                setError(data.error);
            } else {
                setSuccess(data.message);
                setTimeout(() => setSuccess(null), 3000);
                // Refresh status after a delay
                setTimeout(fetchRailwayStatus, 2000);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setRailwayLoading(false);
        }
    };

    // Load on mount
    useEffect(() => {
        fetchStatus();
        fetchConfig();
        fetchRailwayStatus();

        // Poll status every 30 seconds
        const interval = setInterval(() => {
            fetchStatus();
            fetchRailwayStatus();
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchStatus, fetchConfig, fetchRailwayStatus]);

    // Toggle scheduler
    const toggleScheduler = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/fb-scheduler/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !status?.enabled })
            });

            const data = await res.json();

            if (data.error) {
                setError(data.error);
            } else {
                setStatus(data.status);
                setSuccess(status?.enabled ? 'Scheduler disabled' : 'Scheduler enabled');
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Save config
    const saveConfig = async () => {
        setSaving(true);
        setError(null);

        try {
            const res = await fetch('/api/fb-scheduler/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken: config.access_token,
                    pageId: config.page_id,
                    delayBetweenComments: config.delay_between_comments,
                    intervalMinutes: config.interval_minutes,
                    comments: config.comments,
                    // Browser mode fields
                    fbEmail: config.fb_email,
                    fbPassword: config.fb_password,
                    fbCookies: config.fb_cookies,
                    useBrowserMode: config.use_browser_mode
                })
            });

            const data = await res.json();

            if (data.error) {
                setError(data.error);
            } else {
                setSuccess('Config saved successfully!');
                setTimeout(() => setSuccess(null), 3000);
                fetchConfig();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    // Add comment
    const addComment = () => {
        if (newComment.trim()) {
            setConfig(prev => ({
                ...prev,
                comments: [...(prev.comments || []), newComment.trim()]
            }));
            setNewComment('');
        }
    };

    // Remove comment
    const removeComment = (index: number) => {
        setConfig(prev => ({
            ...prev,
            comments: (prev.comments || []).filter((_, i) => i !== index)
        }));
    };

    // Format date
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    // Time until next run
    const getTimeUntilNextRun = () => {
        if (!status?.nextRunAt) return null;
        const now = new Date();
        const next = new Date(status.nextRunAt);
        const diff = next.getTime() - now.getTime();

        if (diff <= 0) return 'Running soon...';

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    // Unhide all hidden comments
    const unhideAllComments = async () => {
        if (!config.access_token || !config.page_id) {
            setError('Access Token and Page ID are required');
            return;
        }

        setUnhideLoading(true);
        setError(null);
        setUnhideResult(null);

        try {
            const res = await fetch('/api/fb-auto-comment/unhide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'unhideAllPageComments',
                    accessToken: config.access_token,
                    pageId: config.page_id,
                    maxPosts: 50
                })
            });

            const data = await res.json();

            if (data.error) {
                setError(data.error);
            } else {
                setUnhideResult(data);
                if (data.totalUnhidden > 0) {
                    setSuccess(`Successfully unhid ${data.totalUnhidden} comments!`);
                    setTimeout(() => setSuccess(null), 5000);
                } else {
                    setSuccess('No hidden comments found');
                    setTimeout(() => setSuccess(null), 3000);
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUnhideLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        🤖 Background Scheduler
                    </h2>
                    <p className="text-sm text-gray-500">
                        Chạy tự động 24/7 trên Railway
                    </p>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-3">
                    {status?.enabled ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                            Running
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                            <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                            Disabled
                        </span>
                    )}

                    <button
                        onClick={toggleScheduler}
                        disabled={loading}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${status?.enabled
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                            } disabled:opacity-50`}
                    >
                        {loading ? '...' : status?.enabled ? 'Disable' : 'Enable'}
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    ❌ {error}
                </div>
            )}
            {success && (
                <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                    ✅ {success}
                </div>
            )}

            {/* Railway Worker Control */}
            <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-purple-900 flex items-center gap-2">
                            🚂 Railway Worker Control
                            {railwayStatus?.configured === false && (
                                <span className="text-xs text-orange-600 font-normal">(Not configured)</span>
                            )}
                        </h3>
                        <p className="text-sm text-purple-600">
                            {railwayStatus?.status === 'SUCCESS' && '✅ Worker đang chạy'}
                            {railwayStatus?.status === 'REMOVED' && '⏸️ Worker đã dừng'}
                            {railwayStatus?.status === 'DEPLOYING' && '🔄 Đang deploy...'}
                            {!railwayStatus?.status && railwayStatus?.configured && 'Kiểm tra trạng thái...'}
                            {railwayStatus?.configured === false && 'Cần cấu hình Railway API Token'}
                        </p>
                    </div>

                    {railwayStatus?.configured && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => controlRailway('start')}
                                disabled={railwayLoading || railwayStatus?.status === 'SUCCESS'}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {railwayLoading ? '...' : '▶️ Start'}
                            </button>
                            <button
                                onClick={() => controlRailway('stop')}
                                disabled={railwayLoading || railwayStatus?.status === 'REMOVED'}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {railwayLoading ? '...' : '⏹️ Stop'}
                            </button>
                        </div>
                    )}
                </div>

                {railwayStatus?.configured === false && (
                    <div className="mt-3 text-xs text-purple-700 bg-purple-100 p-2 rounded">
                        <strong>Setup:</strong> Thêm các biến môi trường trong Vercel:
                        <code className="block mt-1 bg-white p-1 rounded text-purple-800">
                            RAILWAY_API_TOKEN, RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID
                        </code>
                    </div>
                )}
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Config */}
                <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">⚙️ Configuration</h3>

                    {/* Access Token */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Facebook Access Token
                        </label>
                        <div className="relative">
                            <input
                                type={showToken ? 'text' : 'password'}
                                value={config.access_token || ''}
                                onChange={(e) => setConfig(prev => ({ ...prev, access_token: e.target.value }))}
                                placeholder="Paste your access token..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                            >
                                {showToken ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {/* Page ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Facebook Page ID
                        </label>
                        <input
                            type="text"
                            value={config.page_id || ''}
                            onChange={(e) => setConfig(prev => ({ ...prev, page_id: e.target.value }))}
                            placeholder="e.g. 123456789"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Interval */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Interval (minutes)
                            </label>
                            <input
                                type="number"
                                value={config.interval_minutes || 30}
                                onChange={(e) => setConfig(prev => ({ ...prev, interval_minutes: parseInt(e.target.value) || 30 }))}
                                min={5}
                                max={1440}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Delay (seconds)
                            </label>
                            <input
                                type="number"
                                value={config.delay_between_comments || 5}
                                onChange={(e) => setConfig(prev => ({ ...prev, delay_between_comments: parseInt(e.target.value) || 5 }))}
                                min={1}
                                max={60}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Comments */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Comments ({config.comments?.length || 0})
                        </label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addComment()}
                                placeholder="Add a comment..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                                onClick={addComment}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Add
                            </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                            {(config.comments || []).map((comment, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                    <span className="flex-1 truncate">{comment}</span>
                                    <button
                                        onClick={() => removeComment(index)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            {(config.comments?.length || 0) === 0 && (
                                <p className="text-gray-400 text-sm">No comments added yet</p>
                            )}
                        </div>
                    </div>

                    {/* Browser Mode Section */}
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-cyan-900 flex items-center gap-2">
                                🌐 Browser Mode (Anti-Spam)
                            </h4>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.use_browser_mode || false}
                                    onChange={(e) => setConfig(prev => ({ ...prev, use_browser_mode: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                <span className="ml-2 text-sm font-medium text-gray-700">
                                    {config.use_browser_mode ? 'ON' : 'OFF'}
                                </span>
                            </label>
                        </div>

                        {config.use_browser_mode && (
                            <div className="space-y-3">
                                <p className="text-xs text-cyan-700 mb-2">
                                    Sử dụng Playwright để giả lập trình duyệt thật, tránh bị Facebook đánh dấu spam.
                                </p>

                                {/* Facebook Cookies */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        🍪 Facebook Cookies (JSON)
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            value={config.fb_cookies || ''}
                                            onChange={(e) => setConfig(prev => ({ ...prev, fb_cookies: e.target.value }))}
                                            placeholder='[{"name":"c_user","value":"..."},{"name":"xs","value":"..."}]'
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-xs font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCookies(!showCookies)}
                                            className="absolute right-2 top-2 text-xs text-gray-500 hover:text-gray-700 bg-white px-2 py-1 rounded"
                                        >
                                            {showCookies ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Export cookies từ trình duyệt. Xem hướng dẫn trong HUONG_DAN_COOKIES.md
                                    </p>
                                </div>

                                {/* Or Email/Password */}
                                <div className="border-t border-cyan-200 pt-3">
                                    <p className="text-xs text-cyan-700 mb-2">Hoặc sử dụng Email/Password:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="email"
                                            value={config.fb_email || ''}
                                            onChange={(e) => setConfig(prev => ({ ...prev, fb_email: e.target.value }))}
                                            placeholder="Facebook Email"
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                                        />
                                        <input
                                            type="password"
                                            value={config.fb_password || ''}
                                            onChange={(e) => setConfig(prev => ({ ...prev, fb_password: e.target.value }))}
                                            placeholder="Password"
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                                        />
                                    </div>
                                    <p className="text-xs text-orange-600 mt-1">
                                        ⚠️ Có thể gặp 2FA. Khuyên dùng Cookies.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Unhide Comments Section */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-amber-900 flex items-center gap-2">
                                    👁️ Unhide Hidden Comments
                                </h4>
                                <p className="text-xs text-amber-700 mt-1">
                                    Tự động bỏ ẩn các comment bị Facebook đánh dấu spam
                                </p>
                            </div>
                            <button
                                onClick={unhideAllComments}
                                disabled={unhideLoading || !config.access_token || !config.page_id}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {unhideLoading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        Scanning...
                                    </span>
                                ) : (
                                    '🔓 Unhide All'
                                )}
                            </button>
                        </div>

                        {unhideResult && (
                            <div className="mt-3 p-2 bg-white rounded border border-amber-200">
                                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                    <div>
                                        <p className="text-gray-500">Posts Scanned</p>
                                        <p className="font-bold text-gray-900">{unhideResult.postsScanned}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Unhidden</p>
                                        <p className="font-bold text-green-600">{unhideResult.totalUnhidden}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Failed</p>
                                        <p className="font-bold text-red-600">{unhideResult.totalFailed}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
                    >
                        {saving ? 'Saving...' : '💾 Save Configuration'}
                    </button>
                </div>

                {/* Right Column - Status & Logs */}
                <div className="space-y-4">
                    {/* Status Cards */}
                    <h3 className="font-medium text-gray-900">📊 Status</h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Last Run</p>
                            <p className="font-medium text-gray-900">
                                {formatDate(status?.lastRunAt || null)}
                            </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Next Run</p>
                            <p className="font-medium text-gray-900">
                                {status?.enabled ? getTimeUntilNextRun() || formatDate(status?.nextRunAt || null) : 'Disabled'}
                            </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Interval</p>
                            <p className="font-medium text-gray-900">
                                {status?.intervalMinutes || 30} minutes
                            </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Config Valid</p>
                            <p className="font-medium text-gray-900">
                                {status?.hasValidConfig ? '✅ Yes' : '❌ No'}
                            </p>
                        </div>
                    </div>

                    {/* Logs */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-gray-900">📋 Recent Logs</h3>
                            <button
                                onClick={fetchStatus}
                                className="text-xs text-blue-500 hover:text-blue-700"
                            >
                                Refresh
                            </button>
                        </div>
                        <div className="h-64 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-xs">
                            {logs.length === 0 ? (
                                <p className="text-gray-500">No logs yet</p>
                            ) : (
                                logs.map((log, index) => (
                                    <div key={log.id || index} className="mb-1">
                                        <span className="text-gray-500">
                                            {new Date(log.created_at).toLocaleTimeString('vi-VN')}
                                        </span>
                                        {' '}
                                        <span className={
                                            log.type === 'error' ? 'text-red-400' :
                                                log.type === 'success' ? 'text-green-400' :
                                                    log.type === 'warning' ? 'text-yellow-400' :
                                                        'text-blue-400'
                                        }>
                                            [{log.type.toUpperCase()}]
                                        </span>
                                        {' '}
                                        <span className="text-gray-300">{log.message}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
