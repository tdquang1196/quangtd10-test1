export interface Feature {
  id: string
  title: string
  description: string
  icon: string
  color: string
  gradient: string
  route: string
  status: 'active' | 'coming-soon' | 'beta'
  category: 'data' | 'reports' | 'analytics' | 'admin' | 'tools'
}

export const FEATURES: Feature[] = [
  {
    id: 'user-migration',
    title: 'User Migration',
    description: 'Bulk user migration from Excel files with Vietnamese text support. Import students and teachers with automatic username generation.',
    icon: '👥',
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    route: '/features/user-migration',
    status: 'active',
    category: 'data'
  },
  {
    id: 'batch-send-package',
    title: 'Batch Send Package',
    description: 'Send packages to multiple users in batch. Search by username or use direct user IDs with progress tracking and retry mechanism.',
    icon: '📦',
    color: 'indigo',
    gradient: 'from-indigo-500 to-purple-600',
    route: '/features/batch-send-package',
    status: 'active',
    category: 'tools'
  }
]

export const FEATURE_CATEGORIES = [
  { id: 'all', label: 'All Features', icon: '🎯' },
  { id: 'data', label: 'Data Management', icon: '💾' },
  { id: 'reports', label: 'Reports', icon: '📋' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'admin', label: 'Administration', icon: '⚙️' },
  { id: 'tools', label: 'Tools', icon: '🛠️' }
] as const
