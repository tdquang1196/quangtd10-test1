import { useState, useCallback } from 'react'
import { givePackageToUser } from '@/lib/api/users'

// Constants
const BATCH_SIZE = 5
const BATCH_DELAY_MS = 300

// Interfaces
export interface PackageAssignmentParams {
  subscriptionId: string
  description: string
  source: number // 4 = TRIAL_GIVE, 5 = BOUGHT_BY_CASH
  requester: string
}

export interface PackageUser {
  userId: string
  username?: string
  displayName?: string
}

export interface FailedUser extends PackageUser {
  error: string
  statusCode?: number
}

export interface UsePackageAssignmentReturn {
  // State
  isSending: boolean
  progress: number // 0-100
  successCount: number
  failedUsers: FailedUser[]

  // Actions
  sendPackages: (users: PackageUser[], params: PackageAssignmentParams) => Promise<void>
  retryFailed: (params: PackageAssignmentParams) => Promise<void>
  reset: () => void
}

// Helper functions
const extractErrorMessage = (error: any): string => {
  const data = error?.response?.data
  return data?.message || data?.title || error?.message || 'Unknown error'
}

const extractStatusCode = (error: any): number | undefined => {
  const data = error?.response?.data
  return data?.statusCode || error?.response?.status
}

/**
 * Custom hook for batch package assignment to users
 *
 * @example
 * const { sendPackages, progress, failedUsers } = usePackageAssignment()
 *
 * await sendPackages(
 *   [{ userId: '123', username: 'john' }],
 *   { subscriptionId: 'pkg-1', description: 'Trial', source: 4, requester: 'admin' }
 * )
 */
export const usePackageAssignment = (): UsePackageAssignmentReturn => {
  const [isSending, setIsSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [successCount, setSuccessCount] = useState(0)
  const [failedUsers, setFailedUsers] = useState<FailedUser[]>([])

  const sendPackages = useCallback(
    async (users: PackageUser[], params: PackageAssignmentParams) => {
      // Validation
      if (!users?.length) return
      if (!params.subscriptionId || !params.description || !params.requester) {
        throw new Error('Missing required parameters')
      }

      // Reset state
      setIsSending(true)
      setProgress(0)
      setSuccessCount(0)
      setFailedUsers([])

      const failed: FailedUser[] = []
      let success = 0

      try {
        // Split into batches
        const batches: PackageUser[][] = []
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
          batches.push(users.slice(i, i + BATCH_SIZE))
        }

        // Process batches
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex]

          // Parallel requests within batch
          const results = await Promise.allSettled(
            batch.map((user) =>
              givePackageToUser({
                subscriptionId: params.subscriptionId,
                userId: user.userId,
                description: params.description,
                source: params.source,
                requester: params.requester,
              })
            )
          )

          // Process results
          results.forEach((result, idx) => {
            const user = batch[idx]
            if (result.status === 'fulfilled') {
              success++
            } else {
              failed.push({
                ...user,
                error: extractErrorMessage(result.reason),
                statusCode: extractStatusCode(result.reason),
              })
            }
          })

          // Update progress
          const processedCount = (batchIndex + 1) * BATCH_SIZE
          setProgress((Math.min(processedCount, users.length) / users.length) * 100)

          // Delay between batches
          if (batchIndex < batches.length - 1) {
            await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
          }
        }
      } finally {
        setSuccessCount(success)
        setFailedUsers(failed)
        setIsSending(false)
      }
    },
    []
  )

  const retryFailed = useCallback(
    async (params: PackageAssignmentParams) => {
      if (failedUsers.length === 0) return

      // Clear current failures before retry
      const usersToRetry = [...failedUsers]
      setFailedUsers([])

      await sendPackages(usersToRetry, params)
    },
    [failedUsers, sendPackages]
  )

  const reset = useCallback(() => {
    setIsSending(false)
    setProgress(0)
    setSuccessCount(0)
    setFailedUsers([])
  }, [])

  return {
    isSending,
    progress,
    successCount,
    failedUsers,
    sendPackages,
    retryFailed,
    reset,
  }
}
