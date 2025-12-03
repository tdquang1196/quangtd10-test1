'use client'

import { useState } from 'react'
import { FEATURES, FEATURE_CATEGORIES } from '@/constants/features'
import { FeatureCard } from '@/components/ui'

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredFeatures = selectedCategory === 'all'
    ? FEATURES
    : FEATURES.filter(f => f.category === selectedCategory)

  const activeCount = FEATURES.filter(f => f.status === 'active').length

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Minimal Header */}
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Admin Tools
        </h1>
        <p className="text-gray-600">
          {activeCount} active feature{activeCount !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Compact Category Filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {FEATURE_CATEGORIES.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category.id
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Clean Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFeatures.map(feature => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>

      {/* No Features Message */}
      {filteredFeatures.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500">No features in this category</p>
        </div>
      )}
    </main>
  )
}
