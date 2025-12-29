/**
 * Migration State Management
 * Handles pause/resume/cancel functionality with localStorage persistence
 */

import { MigrationService } from '@/lib/migrationService'

// Store the active migration service instance
// In a production app, you might want to use Redis or similar for cross-process state
let activeMigrationService: MigrationService | null = null

export function setActiveMigrationService(service: MigrationService | null) {
    activeMigrationService = service
}

export function getActiveMigrationService(): MigrationService | null {
    return activeMigrationService
}

// Migration execution status
export type MigrationStatus = 'idle' | 'running' | 'paused' | 'cancelled' | 'completed'

// Current migration phase
export type MigrationPhase = 'registration' | 'login' | 'initialization' | 'classes' | 'roles' | 'completed'

// User data structure (matching migrationService.ts UserData)
export interface MigrationUserData {
    id?: string
    username: string
    actualUserName?: string
    displayName: string
    actualDisplayName?: string
    classses: string
    password: string
    phoneNumber: string
    reason?: string
    grade?: number
    accessToken?: string
    loginDisplayName?: string
    state?: {
        registered?: boolean
        loggedIn?: boolean
        equipmentSet?: boolean
        phoneUpdated?: boolean
    }
    retryCount?: number
}

// Full migration state (serializable to localStorage)
export interface MigrationState {
    // Session identifier
    sessionId: string

    // Status
    status: MigrationStatus
    startTime: number
    lastUpdated: number

    // Current phase tracking
    currentPhase: MigrationPhase
    currentUserIndex: number // Index within current phase

    // Progress tracking
    totalUsers: number
    processedRegistrations: number
    processedLogins: number
    processedInits: number
    processedClasses: number

    // Data snapshots
    students: MigrationUserData[]
    teachers: MigrationUserData[]
    classes: any[]
    listUserError: MigrationUserData[]
    listClassError: any[]

    // School info
    schoolPrefix: string

    // Batch mode info (optional)
    batchMode?: boolean
    batchIndex?: number
    totalBatches?: number
}

// LocalStorage key
const MIGRATION_STATE_KEY = 'migration_state'

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
    const timestamp = Date.now().toString(36)
    const randomPart = Math.random().toString(36).substring(2, 8)
    return `mig_${timestamp}_${randomPart}`
}

/**
 * Save migration state to localStorage
 */
export function saveMigrationState(state: MigrationState): void {
    try {
        state.lastUpdated = Date.now()
        localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state))
        console.log(`[MigrationState] Saved state: phase=${state.currentPhase}, status=${state.status}`)
    } catch (error) {
        console.error('[MigrationState] Failed to save state:', error)
    }
}

/**
 * Load migration state from localStorage
 */
export function loadMigrationState(): MigrationState | null {
    try {
        const data = localStorage.getItem(MIGRATION_STATE_KEY)
        if (!data) return null

        const state = JSON.parse(data) as MigrationState
        console.log(`[MigrationState] Loaded state: sessionId=${state.sessionId}, phase=${state.currentPhase}, status=${state.status}`)
        return state
    } catch (error) {
        console.error('[MigrationState] Failed to load state:', error)
        return null
    }
}

/**
 * Clear migration state from localStorage
 */
export function clearMigrationState(): void {
    try {
        localStorage.removeItem(MIGRATION_STATE_KEY)
        console.log('[MigrationState] Cleared state')
    } catch (error) {
        console.error('[MigrationState] Failed to clear state:', error)
    }
}

/**
 * Check if there's a resumable migration state
 */
export function hasResumableState(): boolean {
    const state = loadMigrationState()
    if (!state) return false

    // Only paused or cancelled (mid-process) states are resumable
    return state.status === 'paused' ||
        (state.status === 'cancelled' && state.currentPhase !== 'completed')
}

/**
 * Create initial migration state
 */
export function createInitialState(
    students: MigrationUserData[],
    teachers: MigrationUserData[],
    classes: any[],
    schoolPrefix: string,
    batchInfo?: { batchIndex: number; totalBatches: number }
): MigrationState {
    return {
        sessionId: generateSessionId(),
        status: 'running',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        currentPhase: 'registration',
        currentUserIndex: 0,
        totalUsers: students.length + teachers.length,
        processedRegistrations: 0,
        processedLogins: 0,
        processedInits: 0,
        processedClasses: 0,
        students,
        teachers,
        classes,
        listUserError: [],
        listClassError: [],
        schoolPrefix,
        batchMode: !!batchInfo,
        batchIndex: batchInfo?.batchIndex,
        totalBatches: batchInfo?.totalBatches,
    }
}

/**
 * Get progress percentage (0-100)
 */
export function getProgressPercentage(state: MigrationState): number {
    if (state.totalUsers === 0) return 0

    // Weight each phase
    const weights = {
        registration: 0.3,
        login: 0.2,
        initialization: 0.3,
        classes: 0.15,
        roles: 0.05,
    }

    let progress = 0

    // Registration phase
    progress += (state.processedRegistrations / state.totalUsers) * weights.registration * 100

    // Login phase
    progress += (state.processedLogins / state.totalUsers) * weights.login * 100

    // Initialization phase
    progress += (state.processedInits / state.totalUsers) * weights.initialization * 100

    // Classes phase
    if (state.classes.length > 0) {
        progress += (state.processedClasses / state.classes.length) * weights.classes * 100
    } else {
        progress += weights.classes * 100
    }

    // Roles phase (counted as complete if we're past it)
    if (state.currentPhase === 'completed') {
        progress += weights.roles * 100
    }

    return Math.min(100, Math.round(progress))
}

/**
 * Get human-readable status message
 */
export function getStatusMessage(state: MigrationState): string {
    const phase = state.currentPhase
    const status = state.status

    if (status === 'paused') {
        return `Đã tạm dừng tại ${getPhaseLabel(phase)} (${getProgressPercentage(state)}%)`
    }

    if (status === 'cancelled') {
        return `Đã hủy tại ${getPhaseLabel(phase)}`
    }

    if (status === 'completed') {
        return 'Hoàn thành migration'
    }

    return `Đang xử lý ${getPhaseLabel(phase)}...`
}

function getPhaseLabel(phase: MigrationPhase): string {
    const labels: Record<MigrationPhase, string> = {
        registration: 'Đăng ký tài khoản',
        login: 'Đăng nhập',
        initialization: 'Khởi tạo nhân vật',
        classes: 'Tạo lớp học',
        roles: 'Gán quyền giáo viên',
        completed: 'Hoàn thành',
    }
    return labels[phase]
}
