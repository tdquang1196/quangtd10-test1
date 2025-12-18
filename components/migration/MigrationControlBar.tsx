'use client'

import { MigrationStatus } from '@/lib/migrationService'

interface MigrationControlBarProps {
    status: MigrationStatus
    progress: number
    phase?: string
    canResume: boolean
    onPause: () => void
    onResume: () => void
    onCancel: () => void
    onClearSaved: () => void
    isVisible: boolean
}

const phaseLabels: Record<string, string> = {
    registration: 'Đăng ký tài khoản',
    login: 'Đăng nhập',
    initialization: 'Khởi tạo nhân vật',
    classes: 'Tạo lớp học',
    roles: 'Gán quyền giáo viên',
    completed: 'Hoàn thành',
}

export default function MigrationControlBar({
    status,
    progress,
    phase,
    canResume,
    onPause,
    onResume,
    onCancel,
    onClearSaved,
    isVisible,
}: MigrationControlBarProps) {
    if (!isVisible) return null

    const getStatusColor = () => {
        switch (status) {
            case 'running': return 'from-blue-500 to-indigo-600'
            case 'paused': return 'from-amber-500 to-orange-500'
            case 'cancelled': return 'from-red-500 to-rose-600'
            case 'completed': return 'from-green-500 to-emerald-600'
            default: return 'from-gray-400 to-gray-500'
        }
    }

    const getStatusIcon = () => {
        switch (status) {
            case 'running': return '🔄'
            case 'paused': return '⏸️'
            case 'cancelled': return '❌'
            case 'completed': return '✅'
            default: return '⏳'
        }
    }

    const getStatusLabel = () => {
        switch (status) {
            case 'running': return 'Đang chạy'
            case 'paused': return 'Tạm dừng'
            case 'cancelled': return 'Đã hủy'
            case 'completed': return 'Hoàn thành'
            default: return 'Chờ'
        }
    }

    return (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
            {/* Progress bar */}
            <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div
                    className={`absolute left-0 top-0 h-full bg-gradient-to-r ${getStatusColor()} transition-all duration-500 ease-out`}
                    style={{ width: `${progress}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white drop-shadow-sm">
                        {progress}%
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between">
                {/* Status info */}
                <div className="flex items-center gap-4">
                    <div className={`px-3 py-1.5 rounded-full bg-gradient-to-r ${getStatusColor()} text-white text-sm font-semibold flex items-center gap-2 shadow-sm`}>
                        <span>{getStatusIcon()}</span>
                        <span>{getStatusLabel()}</span>
                    </div>

                    {phase && phase !== 'completed' && (
                        <div className="text-sm text-gray-600">
                            <span className="font-medium">Phase:</span>{' '}
                            <span className="text-gray-900">{phaseLabels[phase] || phase}</span>
                        </div>
                    )}
                </div>

                {/* Control buttons */}
                <div className="flex items-center gap-2">
                    {/* Pause button - show when running */}
                    {status === 'running' && (
                        <button
                            onClick={onPause}
                            className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                            Tạm dừng
                        </button>
                    )}

                    {/* Resume button - show when paused */}
                    {status === 'paused' && (
                        <button
                            onClick={onResume}
                            className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                            Tiếp tục
                        </button>
                    )}

                    {/* Cancel button - show when running or paused */}
                    {(status === 'running' || status === 'paused') && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Hủy
                        </button>
                    )}

                    {/* Resume saved state button - show when idle and has saved state */}
                    {status === 'idle' && canResume && (
                        <>
                            <button
                                onClick={onResume}
                                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.65 6.35A7.958 7.958 0 0012 4a8 8 0 108 8h-2a6 6 0 11-6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                                </svg>
                                Tiếp tục migration
                            </button>
                            <button
                                onClick={onClearSaved}
                                className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-sm transition-colors"
                                title="Xóa dữ liệu đã lưu"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
