'use client'

import Link from 'next/link'
import { Feature } from '@/constants/features'

interface FeatureCardProps {
  feature: Feature
}

export const FeatureCard: React.FC<FeatureCardProps> = ({ feature }) => {
  const isActive = feature.status === 'active'
  const isBeta = feature.status === 'beta'
  const isComingSoon = feature.status === 'coming-soon'

  const CardWrapper = isActive ? Link : 'div'
  const cardProps = isActive ? { href: feature.route } : {}

  return (
    <CardWrapper {...cardProps}>
      <div className={`group bg-white rounded-lg border border-gray-200 p-5 transition-all ${
        isActive ? 'hover:border-gray-900 hover:shadow-sm cursor-pointer' : 'opacity-60'
      } ${isComingSoon ? 'cursor-not-allowed' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{feature.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-gray-700">
                {feature.title}
              </h3>
              {!isActive && (
                <span className="text-xs text-gray-500">
                  {isBeta && 'Beta'}
                  {isComingSoon && 'Coming Soon'}
                </span>
              )}
            </div>
          </div>
          {isActive && (
            <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {feature.description}
        </p>
      </div>
    </CardWrapper>
  )
}
