import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const baseClasses = 'inline-flex items-center rounded-full font-medium'

  const variantClasses = {
    success: 'bg-green-100 text-green-800 border border-green-200',
    error: 'bg-red-100 text-red-800 border border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border border-blue-200',
    default: 'bg-gray-100 text-gray-800 border border-gray-200',
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  }

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {children}
    </span>
  )
}
