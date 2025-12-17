'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface SchedulerStatus {
    isRunning: boolean;
    currentRun: number;
    maxRuns: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
}

interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
}

export default function FBAutoCommentPage() {
    // Config state
    const [accessToken, setAccessToken] = useState('');
    const [pageId, setPageId] = useState('');
    const [delay, setDelay] = useState(5);

    // Comments state
    const [comments, setComments] = useState<string[]>([]);
    const [newComment, setNewComment] = useState('');

    // Scheduler state
    const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
    const [intervalSeconds, setIntervalSeconds] = useState(60);
    const [maxRuns, setMaxRuns] = useState(0);
    const [scanMode, setScanMode] = useState<'full' | 'continue'>('continue');
    const [scanState, setScanState] = useState<{
        lastScanAt: string | null;
        lastProcessedPostTime: string | null;
        totalPostsProcessed: number;
    } | null>(null);
    const [isProcessRunning, setIsProcessRunning] = useState(false);

    // Logs state
    const [logs, setLogs] = useState<LogEntry[]>([]);

    // Failed posts state
    interface FailedPost {
        postId: string;
        postPreview: string;
        error: string;
        timestamp: string;
        resolved: boolean;
    }
    const [failedPosts, setFailedPosts] = useState<FailedPost[]>([]);

    // Private posts state (Only Me posts that are skipped)
    interface PrivatePost {
        postId: string;
        postPreview: string;
        privacy: string;
        timestamp: string;
    }
    const [privatePosts, setPrivatePosts] = useState<PrivatePost[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [pageName, setPageName] = useState('');

    // Polling interval ref
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Client-side scheduler (runs in browser)
    const schedulerRef = useRef<NodeJS.Timeout | null>(null);
    const [schedulerRunCount, setSchedulerRunCount] = useState(0);

    // Load data on mount (only once)
    useEffect(() => {
        loadData();
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
            if (schedulerRef.current) {
                clearInterval(schedulerRef.current);
            }
        };
    }, []);

    // Start/stop polling based on running state
    useEffect(() => {
        if (isProcessRunning || schedulerStatus?.isRunning) {
            // Start polling when running
            if (!pollingRef.current) {
                pollingRef.current = setInterval(refreshStatus, 2000); // Faster when running
            }
        } else {
            // Stop polling when not running
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        }
    }, [isProcessRunning, schedulerStatus?.isRunning]);

    // Load data from localStorage on mount
    const loadData = async () => {
        // Load from localStorage
        try {
            const savedConfig = localStorage.getItem('fb-auto-comment-config');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                setAccessToken(config.accessToken || '');
                setPageId(config.pageId || '');
                setDelay(config.delayBetweenComments || 5);
            }

            const savedComments = localStorage.getItem('fb-auto-comment-comments');
            if (savedComments) {
                const rawComments: string[] = JSON.parse(savedComments) || [];
                const uniqueComments = [...new Set(rawComments)];
                setComments(uniqueComments);
            }

            const savedLogs = localStorage.getItem('fb-auto-comment-logs');
            if (savedLogs) {
                setLogs(JSON.parse(savedLogs) || []);
            }

            const savedScanState = localStorage.getItem('fb-auto-comment-scan-state');
            if (savedScanState) {
                setScanState(JSON.parse(savedScanState));
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }

        // Check server status
        try {
            const statusRes = await fetch('/api/fb-auto-comment/scheduler');
            const statusData = await statusRes.json();
            setSchedulerStatus(statusData.status);
            setIsProcessRunning(statusData.isProcessRunning || false);
        } catch (error) {
            console.error('Error checking server status:', error);
        }
    };

    // Save to localStorage helpers
    const saveToLocalStorage = (key: string, data: any) => {
        try {
            localStorage.setItem(`fb-auto-comment-${key}`, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    };

    const refreshStatus = async () => {
        try {
            const statusRes = await fetch('/api/fb-auto-comment/scheduler');
            const statusData = await statusRes.json();

            setIsProcessRunning(statusData.isProcessRunning || false);

            // Always update logs from server
            if (statusData.logs && statusData.logs.length > 0) {
                setLogs(statusData.logs);
                saveToLocalStorage('logs', statusData.logs);
            }

            // Update failed posts
            if (statusData.failedPosts) {
                setFailedPosts(statusData.failedPosts);
            }

            // Update private posts
            if (statusData.privatePosts) {
                setPrivatePosts(statusData.privatePosts);
            }
        } catch (error) {
            console.error('Error refreshing status:', error);
        }
    };

    const saveConfig = () => {
        const config = { accessToken, pageId, delayBetweenComments: delay };
        saveToLocalStorage('config', config);
        // Show feedback
        setLoading(true);
        setTimeout(() => setLoading(false), 300);
    };

    const verifyConnection = async () => {
        setVerifying(true);
        setConnectionStatus('idle');
        try {
            const res = await fetch('/api/fb-auto-comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verifyAccess',
                    data: { accessToken, pageId },
                }),
            });
            const data = await res.json();

            if (data.success) {
                setConnectionStatus('success');
                setPageName(data.pageName);
                // Save config on successful verify
                saveConfig();
            } else {
                setConnectionStatus('error');
            }
        } catch (error) {
            setConnectionStatus('error');
        }
        setVerifying(false);
    };

    const addComment = () => {
        if (!newComment.trim()) return;
        if (comments.includes(newComment.trim())) return;

        const updated = [...comments, newComment.trim()];
        setComments(updated);
        setNewComment('');
        saveToLocalStorage('comments', updated);
    };

    const removeComment = (index: number) => {
        const updated = comments.filter((_, i) => i !== index);
        setComments(updated);
        saveToLocalStorage('comments', updated);
    };

    const moveComment = (index: number, direction: number) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= comments.length) return;

        const updated = [...comments];
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
        setComments(updated);
        saveToLocalStorage('comments', updated);
    };

    const runOnce = async () => {
        if (!accessToken || !pageId) {
            alert('Vui lòng cấu hình Access Token và Page ID trước!');
            return;
        }
        if (comments.length === 0) {
            alert('Vui lòng thêm ít nhất 1 comment!');
            return;
        }

        setLoading(true);
        setIsProcessRunning(true);

        // Start polling for logs
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/fb-auto-comment/scheduler');
                const data = await res.json();
                if (data.logs && data.logs.length > 0) {
                    setLogs(data.logs);
                }
                setIsProcessRunning(data.isProcessRunning || false);
            } catch (e) { }
        }, 1000);

        try {
            // Get scan state from localStorage
            const savedScanState = localStorage.getItem('fb-auto-comment-scan-state');
            const currentScanState = savedScanState ? JSON.parse(savedScanState) : null;

            // Send config, comments, and scan state to server
            const res = await fetch('/api/fb-auto-comment/scheduler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'runOnce',
                    scanMode,
                    config: { accessToken, pageId, delayBetweenComments: delay },
                    comments,
                    scanState: currentScanState,
                }),
            });
            const data = await res.json();

            // Update logs from response
            if (data.logs && data.logs.length > 0) {
                setLogs(data.logs);
                saveToLocalStorage('logs', data.logs);
            }

            // Save new scan state to localStorage
            if (data.scanState) {
                saveToLocalStorage('scan-state', data.scanState);
                setScanState(data.scanState);
            }
        } catch (error) {
            console.error('Error running:', error);
        }

        clearInterval(pollInterval);
        setLoading(false);
        setIsProcessRunning(false);
    };

    // Execute one scheduled run
    const executeScheduledRun = async () => {
        if (!accessToken || !pageId || comments.length === 0) return;

        setLoading(true);
        try {
            // Get scan state from localStorage
            const savedScanState = localStorage.getItem('fb-auto-comment-scan-state');
            const currentScanState = savedScanState ? JSON.parse(savedScanState) : null;

            const res = await fetch('/api/fb-auto-comment/scheduler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'runOnce',
                    scanMode,
                    config: { accessToken, pageId, delayBetweenComments: delay },
                    comments,
                    scanState: currentScanState,
                }),
            });
            const data = await res.json();
            if (data.logs) {
                setLogs(data.logs);
                saveToLocalStorage('logs', data.logs);
            }
            // Save new scan state
            if (data.scanState) {
                saveToLocalStorage('scan-state', data.scanState);
                setScanState(data.scanState);
            }
        } catch (error) {
            console.error('Error in scheduled run:', error);
        }
        setLoading(false);
    };

    const startScheduler = () => {
        if (!accessToken || !pageId) {
            alert('Vui lòng cấu hình Access Token và Page ID trước!');
            return;
        }
        if (comments.length === 0) {
            alert('Vui lòng thêm ít nhất 1 comment!');
            return;
        }
        if (schedulerRef.current) {
            return; // Already running
        }

        // Update status
        setSchedulerStatus({
            isRunning: true,
            currentRun: 0,
            maxRuns,
            lastRunAt: null,
            nextRunAt: new Date(Date.now() + 1000).toISOString(),
        });
        setSchedulerRunCount(0);

        // Run first time after 1 second
        setTimeout(async () => {
            await executeScheduledRun();
            setSchedulerRunCount(1);
            setSchedulerStatus(prev => prev ? {
                ...prev,
                currentRun: 1,
                lastRunAt: new Date().toISOString(),
                nextRunAt: new Date(Date.now() + intervalSeconds * 1000).toISOString(),
            } : null);
        }, 1000);

        // Setup interval for subsequent runs
        schedulerRef.current = setInterval(async () => {
            setSchedulerRunCount(prev => {
                const newCount = prev + 1;

                // Check if should stop
                if (maxRuns > 0 && newCount > maxRuns) {
                    stopScheduler();
                    return prev;
                }

                // Update status and run
                setSchedulerStatus(s => s ? {
                    ...s,
                    currentRun: newCount,
                    lastRunAt: new Date().toISOString(),
                    nextRunAt: new Date(Date.now() + intervalSeconds * 1000).toISOString(),
                } : null);

                executeScheduledRun();
                return newCount;
            });
        }, intervalSeconds * 1000);
    };

    const stopScheduler = () => {
        if (schedulerRef.current) {
            clearInterval(schedulerRef.current);
            schedulerRef.current = null;
        }
        setSchedulerStatus(prev => prev ? {
            ...prev,
            isRunning: false,
            nextRunAt: null,
        } : null);

        // Also abort any running process on server
        fetch('/api/fb-auto-comment/scheduler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'abort' }),
        }).catch(() => { });
    };

    const abortProcess = async () => {
        try {
            await fetch('/api/fb-auto-comment/scheduler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'abort' }),
            });
            // Faster polling to see abort result
            setTimeout(refreshStatus, 500);
            setTimeout(refreshStatus, 1500);
        } catch (error) {
            console.error('Error aborting:', error);
        }
    };

    const clearLogs = async () => {
        try {
            await fetch('/api/fb-auto-comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clearLogs' }),
            });
            setLogs([]);
            saveToLocalStorage('logs', []);
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    };

    const resolveFailedPost = async (postId: string) => {
        try {
            const res = await fetch('/api/fb-auto-comment/scheduler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resolveFailedPost', postId }),
            });
            const data = await res.json();
            if (data.failedPosts) {
                setFailedPosts(data.failedPosts);
            }
        } catch (error) {
            console.error('Error resolving failed post:', error);
        }
    };

    const clearFailedPosts = async () => {
        try {
            const res = await fetch('/api/fb-auto-comment/scheduler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clearFailedPosts' }),
            });
            const data = await res.json();
            setFailedPosts([]);
        } catch (error) {
            console.error('Error clearing failed posts:', error);
        }
    };

    const removePrivatePost = async (postId: string) => {
        try {
            const res = await fetch('/api/fb-auto-comment/scheduler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'removePrivatePost', postId }),
            });
            const data = await res.json();
            if (data.privatePosts) {
                setPrivatePosts(data.privatePosts);
            }
        } catch (error) {
            console.error('Error removing private post:', error);
        }
    };

    const clearPrivatePosts = async () => {
        try {
            const res = await fetch('/api/fb-auto-comment/scheduler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clearPrivatePosts' }),
            });
            const data = await res.json();
            setPrivatePosts([]);
        } catch (error) {
            console.error('Error clearing private posts:', error);
        }
    };

    const exportComments = () => {
        const content = comments.join('\n===COMMENT_SEPARATOR===\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fb-comments-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importComments = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            let imported: string[];

            if (content.includes('===COMMENT_SEPARATOR===')) {
                imported = content.split('===COMMENT_SEPARATOR===').map(c => c.trim()).filter(c => c);
            } else {
                imported = content.split('\n').map(c => c.trim()).filter(c => c);
            }

            const updated = [...comments];
            imported.forEach(c => {
                if (!updated.includes(c)) updated.push(c);
            });

            setComments(updated);
            saveToLocalStorage('comments', updated);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/" className="text-blue-600 hover:underline mb-4 inline-block">
                        ← Quay lại
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">💬 FB Auto Comment</h1>
                    <p className="text-gray-600 mt-2">
                        Tự động comment vào tất cả posts/reels của Facebook Page
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Config Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="text-xl">⚙️</span> Cấu hình
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Page Access Token
                                </label>
                                <input
                                    type="password"
                                    value={accessToken}
                                    onChange={(e) => setAccessToken(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="EAAxxxxxxx..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Page ID
                                </label>
                                <input
                                    type="text"
                                    value={pageId}
                                    onChange={(e) => setPageId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="123456789"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Delay giữa mỗi comment (giây)
                                </label>
                                <input
                                    type="number"
                                    value={delay}
                                    onChange={(e) => setDelay(Number(e.target.value))}
                                    min={1}
                                    max={60}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {connectionStatus === 'success' && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                                    ✅ Kết nối thành công với Page: <strong>{pageName}</strong>
                                </div>
                            )}

                            {connectionStatus === 'error' && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    ❌ Lỗi kết nối! Kiểm tra lại Access Token và Page ID.
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={verifyConnection}
                                    disabled={verifying || !accessToken || !pageId}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition disabled:opacity-50"
                                >
                                    {verifying ? '🔄 Đang kiểm tra...' : '🔐 Kiểm tra kết nối'}
                                </button>
                                <button
                                    onClick={saveConfig}
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                                >
                                    💾 Lưu config
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Comments Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="text-xl">💬</span> Danh sách Comments ({comments.length})
                        </h2>

                        <div className="max-h-64 overflow-y-auto mb-4 space-y-2">
                            {comments.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <div className="text-4xl mb-2">📝</div>
                                    <div>Chưa có comment nào</div>
                                </div>
                            ) : (
                                comments.map((comment, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
                                    >
                                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                            {index + 1}
                                        </span>
                                        <span className="flex-1 text-sm whitespace-pre-wrap break-words">
                                            {comment}
                                        </span>
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => moveComment(index, -1)}
                                                disabled={index === 0}
                                                className="w-6 h-6 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                            >
                                                ▲
                                            </button>
                                            <button
                                                onClick={() => moveComment(index, 1)}
                                                disabled={index === comments.length - 1}
                                                className="w-6 h-6 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                            >
                                                ▼
                                            </button>
                                            <button
                                                onClick={() => removeComment(index)}
                                                className="w-6 h-6 text-red-400 hover:text-red-600"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="space-y-3">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                placeholder="Nhập comment mới (hỗ trợ nhiều dòng và emoji 🔥)"
                            />
                            <button
                                onClick={addComment}
                                disabled={!newComment.trim()}
                                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                            >
                                ➕ Thêm Comment
                            </button>

                            <div className="flex gap-2">
                                <button
                                    onClick={exportComments}
                                    disabled={comments.length === 0}
                                    className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition disabled:opacity-50"
                                >
                                    📥 Export TXT
                                </button>
                                <label className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-center cursor-pointer">
                                    📤 Import TXT
                                    <input type="file" accept=".txt" onChange={importComments} className="hidden" />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Control Card - Full Width */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <span className="text-xl">🚀</span> Điều khiển
                            </h2>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${schedulerStatus?.isRunning
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                                }`}>
                                {schedulerStatus?.isRunning ? '🟢 Scheduler đang chạy' : '⚪ Sẵn sàng'}
                            </div>
                        </div>

                        {/* Scan Mode Selector */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100">
                            <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                🔍 Chế độ quét
                            </h3>
                            <div className="flex flex-wrap gap-4 mb-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="scanMode"
                                        value="continue"
                                        checked={scanMode === 'continue'}
                                        onChange={() => setScanMode('continue')}
                                        disabled={schedulerStatus?.isRunning}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm text-gray-700">
                                        <strong>⏩ Quét tiếp</strong> - Chỉ xử lý posts mới
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="scanMode"
                                        value="full"
                                        checked={scanMode === 'full'}
                                        onChange={() => setScanMode('full')}
                                        disabled={schedulerStatus?.isRunning}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm text-gray-700">
                                        <strong>🔄 Quét toàn bộ</strong> - Xử lý tất cả posts từ đầu
                                    </span>
                                </label>
                            </div>
                            {scanState && scanState.lastScanAt && (
                                <div className="text-xs text-blue-600 bg-blue-100 rounded px-2 py-1 inline-block">
                                    📊 Lần quét cuối: {new Date(scanState.lastScanAt).toLocaleString('vi-VN')}
                                    {scanState.totalPostsProcessed > 0 && (
                                        <span> • Đã xử lý {scanState.totalPostsProcessed} posts</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Main Actions */}
                        <div className="flex flex-wrap gap-3 mb-6">
                            {isProcessRunning || loading ? (
                                <button
                                    onClick={abortProcess}
                                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl font-semibold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-200 animate-pulse"
                                >
                                    ⛔ Dừng ngay
                                </button>
                            ) : (
                                <button
                                    onClick={runOnce}
                                    disabled={schedulerStatus?.isRunning}
                                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
                                >
                                    {scanMode === 'full' ? '🔄 Chạy toàn bộ' : '⏩ Chạy tiếp'}
                                </button>
                            )}
                            <button
                                onClick={clearLogs}
                                className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold border border-gray-200 shadow-sm hover:shadow transition-all duration-200"
                            >
                                🗑️ Xóa logs
                            </button>
                            {isProcessRunning && (
                                <span className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium">
                                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                                    Đang xử lý...
                                </span>
                            )}
                        </div>

                        {/* Scheduler Section */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                ⏰ Hẹn giờ tự động
                            </h3>
                            <div className="flex flex-wrap items-end gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Chạy lại mỗi</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={intervalSeconds}
                                            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                                            min={10}
                                            max={3600}
                                            disabled={schedulerStatus?.isRunning}
                                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                                        />
                                        <span className="text-sm text-gray-500">giây</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Số lần lặp</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={maxRuns}
                                            onChange={(e) => setMaxRuns(Number(e.target.value))}
                                            min={0}
                                            max={100}
                                            disabled={schedulerStatus?.isRunning}
                                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                                        />
                                        <span className="text-sm text-gray-500">(0 = vô hạn)</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={startScheduler}
                                        disabled={schedulerStatus?.isRunning}
                                        className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
                                    >
                                        ⏰ Bắt đầu hẹn giờ
                                    </button>
                                    <button
                                        onClick={stopScheduler}
                                        disabled={!schedulerStatus?.isRunning}
                                        className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
                                    >
                                        ⏹️ Dừng
                                    </button>
                                </div>
                            </div>
                            {schedulerStatus?.isRunning && (
                                <div className="mt-3 text-sm text-green-600">
                                    🔄 Đã chạy {schedulerStatus.currentRun}{schedulerStatus.maxRuns > 0 ? `/${schedulerStatus.maxRuns}` : ''} lần
                                    {schedulerStatus.lastRunAt && (
                                        <span className="text-gray-500"> • Lần cuối: {new Date(schedulerStatus.lastRunAt).toLocaleTimeString('vi-VN')}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Failed Posts Section */}
                        {failedPosts.filter(fp => !fp.resolved).length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                                        ⚠️ Bài viết lỗi ({failedPosts.filter(fp => !fp.resolved).length})
                                    </h3>
                                    <button
                                        onClick={clearFailedPosts}
                                        className="text-xs text-red-600 hover:text-red-700 underline"
                                    >
                                        Xóa tất cả
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {failedPosts.filter(fp => !fp.resolved).map((fp) => (
                                        <div
                                            key={fp.postId}
                                            className="bg-white rounded-lg p-3 border border-red-100 flex items-start justify-between gap-3"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-800 truncate">
                                                    {fp.postPreview}
                                                </div>
                                                <div className="text-xs text-red-600 mt-1">
                                                    {fp.error}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {new Date(fp.timestamp).toLocaleString('vi-VN')}
                                                </div>
                                                <a
                                                    href={`https://facebook.com/${fp.postId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                                                >
                                                    🔗 Xem trên Facebook
                                                </a>
                                            </div>
                                            <button
                                                onClick={() => resolveFailedPost(fp.postId)}
                                                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                                            >
                                                ✓ Đã xử lý
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Private Posts Section */}
                        {privatePosts.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                                        🔒 Bài viết riêng tư - đang skip ({privatePosts.length})
                                    </h3>
                                    <button
                                        onClick={clearPrivatePosts}
                                        className="text-xs text-amber-600 hover:text-amber-700 underline"
                                    >
                                        Xóa tất cả (cho phép retry)
                                    </button>
                                </div>
                                <p className="text-xs text-amber-600 mb-3">
                                    Những bài này sẽ được skip tự động. Nếu đã đổi privacy, bấm "Retry" để thử lại.
                                </p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {privatePosts.map((pp) => (
                                        <div
                                            key={pp.postId}
                                            className="bg-white rounded-lg p-3 border border-amber-100 flex items-start justify-between gap-3"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-800 truncate">
                                                    {pp.postPreview}
                                                </div>
                                                <div className="text-xs text-amber-600 mt-1">
                                                    Lý do: {pp.privacy === 'SELF' ? 'Only Me' : pp.privacy}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {new Date(pp.timestamp).toLocaleString('vi-VN')}
                                                </div>
                                                <a
                                                    href={`https://facebook.com/${pp.postId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                                                >
                                                    🔗 Xem trên Facebook
                                                </a>
                                            </div>
                                            <button
                                                onClick={() => removePrivatePost(pp.postId)}
                                                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                                            >
                                                🔄 Retry
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Logs */}
                        <div className="bg-slate-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-sm border border-slate-700">
                            {logs.length === 0 ? (
                                <div className="text-slate-400 text-center py-4">📋 Chưa có logs</div>
                            ) : (
                                logs.slice(-100).reverse().map((log, index) => (
                                    <div
                                        key={index}
                                        className={`py-1.5 px-2 rounded mb-1 ${log.type === 'success' ? 'text-emerald-300 bg-emerald-500/10' :
                                            log.type === 'error' ? 'text-red-300 bg-red-500/10' :
                                                log.type === 'warning' ? 'text-amber-300 bg-amber-500/10' :
                                                    'text-sky-300 bg-sky-500/10'
                                            }`}
                                    >
                                        <span className="text-slate-400 mr-2">
                                            [{new Date(log.timestamp).toLocaleTimeString('vi-VN')}]
                                        </span>
                                        {log.message}
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
