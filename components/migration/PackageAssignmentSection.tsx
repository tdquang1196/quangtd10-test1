'use client'

import React, { useState, useEffect } from 'react'
import { usePackageAssignment } from '@/hooks/usePackageAssignment'
import { getSubscriptions } from '@/lib/api/users'
import { PACKAGE_SOURCE_OPTIONS } from '@/constants/package-source'

interface PackageAssignmentSectionProps {
  users: Array<{
    userId: string
    username: string
    displayName: string
  }>
  onSuccess?: (successCount: number, failedCount: number) => void
  onError?: (error: string) => void
  className?: string
}

export function PackageAssignmentSection({
  users,
  onSuccess,
  onError,
  className = ''
}: PackageAssignmentSectionProps) {
  // Form state
  const [subscriptionId, setSubscriptionId] = useState('')
  const [description, setDescription] = useState('')
  const [requester, setRequester] = useState('')
  const [source, setSource] = useState('4') // Default: TRIAL_GIVE

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<Array<{ id: string; title: string }>>([])
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false)

  // Package assignment hook
  const {
    isSending,
    progress,
    successCount,
    failedUsers,
    sendPackages,
    retryFailed,
    reset
  } = usePackageAssignment()

  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)

  // Fetch subscriptions on mount
  useEffect(() => {
    const fetchSubscriptions = async () => {
      setIsLoadingSubscriptions(true)
      try {
        const response = await getSubscriptions()
        if (response?.data?.subcriptions) {
          setSubscriptions(
            response.data.subcriptions.map((sub: any) => ({
              id: sub.id,
              title: sub.title
            }))
          )
        }
      } catch (error) {
        console.error('Failed to fetch subscriptions:', error)
        showNotification('Failed to load subscriptions', 'error')
      } finally {
        setIsLoadingSubscriptions(false)
      }
    }

    fetchSubscriptions()
  }, [])

  // Notification helper
  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // Form validation
  const isFormValid = () => {
    return subscriptionId && description && requester
  }

  const canAssign = isFormValid() && !isSending && users.length > 0

  // Handle assign packages
  const handleAssignPackages = async () => {
    // Validation
    if (!subscriptionId || !description || !requester) {
      showNotification('Please fill all required fields', 'error')
      return
    }

    try {
      await sendPackages(
        users.map(u => ({ userId: u.userId, username: u.username, displayName: u.displayName })),
        {
          subscriptionId,
          description,
          source: parseInt(source),
          requester
        }
      )

      // Callback after completion
      if (failedUsers.length === 0) {
        showNotification(`Successfully assigned packages to all ${successCount} students`, 'success')
        onSuccess?.(successCount, 0)
      } else {
        showNotification(`Assigned: ${successCount}, Failed: ${failedUsers.length}`, 'warning')
        onSuccess?.(successCount, failedUsers.length)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      showNotification(`Failed to assign packages: ${errorMsg}`, 'error')
      onError?.(errorMsg)
    }
  }

  // Handle retry failed
  const handleRetry = async () => {
    if (failedUsers.length === 0) return

    try {
      await retryFailed({
        subscriptionId,
        description,
        source: parseInt(source),
        requester
      })

      if (failedUsers.length === 0) {
        showNotification('All retries successful!', 'success')
      } else {
        showNotification(`Still ${failedUsers.length} failures`, 'warning')
      }
    } catch (error) {
      showNotification('Retry failed', 'error')
    }
  }

  return (
    <>
      <div className={`border-2 border-blue-200 rounded-lg overflow-hidden ${className}`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Assign Packages to New Students</h3>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {users.length} students
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 bg-white">
          {/* Subscription Package */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Subscription Package <span className="text-red-600">*</span>
            </label>
            {isLoadingSubscriptions ? (
              <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500">
                Loading subscriptions...
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="w-full px-4 py-3 border border-red-200 rounded-lg bg-red-50 text-red-600 text-sm">
                No subscriptions available
              </div>
            ) : (
              <select
                value={subscriptionId}
                onChange={(e) => setSubscriptionId(e.target.value)}
                disabled={isSending}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none bg-white disabled:opacity-50"
              >
                <option value="">Select a subscription package</option>
                {subscriptions.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Description <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSending}
              placeholder="e.g., Migration batch 2025-12-05"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none disabled:opacity-50"
            />
          </div>

          {/* Requester */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Requester <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={requester}
              onChange={(e) => setRequester(e.target.value)}
              disabled={isSending}
              placeholder="Your name"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none disabled:opacity-50"
            />
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Package Source <span className="text-red-600">*</span>
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={isSending}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none bg-white disabled:opacity-50"
            >
              {PACKAGE_SOURCE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Action Button */}
          <button
            onClick={handleAssignPackages}
            disabled={!canAssign}
            className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSending ? 'Assigning Packages...' : `Assign to All ${users.length} Students`}
          </button>

          {/* Progress Bar */}
          {isSending && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-blue-900">Assigning packages...</p>
                <p className="text-sm text-blue-700">
                  {Math.round(progress)}% ({Math.round((users.length * progress) / 100)}/{users.length})
                </p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 text-center mt-2">
                Please wait, do not close this window
              </p>
            </div>
          )}

          {/* Success Display */}
          {!isSending && successCount > 0 && failedUsers.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="font-semibold text-green-900">
                  Successfully assigned packages to all {successCount} students!
                </p>
              </div>
            </div>
          )}

          {/* Failures Display */}
          {!isSending && failedUsers.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="font-semibold text-red-900">
                  Failed to assign packages to {failedUsers.length} student(s)
                </p>
              </div>

              <div className="max-h-60 overflow-y-auto bg-red-100/50 rounded p-3 mb-3">
                {failedUsers.map((user, idx) => (
                  <p key={idx} className="text-sm text-red-700 font-medium">
                    {idx + 1}. {user.username || user.displayName} - {user.error}
                  </p>
                ))}
              </div>

              <button
                onClick={handleRetry}
                disabled={isSending}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Retry Failed ({failedUsers.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-[10000] max-w-sm border ${
            notification.type === 'success'
              ? 'bg-gray-900 border-gray-800 text-white'
              : notification.type === 'error'
              ? 'bg-red-600 border-red-700 text-white'
              : notification.type === 'warning'
              ? 'bg-orange-600 border-orange-700 text-white'
              : 'bg-blue-600 border-blue-700 text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm">{notification.message}</div>
            <button
              onClick={() => setNotification(null)}
              className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
