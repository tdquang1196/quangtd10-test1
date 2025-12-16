// User data types
export interface StudentData {
  fullName: string
  username: string
  displayName: string
  password: string
  grade: string
  className: string
  phoneNumber: string
  warning?: string // Warning message for special characters, etc.
}

export interface TeacherData {
  username: string
  displayName: string
  password: string
  className: string
  warning?: string // Warning message for validation issues
}

// Excel row type
export interface ExcelRow {
  fullName: string
  grade: string
  phoneNumber: string
}

// Migration result types
export interface MigrationUser {
  id?: string
  username: string
  displayName: string
  password: string
  classses: string
  phoneNumber?: string
  actualUserName?: string
}

export interface MigrationError {
  username: string
  displayName: string
  password: string
  classses: string
  phoneNumber?: string
  reason: string
}

export interface MigrationResult {
  ListDataStudent: MigrationUser[]
  ListDataTeacher: MigrationUser[]
  ListDataClasses: any[]
  ListUserError: MigrationError[]
  ListClassError?: any[]
  roleAssignmentError?: string
}

// Component props types
export interface MigrationModalProps {
  isOpen: boolean
  onClose: () => void
}

export interface NotificationProps {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  onClose: () => void
}

// Tab and state types
export type TabType = 'upload' | 'preview' | 'results' | 'batch-upload' | 'batch-preview' | 'batch-results'

export interface NotificationState {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

export interface ProcessedData {
  students: StudentData[]
  teachers: TeacherData[]
  errors: Array<{ row: number; message: string }>
}
