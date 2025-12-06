'use client'

import { useState } from 'react'
import { Button, Input, Card } from '@/components/ui'

interface SchoolForm {
    id: string
    file: File | null
    schoolPrefix: string
    createAdminTeacher: boolean
}

interface BatchUploadTabProps {
    onSubmit: (schools: SchoolForm[]) => void
    isProcessing: boolean
}

export default function BatchUploadTab({ onSubmit, isProcessing }: BatchUploadTabProps) {
    const [schools, setSchools] = useState<SchoolForm[]>([
        { id: crypto.randomUUID(), file: null, schoolPrefix: '', createAdminTeacher: true }
    ])

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
                    onClick={() => onSubmit(schools)}
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
