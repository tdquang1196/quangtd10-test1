'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BatchPackageModal } from '@/components/migration'
import { Button } from '@/components/ui'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function BatchSendPackagePage() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-8"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Batch Send Package
        </h1>
        <p className="text-gray-600">
          Send packages to multiple users efficiently with batch processing
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔍</span>
            <h3 className="font-semibold">Two Input Modes</h3>
          </div>
          <p className="text-sm text-gray-600">Search by username or use direct user IDs</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⚡</span>
            <h3 className="font-semibold">Batch Processing</h3>
          </div>
          <p className="text-sm text-gray-600">Process multiple users simultaneously</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📊</span>
            <h3 className="font-semibold">Progress Tracking</h3>
          </div>
          <p className="text-sm text-gray-600">Real-time progress with visual indicators</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔄</span>
            <h3 className="font-semibold">Retry Mechanism</h3>
          </div>
          <p className="text-sm text-gray-600">Automatically retry failed operations</p>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="font-semibold mb-4">How It Works</h2>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              1
            </div>
            <div>
              <h3 className="font-semibold mb-1">Select Input Mode</h3>
              <p className="text-sm text-gray-600">
                Choose between searching by username/display name or entering user IDs directly
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="font-semibold mb-1">Enter User List</h3>
              <p className="text-sm text-gray-600">
                Paste usernames or user IDs separated by comma, semicolon, or newline
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="font-semibold mb-1">Configure Package</h3>
              <p className="text-sm text-gray-600">
                Enter package ID, description, and requester information
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              4
            </div>
            <div>
              <h3 className="font-semibold mb-1">Send & Monitor</h3>
              <p className="text-sm text-gray-600">
                Track progress in real-time and retry any failed operations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Requirements */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="font-semibold mb-3">Input Format</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-gray-400">•</span>
            <span><strong>Username Mode:</strong> Enter usernames or display names</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">•</span>
            <span><strong>User ID Mode:</strong> Enter user IDs directly (no search needed)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">•</span>
            <span><strong>Separators:</strong> Use comma (,), semicolon (;), or newline</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">•</span>
            <span><strong>Package ID:</strong> Required - Enter the package identifier</span>
          </li>
        </ul>
      </div>

      {/* Features List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="font-semibold mb-3">Key Features</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Process up to 5 users concurrently for optimal performance</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Client-side pagination for large user lists (10 users per page)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Automatic retry mechanism for failed operations</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Export failed users list to clipboard</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Real-time progress tracking with percentage and count</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Detailed error messages for troubleshooting</span>
          </li>
        </ul>
      </div>

      {/* CTA */}
      <Button
        onClick={() => setIsModalOpen(true)}
        size="lg"
      >
        Start Batch Send
      </Button>

      <BatchPackageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      </div>
    </ProtectedRoute>
  )
}
