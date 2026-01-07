/**
 * Migration Service Constants
 * 
 * Tất cả các constants liên quan đến Migration Service được đặt ở đây
 * để dễ dàng tìm kiếm và chỉnh sửa.
 */

// ==================== DISPLAY NAME VALIDATION ====================

/** Minimum length for display name */
export const MIN_LENGTH_DISPLAY_NAME = 2

/** Maximum length for display name */
export const MAX_LENGTH_DISPLAY_NAME = 20

// ==================== RATE LIMITING ====================

/** 
 * Number of requests per second for register API 
 * Higher value = faster but may hit rate limits
 */
export const REGISTER_RATE = 2

/** 
 * Number of requests per second for login API 
 * Higher value = faster but may hit rate limits
 */
export const LOGIN_RATE = 2

/** 
 * Maximum number of display name groups to process in parallel 
 * Higher value = faster but uses more resources
 */
export const MAX_CONCURRENT_GROUPS = 2

// ==================== RETRY CONFIGURATION ====================

/** Maximum retries for 503 errors during registration */
export const MAX_503_RETRIES = 100

/** Default delay between retries in milliseconds */
export const RETRY_DELAY_MS = 500

/** Default max retries for retryWithBackoff */
export const DEFAULT_MAX_RETRIES = 3

// ==================== CLASS CONFIGURATION ====================

/** 
 * Default year for class naming and date configuration
 * Change this value when starting a new school year
 */
export const DEFAULT_YEAR = 2025

/** Get current year for class naming - uses DEFAULT_YEAR constant */
export const getCurrentYear = (): number => DEFAULT_YEAR

/** Get class start date (January 1st of DEFAULT_YEAR) */
export const getClassStartDate = (): string => {
    return `${DEFAULT_YEAR}-06-01T00:00:00.000Z`
}

/** Get class end date (April 1st of DEFAULT_YEAR + 1) */
export const getClassEndDate = (): string => {
    return `${DEFAULT_YEAR + 1}-04-01T00:00:00.000Z`
}

/** @deprecated Use getClassStartDate() instead - kept for backward compatibility */
export const DEFAULT_CLASS_START_DATE = getClassStartDate()

/** @deprecated Use getClassEndDate() instead - kept for backward compatibility */
export const DEFAULT_CLASS_END_DATE = getClassEndDate()

// ==================== BATCH PROCESSING ====================

/** Number of students to process in each batch for package assignment */
export const PACKAGE_ASSIGNMENT_BATCH_SIZE = 5

/** Delay between batches in milliseconds */
export const BATCH_DELAY_MS = 300

// ==================== USER STATE TRACKING ====================

/**
 * User state structure for tracking migration progress
 * Used for resume-from-failed-step retry functionality
 */
export interface UserState {
    /** Phase 1: Registration complete */
    registered?: boolean

    /** Phase 2: Login complete */
    loggedIn?: boolean

    /** Phase 3a: Equipment set complete */
    equipmentSet?: boolean

    /** Phase 3b: Phone update complete */
    phoneUpdated?: boolean

    /** Phase 4: Added to group/class complete */
    addedToClass?: boolean

    /** Phase 5: Teacher role assigned (teachers only) */
    roleAssigned?: boolean
}

/**
 * Migration phases - for logging and tracking
 */
export const MIGRATION_PHASES = {
    REGISTRATION: 'registration',
    LOGIN: 'login',
    INITIALIZATION: 'initialization',
    CLASSES: 'classes',
    ROLES: 'roles',
    COMPLETED: 'completed'
} as const

export type MigrationPhase = typeof MIGRATION_PHASES[keyof typeof MIGRATION_PHASES]
