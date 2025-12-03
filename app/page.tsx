'use client'

import { useState } from 'react'
import { FEATURES, FEATURE_CATEGORIES } from '@/constants/features'
import { FeatureCard } from '@/components/ui'

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredFeatures = selectedCategory === 'all'
    ? FEATURES
    : FEATURES.filter(f => f.category === selectedCategory)

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-6 shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Admin Tools Hub
          </h1>

          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Your all-in-one platform for managing users, data, and analytics. Choose a feature below to get started.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {FEATURE_CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-blue-300'
              }`}
            >
              <span className="text-lg">{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">{FEATURES.filter(f => f.status === 'active').length}</div>
                <div className="text-sm text-gray-600">Active Features</div>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">{FEATURES.length}</div>
                <div className="text-sm text-gray-600">Total Features</div>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">{FEATURES.filter(f => f.status === 'coming-soon').length}</div>
                <div className="text-sm text-gray-600">Coming Soon</div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFeatures.map(feature => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>

        {/* No Features Message */}
        {filteredFeatures.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No features found</h3>
            <p className="text-gray-600">Try selecting a different category</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            Select a feature card to access its functionality. More features coming soon!
          </p>
        </div>
      </div>
    </main>
  )
}
