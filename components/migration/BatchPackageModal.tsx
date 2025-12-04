'use client'

import React, { useState, useEffect } from 'react'
import { PACKAGE_SOURCE_OPTIONS } from '@/constants/package-source'
import { searchBatchUsers, givePackageToUser, getSubscriptions } from '@/lib/api/users'

interface BatchPackageModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BatchPackageModal({ isOpen, onClose }: BatchPackageModalProps) {
  const [inputMode, setInputMode] = useState<'username' | 'userid'>('username')
  const [listUserNames, setListUserNames] = useState('')
  const [foundUsers, setFoundUsers] = useState<any[]>([])
  const [notFoundUsers, setNotFoundUsers] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [subscriptionId, setSubscriptionId] = useState('')
  const [description, setDescription] = useState('')
  const [requester, setRequester] = useState('')
  const [source, setSource] = useState('4')
  const [isSearching, setIsSearching] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendProgress, setSendProgress] = useState(0)
  const [failedUsers, setFailedUsers] = useState<any[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [subscriptions, setSubscriptions] = useState<Array<{ id: string; title: string }>>([])
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false)

  // Client-side pagination
  const totalPages = Math.ceil(foundUsers.length / pageSize)
  const paginatedUsers = foundUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // Fetch subscriptions when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSubscriptions()
    }
  }, [isOpen])

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

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleClose = () => {
    setInputMode('username')
    setListUserNames('')
    setFoundUsers([])
    setNotFoundUsers([])
    setCurrentPage(1)
    setSubscriptionId('')
    setDescription('')
    setRequester('')
    setSource('4')
    setFailedUsers([])
    setSuccessCount(0)
    setSendProgress(0)
    onClose()
  }

  const handleSearchUsers = async () => {
    setIsSearching(true)
    setFoundUsers([])
    setNotFoundUsers([])
    setFailedUsers([])
    setSuccessCount(0)

    try {
      // Split by newline, semicolon, or comma and filter empty values
      const userInputs = listUserNames
        .split(/[\n;,]/)
        .map(x => x.trim())
        .filter(x => x)

      if (userInputs.length === 0) {
        showNotification(
          inputMode === 'userid'
            ? 'Please enter at least one user ID'
            : 'Please enter at least one username or display name',
          'warning'
        )
        setIsSearching(false)
        return
      }

      // If user ID mode, directly create user objects without searching
      if (inputMode === 'userid') {
        const users = userInputs.map(userId => ({
          userId,
          username: 'N/A',
          displayName: 'N/A'
        }))

        setFoundUsers(users)
        setCurrentPage(1)
        setNotFoundUsers([])

        showNotification(`Loaded ${users.length} user ID(s)`, 'success')
        setIsSearching(false)
        return
      }

      // Username mode - search for users
      const response = await searchBatchUsers({
        listUserNames: userInputs
      })

      if (response?.data) {
        const found = response.data
        setFoundUsers(found)
        setCurrentPage(1)

        // Find which users were not found
        const foundUsernames = found.map((u: any) => u.username?.toLowerCase())
        const foundDisplayNames = found.map((u: any) => u.displayName?.toLowerCase())

        const notFound = userInputs.filter(name => {
          const lowerName = name.toLowerCase()
          return !foundUsernames.includes(lowerName) && !foundDisplayNames.includes(lowerName)
        })

        setNotFoundUsers(notFound)

        if (found.length > 0) {
          showNotification(
            `Found ${found.length} user(s)${notFound.length > 0 ? `, ${notFound.length} not found` : ''}`,
            notFound.length > 0 ? 'warning' : 'success'
          )
        } else {
          showNotification('None of the entered names matched any users', 'warning')
        }
      }
    } catch (error: any) {
      showNotification(error?.message || 'Failed to search users. Please try again.', 'error')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSendPackage = async (usersToSend?: any[]) => {
    const targetUsers = usersToSend || foundUsers

    if (!subscriptionId) {
      showNotification('Please select a subscription package', 'error')
      return
    }

    if (!description || !requester) {
      showNotification('Please fill in description and requester', 'error')
      return
    }

    // If retrying, clear previous failed list
    if (usersToSend) {
      setFailedUsers([])
    }

    setIsSending(true)
    setSendProgress(0)
    const failed: any[] = []
    let success = 0

    try {
      const BATCH_SIZE = 5 // Send 5 requests in parallel
      const batches: any[][] = []

      // Split users into batches
      for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
        batches.push(targetUsers.slice(i, i + BATCH_SIZE))
      }

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]

        // Send all requests in this batch in parallel
        const results = await Promise.allSettled(
          batch.map(async (user) => {
            const payload = {
              subscriptionId: subscriptionId,
              userId: user.userId,
              description: description,
              source: parseInt(source),
              requester: requester
            }

            const response = await givePackageToUser(payload)

            if (!response) {
              throw new Error('Error from server')
            }

            return { user, success: true }
          })
        )

        // Process results
        results.forEach((result, idx) => {
          const user = batch[idx]

          if (result.status === 'fulfilled') {
            success++
          } else {
            const error = result.reason
            console.error('Error:', error?.response?.data || error)

            const data = error?.response?.data
            const statusCode = data?.statusCode || error?.response?.status
            const errorMessage = data?.message || data?.title || error?.message || 'Unknown error'
            const fullMessage = statusCode ? `[${statusCode}] ${errorMessage}` : errorMessage

            failed.push({ ...user, error: fullMessage, statusCode })
          }
        })

        // Update progress
        const processedCount = (batchIndex + 1) * BATCH_SIZE
        setSendProgress((Math.min(processedCount, targetUsers.length) / targetUsers.length) * 100)

        // Delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise(r => setTimeout(r, 300))
        }
      }
    } catch (error: any) {
      console.error('Unexpected error:', error)
      showNotification(error?.message || 'An unexpected error occurred', 'error')
    } finally {
      setSuccessCount(success)
      setFailedUsers(failed)
      setIsSending(false)

      if (failed.length === 0) {
        showNotification(`Successfully sent package to all ${success} user(s)`, 'success')
      } else if (success === 0) {
        showNotification(`Failed to send to all ${failed.length} user(s)`, 'error')
      } else {
        showNotification(`Success: ${success}, Failed: ${failed.length}`, 'warning')
      }
    }
  }

  const handleRetryFailed = () => {
    handleSendPackage(failedUsers)
  }

  const copyFailedUsersToClipboard = () => {
    const userList = failedUsers
      .map((user: any, idx: number) => `${idx + 1}. ${user.username || user.displayName}`)
      .join('\n')

    navigator.clipboard.writeText(userList)
    showNotification('User list copied to clipboard', 'info')
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Send Package to Multiple Users
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Input Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setInputMode('username')
                  setListUserNames('')
                  setFoundUsers([])
                  setNotFoundUsers([])
                  setFailedUsers([])
                  setSuccessCount(0)
                }}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'username'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                Search by Username
              </button>
              <button
                onClick={() => {
                  setInputMode('userid')
                  setListUserNames('')
                  setFoundUsers([])
                  setNotFoundUsers([])
                  setFailedUsers([])
                  setSuccessCount(0)
                }}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'userid'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                Direct User IDs
              </button>
            </div>

            {/* Textarea */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {inputMode === 'userid' ? 'List of User IDs' : 'List of Usernames'}
              </label>
              <p className="text-xs text-gray-600 mb-2">
                {inputMode === 'userid'
                  ? 'Enter user IDs directly. Separate by comma (,), semicolon (;), or newline. No search needed.'
                  : 'Enter usernames or display names. Separate by comma (,), semicolon (;), or newline'}
              </p>
              <textarea
                value={listUserNames}
                onChange={(e) => setListUserNames(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none resize-y"
                placeholder={inputMode === 'userid' ? 'user-id-1, user-id-2, user-id-3...' : 'username1, username2, username3...'}
              />
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearchUsers}
              disabled={!listUserNames || isSearching}
              className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? 'Loading...' : inputMode === 'userid' ? 'Load User IDs' : 'Search Users'}
            </button>

            {/* Not Found Users */}
            {notFoundUsers.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="font-semibold text-orange-900 mb-2">
                  Users Not Found ({notFoundUsers.length})
                </p>
                <p className="text-sm text-orange-700 mb-2">
                  The following names were not found in the system:
                </p>
                <div className="max-h-36 overflow-y-auto">
                  {notFoundUsers.map((name, idx) => (
                    <p key={idx} className="text-sm text-orange-600">
                      • {name}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Found Users Table */}
            {foundUsers.length > 0 && (
              <>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <p className="font-semibold text-gray-900">Found Users ({foundUsers.length})</p>
                    <p className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Username</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Display Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">User ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paginatedUsers.map((user: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{user.username}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{user.displayName}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{user.userId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-200 flex justify-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-sm text-gray-600">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>

                {/* Package Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Package <span className="text-red-600">*</span>
                    </label>
                    {isLoadingSubscriptions ? (
                      <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500">
                        Loading subscriptions...
                      </div>
                    ) : subscriptions.length === 0 ? (
                      <div className="w-full px-4 py-3 border border-red-200 rounded-lg bg-red-50 text-red-600 text-sm">
                        No subscriptions available. Please contact administrator.
                      </div>
                    ) : (
                      <select
                        value={subscriptionId}
                        onChange={(e) => setSubscriptionId(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none bg-white"
                      >
                        <option value="">Select a subscription package</option>
                        {subscriptions.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Description <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
                      placeholder="Enter description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Requester <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={requester}
                      onChange={(e) => setRequester(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
                      placeholder="Enter requester name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Package Source <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none bg-white"
                    >
                      {PACKAGE_SOURCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Progress */}
                {isSending && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-blue-900">Sending packages...</p>
                      <p className="text-sm text-blue-700">
                        {Math.round(sendProgress)}% ({Math.round((foundUsers.length * sendProgress) / 100)}/{foundUsers.length})
                      </p>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${sendProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-600 text-center mt-2">
                      Please wait, do not close this window
                    </p>
                  </div>
                )}

                {/* Success Message */}
                {!isSending && successCount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="font-semibold text-green-900">
                      Successfully sent to {successCount} users
                    </p>
                  </div>
                )}

                {/* Failed Users */}
                {failedUsers.length > 0 && !isSending && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="font-semibold text-red-900">
                        Failed to send package to {failedUsers.length} user(s)
                      </p>
                    </div>
                    <div className="max-h-60 overflow-y-auto bg-red-100/50 rounded p-3 mb-3">
                      {failedUsers.map((user: any, idx: number) => (
                        <p key={idx} className="text-sm text-red-700 font-medium">
                          {idx + 1}. {user.username || user.displayName} - {user.error}
                        </p>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRetryFailed}
                        disabled={isSending}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Retry Failed Users
                      </button>
                      <button
                        onClick={copyFailedUsersToClipboard}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Copy List
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleClose}
                    className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleSendPackage()}
                    disabled={!subscriptionId || !description || !requester || isSending}
                    className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSending ? 'Sending...' : 'Send to All Users'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notification */}
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
