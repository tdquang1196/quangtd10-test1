'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Card } from '@/components/ui'
import { getSubscriptions } from '@/lib/api/users'
import { PACKAGE_SOURCE_OPTIONS } from '@/constants/package-source'

interface SchoolForm {
    id: string
    file: File | null
    schoolPrefix: string
    createAdminTeacher: boolean
}

interface BatchSubscriptionConfig {
    enabled: boolean
    subscriptionId: string
    description: string
    requester: string
    source: string
}

interface BatchUploadTabProps {
    onSubmit: (schools: SchoolForm[], subscriptionConfig: BatchSubscriptionConfig) => void
    isProcessing: boolean
}

export default function BatchUploadTab({ onSubmit, isProcessing }: BatchUploadTabProps) {
    const [schools, setSchools] = useState<SchoolForm[]>([
        { id: crypto.randomUUID(), file: null, schoolPrefix: '', createAdminTeacher: true }
    ])

    // Subscription configuration
    const [subscriptionConfig, setSubscriptionConfig] = useState<BatchSubscriptionConfig>({
        enabled: false,
        subscriptionId: '',
        description: '',
        requester: '',
        source: '4' // Default: TRIAL_GIVE
    })

    // Subscriptions
    const [subscriptions, setSubscriptions] = useState<Array<{ id: string; title: string }>>([])
    const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false)

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
            } finally {
                setIsLoadingSubscriptions(false)
            }
        }

        fetchSubscriptions()
    }, [])

    const addSchool = () => {
        setSchools([...schools, {
            id: crypto.randomUUID(),
            file: null,
            schoolPrefix: '',
            createAdminTeacher: true
        }])
    }

    const removeSchool = (id: string) => {
        if (schools.length > 1) {
            setSchools(schools.filter(s => s.id !== id))
        }
    }

    const updateSchool = (id: string, updates: Partial<SchoolForm>) => {
        setSchools(schools.map(s => s.id === id ? { ...s, ...updates } : s))
    }

    const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        updateSchool(id, { file })
    }

    const isValid = schools.every(s => s.file && s.schoolPrefix.trim())

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">School Forms</h3>
                    <p className="text-sm text-gray-600 mt-1">Add multiple schools to process in queue</p>
                </div>
                <Button onClick={addSchool} variant="secondary" size="sm">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add School
                </Button>
            </div>

            {/* School Forms */}
            <div className="space-y-4">
                {schools.map((school, index) => (
                    <Card key={school.id} className="p-6 bg-white border-2 border-gray-200 hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                                    {index + 1}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">School #{index + 1}</h4>
                                    <p className="text-sm text-gray-500">{school.schoolPrefix || 'No prefix set'}</p>
                                </div>
                            </div>
                            {schools.length > 1 && (
                                <button
                                    onClick={() => removeSchool(school.id)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                    title="Remove school"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* File Upload */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Excel File *
                                </label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={(e) => handleFileChange(school.id, e)}
                                        className="hidden"
                                        id={`file-${school.id}`}
                                    />
                                    <label
                                        htmlFor={`file-${school.id}`}
                                        className={`flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${school.file
                                                ? 'border-green-400 bg-green-50 text-green-700'
                                                : 'border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50 text-gray-600'
                                            }`}
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <span className="font-medium">
                                            {school.file ? school.file.name : 'Click to upload Excel file'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* School Prefix */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    School Prefix *
                                </label>
                                <Input
                                    value={school.schoolPrefix}
                                    onChange={(e) => updateSchool(school.id, { schoolPrefix: e.target.value.toUpperCase() })}
                                    placeholder="e.g., HYTKLTT"
                                    className="uppercase"
                                />
                                <p className="text-xs text-gray-500 mt-1">Used for username generation</p>
                            </div>

                            {/* Create Admin Teacher */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Admin Teacher Account
                                </label>
                                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={school.createAdminTeacher}
                                        onChange={(e) => updateSchool(school.id, { createAdminTeacher: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div>
                                        <span className="text-sm font-medium text-gray-900">Create admin teacher</span>
                                        <p className="text-xs text-gray-500">Account for managing all classes</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Batch Subscription Configuration */}
            <Card className="border-2 border-green-200 overflow-hidden">
                <div className="flex items-start gap-3 p-4 bg-green-50">
                    <input
                        type="checkbox"
                        id="batch-auto-subscription"
                        checked={subscriptionConfig.enabled}
                        onChange={(e) => setSubscriptionConfig({ ...subscriptionConfig, enabled: e.target.checked })}
                        className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                    />
                    <label htmlFor="batch-auto-subscription" className="flex-1 cursor-pointer">
                        <div className="text-sm font-semibold text-green-900 mb-1">
                            Auto-Assign Subscription Packages (All Schools)
                        </div>
                        <div className="text-xs text-green-700">
                            Automatically assign subscription packages to all students after each school migration completes
                        </div>
                    </label>
                </div>

                {subscriptionConfig.enabled && (
                    <div className="p-4 bg-white space-y-4 border-t border-green-200">
                        {/* Subscription Package */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                Subscription Package <span className="text-red-600">*</span>
                            </label>
                            {isLoadingSubscriptions ? (
                                <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm">
                                    Loading subscriptions...
                                </div>
                            ) : subscriptions.length === 0 ? (
                                <div className="w-full px-4 py-3 border border-red-200 rounded-lg bg-red-50 text-red-600 text-sm">
                                    No subscriptions available
                                </div>
                            ) : (
                                <select
                                    value={subscriptionConfig.subscriptionId}
                                    onChange={(e) => setSubscriptionConfig({ ...subscriptionConfig, subscriptionId: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none bg-white"
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
                                Description
                            </label>
                            <input
                                type="text"
                                value={subscriptionConfig.description}
                                onChange={(e) => setSubscriptionConfig({ ...subscriptionConfig, description: e.target.value })}
                                placeholder="e.g., Batch migration 2025-12-09"
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
                            />
                        </div>

                        {/* Requester */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                Requester
                            </label>
                            <input
                                type="text"
                                value={subscriptionConfig.requester}
                                onChange={(e) => setSubscriptionConfig({ ...subscriptionConfig, requester: e.target.value })}
                                placeholder="Your name"
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
                            />
                        </div>

                        {/* Source */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                Package Source <span className="text-red-600">*</span>
                            </label>
                            <select
                                value={subscriptionConfig.source}
                                onChange={(e) => setSubscriptionConfig({ ...subscriptionConfig, source: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none bg-white"
                            >
                                {PACKAGE_SOURCE_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </Card>

            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p className="font-medium text-blue-900">
                            {schools.length} school{schools.length !== 1 ? 's' : ''} ready to process
                        </p>
                        <p className="text-sm text-blue-700">
                            {schools.filter(s => s.file && s.schoolPrefix).length} / {schools.length} forms completed
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => onSubmit(schools, subscriptionConfig)}
                    disabled={!isValid || isProcessing}
                    loading={isProcessing}
                    size="lg"
                >
                    Process All Schools
                </Button>
            </div>
        </div>
    )
}
