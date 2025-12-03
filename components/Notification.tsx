'use client'

import { useEffect } from 'react'
import { NotificationProps } from '@/types'

export default function Notification({ message, type, onClose }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 4000)

    return () => clearTimeout(timer)
  }, [onClose])

  const typeStyles = {
    success: 'bg-gray-900 border-gray-800',
    error: 'bg-red-600 border-red-700',
    warning: 'bg-orange-600 border-orange-700',
    info: 'bg-blue-600 border-blue-700'
  }

  return (
    <div className={`fixed top-4 right-4 ${typeStyles[type]} text-white px-4 py-3 rounded-lg shadow-lg z-[9999] max-w-sm border animate-slide-in`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 text-sm">
          {message}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-white/70 hover:text-white transition-colors focus:outline-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <style jsx global>{`
        @keyframes slide-in {
          from {
            transform: translateY(-1rem);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
