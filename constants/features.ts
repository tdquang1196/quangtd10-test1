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
    id: 'data-export',
    title: 'Data Export',
    description: 'Export user data, reports, and analytics to Excel, CSV, or JSON formats with customizable filters.',
    icon: '📊',
    color: 'green',
    gradient: 'from-green-500 to-emerald-600',
    route: '/features/data-export',
    status: 'coming-soon',
    category: 'data'
  },
  {
    id: 'user-reports',
    title: 'User Reports',
    description: 'Generate comprehensive reports on user activity, engagement, and performance metrics.',
    icon: '📈',
    color: 'purple',
    gradient: 'from-purple-500 to-violet-600',
    route: '/features/user-reports',
    status: 'coming-soon',
    category: 'reports'
  },
  {
    id: 'class-management',
    title: 'Class Management',
    description: 'Manage classes, assign teachers, and organize students with intuitive drag-and-drop interface.',
    icon: '🏫',
    color: 'orange',
    gradient: 'from-orange-500 to-red-600',
    route: '/features/class-management',
    status: 'coming-soon',
    category: 'admin'
  },
  {
    id: 'analytics-dashboard',
    title: 'Analytics Dashboard',
    description: 'Real-time analytics and insights with interactive charts and customizable widgets.',
    icon: '📉',
    color: 'cyan',
    gradient: 'from-cyan-500 to-blue-600',
    route: '/features/analytics-dashboard',
    status: 'coming-soon',
    category: 'analytics'
  },
  {
    id: 'bulk-operations',
    title: 'Bulk Operations',
    description: 'Perform bulk actions on users, classes, and data with powerful batch processing.',
    icon: '⚡',
    color: 'yellow',
    gradient: 'from-yellow-500 to-orange-600',
    route: '/features/bulk-operations',
    status: 'coming-soon',
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
