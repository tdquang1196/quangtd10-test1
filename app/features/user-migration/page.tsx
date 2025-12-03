'use client'

import { useState } from 'react'
import Link from 'next/link'
import MigrationModal from '@/components/MigrationModal'
import { Button } from '@/components/ui'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function UserMigrationPage() {
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
            User Migration
          </h1>
          <p className="text-gray-600">
            Bulk import students and teachers from Excel files
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <h3 className="font-semibold">Upload</h3>
            </div>
            <p className="text-sm text-gray-600">Upload Excel file with user data</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <h3 className="font-semibold">Preview</h3>
            </div>
            <p className="text-sm text-gray-600">Review processed data</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <h3 className="font-semibold">Migrate</h3>
            </div>
            <p className="text-sm text-gray-600">Execute migration and view results</p>
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold mb-3">Excel File Format</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span><strong>Column 1:</strong> Full name (Vietnamese text supported)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span><strong>Column 2:</strong> Grade (e.g., 1A, 2B, 3C)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span><strong>Column 3:</strong> Phone number</span>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <Button
          onClick={() => setIsModalOpen(true)}
          size="lg"
        >
          Start Migration
        </Button>

        <MigrationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </ProtectedRoute>
  )
}
