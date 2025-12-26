'use client'

import { useState, useRef } from 'react'
import { DeleteAccountData } from '@/lib/deleteAccountService'
import { processDeleteAccountExcel } from '@/lib/excelDeleteProcessor'
import { useDeleteAccount } from '@/hooks/useDeleteAccount'
import { Button } from '@/components/ui'

interface DeleteAccountModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
    const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'results'>('upload')
    const [accounts, setAccounts] = useState<DeleteAccountData[]>([])
    const [baseUrl, setBaseUrl] = useState('https://api-v2.prep.vn')
    const [errors, setErrors] = useState<string[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { deleteAccounts, progress, isDeleting } = useDeleteAccount()

    if (!isOpen) return null

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsProcessing(true)
        setErrors([])

        try {
            const result = await processDeleteAccountExcel(file)

            if (result.errors.length > 0) {
                setErrors(result.errors)
            }

            if (result.accounts.length > 0) {
                setAccounts(result.accounts)
                setStep('preview')
            } else {
                setErrors(prev => [...prev, 'No valid accounts found in the file'])
            }
        } catch (error: any) {
            setErrors([error.message])
        } finally {
            setIsProcessing(false)
        }
    }

    const handleStartDeletion = async () => {
        setStep('processing')
        try {
            await deleteAccounts(accounts, baseUrl)
            setStep('results')
        } catch (error: any) {
            setErrors([error.message])
            setStep('results')
        }
    }

    const handleClose = () => {
        setStep('upload')
        setAccounts([])
        setErrors([])
        setBaseUrl('https://api-v2.prep.vn')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
        onClose()
    }

    const renderUploadStep = () => (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base URL
                </label>
                <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="https://api-v2.prep.vn"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Excel File
                </label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="w-full"
                    disabled={isProcessing}
                />
                <p className="text-sm text-gray-500 mt-2">
                    Excel file should have 2 columns: username, password
                </p>
            </div>

            {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-semibold text-red-900 mb-2">Errors:</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                        {errors.map((error, i) => (
                            <li key={i}>• {error}</li>
                        ))}
                    </ul>
                </div>
            )}

            {isProcessing && (
                <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
                    <p className="mt-2 text-sm text-gray-600">Processing Excel file...</p>
                </div>
            )}
        </div>
    )

    const renderPreviewStep = () => (
        <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Warning</h4>
                <p className="text-sm text-yellow-700">
                    You are about to delete <strong>{accounts.length}</strong> accounts. This action cannot be undone!
                </p>
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 text-left">#</th>
                            <th className="px-4 py-2 text-left">Username</th>
                            <th className="px-4 py-2 text-left">Password</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.map((account, i) => (
                            <tr key={i} className="border-t border-gray-200">
                                <td className="px-4 py-2">{i + 1}</td>
                                <td className="px-4 py-2 font-mono">{account.username}</td>
                                <td className="px-4 py-2 font-mono">{'•'.repeat(account.password.length)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-3">
                <Button
                    onClick={() => setStep('upload')}
                    variant="outline"
                >
                    Back
                </Button>
                <Button
                    onClick={handleStartDeletion}
                    className="bg-red-600 hover:bg-red-700"
                >
                    Start Deletion
                </Button>
            </div>
        </div>
    )

    const renderProcessingStep = () => (
        <div className="space-y-4">
            <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent mb-4"></div>
                <h3 className="text-lg font-semibold mb-2">Deleting Accounts...</h3>
                {progress && (
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                            Processing: {progress.currentIndex + 1} / {progress.totalAccounts}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 max-w-md mx-auto">
                            <div
                                className="bg-red-600 h-2 rounded-full transition-all"
                                style={{ width: `${((progress.currentIndex + 1) / progress.totalAccounts) * 100}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-center gap-4 text-sm mt-4">
                            <span className="text-green-600">✓ Success: {progress.successful.length}</span>
                            <span className="text-red-600">✗ Failed: {progress.failed.length}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

    const renderResultsStep = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{progress?.successful.length || 0}</div>
                    <div className="text-sm text-green-700">Successfully Deleted</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{progress?.failed.length || 0}</div>
                    <div className="text-sm text-red-700">Failed</div>
                </div>
            </div>

            {progress && progress.failed.length > 0 && (
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left">Username</th>
                                <th className="px-4 py-2 text-left">Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {progress.failed.map((account, i) => (
                                <tr key={i} className="border-t border-gray-200">
                                    <td className="px-4 py-2 font-mono">{account.username}</td>
                                    <td className="px-4 py-2 text-red-600">{account.error}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Button onClick={handleClose}>
                Close
            </Button>
        </div>
    )

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Delete Accounts</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={isDeleting}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {step === 'upload' && renderUploadStep()}
                    {step === 'preview' && renderPreviewStep()}
                    {step === 'processing' && renderProcessingStep()}
                    {step === 'results' && renderResultsStep()}
                </div>
            </div>
        </div>
    )
}
