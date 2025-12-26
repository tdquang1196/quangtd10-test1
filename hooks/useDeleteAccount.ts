import { useState, useCallback } from 'react'
import { DeleteAccountData, DeleteProgress } from '@/lib/deleteAccountService'

export function useDeleteAccount() {
    const [progress, setProgress] = useState<DeleteProgress | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const deleteAccounts = useCallback(async (
        accounts: DeleteAccountData[],
        baseUrl: string,
        onProgressUpdate?: (progress: DeleteProgress) => void
    ) => {
        setIsDeleting(true)
        setProgress({
            status: 'running',
            currentIndex: 0,
            totalAccounts: accounts.length,
            successful: [],
            failed: []
        })

        try {
            const response = await fetch('/api/delete-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accounts,
                    baseUrl
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to delete accounts')
            }

            const result = await response.json()

            const finalProgress: DeleteProgress = {
                status: 'completed',
                currentIndex: accounts.length,
                totalAccounts: accounts.length,
                successful: result.successful,
                failed: result.failed
            }

            setProgress(finalProgress)
            if (onProgressUpdate) {
                onProgressUpdate(finalProgress)
            }

            return result
        } catch (error: any) {
            console.error('Delete accounts error:', error)
            const errorProgress: DeleteProgress = {
                status: 'completed',
                currentIndex: 0,
                totalAccounts: accounts.length,
                successful: [],
                failed: accounts.map(acc => ({
                    ...acc,
                    status: 'error',
                    error: error.message
                }))
            }
            setProgress(errorProgress)
            throw error
        } finally {
            setIsDeleting(false)
        }
    }, [])

    return {
        deleteAccounts,
        progress,
        isDeleting
    }
}
