'use client'

import Link from 'next/link'
import { Feature } from '@/constants/features'
import { Badge } from './Badge'

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
      <div className={`group relative bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 transition-all duration-300 ${
        isActive ? 'hover:shadow-2xl hover:scale-105 hover:border-blue-400 cursor-pointer' : 'opacity-75'
      } ${isComingSoon ? 'cursor-not-allowed' : ''}`}>
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          {isBeta && <Badge variant="warning" size="sm">Beta</Badge>}
          {isComingSoon && <Badge variant="default" size="sm">Coming Soon</Badge>}
          {isActive && <Badge variant="success" size="sm">Active</Badge>}
        </div>

        {/* Icon */}
        <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl transition-shadow`}>
          <span className="text-3xl">{feature.icon}</span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          {feature.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
          {feature.description}
        </p>

        {/* Category */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {feature.category}
          </span>
        </div>

        {/* Hover Arrow */}
        {isActive && (
          <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        )}
      </div>
    </CardWrapper>
  )
}
