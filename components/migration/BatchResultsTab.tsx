'use client'

import { useState } from 'react'
import { Button, Card } from '@/components/ui'

interface SchoolResult {
    schoolPrefix: string
    students: any[]
    teachers: any[]
    classes: any[]
    failedUsers: any[]
    failedClasses: any[]
}

interface BatchResultsTabProps {
    results: SchoolResult[]
    onClose: () => void
}

export default function BatchResultsTab({ results, onClose }: BatchResultsTabProps) {
    const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set(results.map(r => r.schoolPrefix)))

    const toggleSchool = (prefix: string) => {
        const newExpanded = new Set(expandedSchools)
        if (newExpanded.has(prefix)) {
            newExpanded.delete(prefix)
        } else {
            newExpanded.add(prefix)
        }
        setExpandedSchools(newExpanded)
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        alert(`Copied ${label} to clipboard!`)
    }

    const getAllStudents = () => results.flatMap(r => r.students)
    const getAllTeachers = () => results.flatMap(r => r.teachers)

    return (
        <div className="space-y-6">
            {/* Overall Summary */}
            <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">Batch Migration Complete!</h3>
                        <p className="text-gray-600">Successfully processed {results.length} schools</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-600 mb-1">Total Students</p>
                        <p className="text-3xl font-bold text-green-600">{getAllStudents().length}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <p className="text-sm text-gray-600 mb-1">Total Teachers</p>
                        <p className="text-3xl font-bold text-blue-600">{getAllTeachers().length}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <p className="text-sm text-gray-600 mb-1">Total Classes</p>
                        <p className="text-3xl font-bold text-purple-600">{results.reduce((sum, r) => sum + r.classes.length, 0)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                        <p className="text-sm text-gray-600 mb-1">Total Errors</p>
                        <p className="text-3xl font-bold text-red-600">
                            {results.reduce((sum, r) => sum + r.failedUsers.length + r.failedClasses.length, 0)}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Common Send Package Form */}
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">📦 Send Welcome Package (All Students)</h4>
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Package URL (e.g., https://app.example.com/welcome)"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Button size="lg">
                        Send to {getAllStudents().length} Students
                    </Button>
                </div>
            </Card>

            {/* Results by School */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-900">Results by School</h3>

                {results.map((result, index) => {
                    const isExpanded = expandedSchools.has(result.schoolPrefix)
                    const totalUsers = result.students.length + result.teachers.length
                    const totalErrors = result.failedUsers.length + result.failedClasses.length

                    return (
                        <Card key={result.schoolPrefix} className="overflow-hidden border-2 border-gray-200 hover:border-blue-300 transition-colors">
                            {/* School Header */}
                            <div
                                onClick={() => toggleSchool(result.schoolPrefix)}
                                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-900">{result.schoolPrefix}</h4>
                                            <p className="text-sm text-gray-600">
                                                {totalUsers} users • {result.classes.length} classes
                                                {totalErrors > 0 && <span className="text-red-600"> • {totalErrors} errors</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <svg
                                        className={`w-6 h-6 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {/* School Details */}
                            {isExpanded && (
                                <div className="border-t border-gray-200 bg-gray-50 p-6 space-y-6">
                                    {/* Copy Buttons */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => copyToClipboard(
                                                result.students.map(s => s.actualUserName || s.username).join('\n'),
                                                'Student Usernames'
                                            )}
                                        >
                                            📋 Student Usernames
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => copyToClipboard(
                                                result.students.map(s => s.password).join('\n'),
                                                'Student Passwords'
                                            )}
                                        >
                                            🔑 Student Passwords
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => copyToClipboard(
                                                result.teachers.map(t => t.actualUserName || t.username).join('\n'),
                                                'Teacher Usernames'
                                            )}
                                        >
                                            📋 Teacher Usernames
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => copyToClipboard(
                                                result.teachers.map(t => t.password).join('\n'),
                                                'Teacher Passwords'
                                            )}
                                        >
                                            🔑 Teacher Passwords
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => copyToClipboard(
                                                JSON.stringify(result, null, 2),
                                                'Full Result JSON'
                                            )}
                                        >
                                            📄 Copy Result JSON
                                        </Button>
                                    </div>

                                    {/* Students List */}
                                    <div>
                                        <h5 className="font-semibold text-gray-900 mb-3">👨‍🎓 Students ({result.students.length})</h5>
                                        <div className="bg-white rounded-lg border border-gray-200 max-h-64 overflow-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left font-semibold text-gray-700">#</th>
                                                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Username</th>
                                                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Display Name</th>
                                                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Class</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.students.map((student, i) => (
                                                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                                                            <td className="px-4 py-2 text-gray-600">{i + 1}</td>
                                                            <td className="px-4 py-2 font-mono text-blue-600">{student.actualUserName || student.username}</td>
                                                            <td className="px-4 py-2">{student.actualDisplayName || student.displayName}</td>
                                                            <td className="px-4 py-2 text-gray-600">{student.classses}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Teachers List */}
                                    {result.teachers.length > 0 && (
                                        <div>
                                            <h5 className="font-semibold text-gray-900 mb-3">👨‍🏫 Teachers ({result.teachers.length})</h5>
                                            <div className="bg-white rounded-lg border border-gray-200 max-h-48 overflow-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 sticky top-0">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">#</th>
                                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Username</th>
                                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Display Name</th>
                                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Classes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {result.teachers.map((teacher, i) => (
                                                            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                                                                <td className="px-4 py-2 text-gray-600">{i + 1}</td>
                                                                <td className="px-4 py-2 font-mono text-blue-600">{teacher.actualUserName || teacher.username}</td>
                                                                <td className="px-4 py-2">{teacher.actualDisplayName || teacher.displayName}</td>
                                                                <td className="px-4 py-2 text-gray-600">{teacher.classses}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Classes List */}
                                    <div>
                                        <h5 className="font-semibold text-gray-900 mb-3">🏫 Classes ({result.classes.length})</h5>
                                        <div className="flex flex-wrap gap-2">
                                            {result.classes.map((cls, i) => (
                                                <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                                                    {cls.username}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Errors */}
                                    {totalErrors > 0 && (
                                        <div>
                                            <h5 className="font-semibold text-red-900 mb-3">❌ Errors ({totalErrors})</h5>
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-48 overflow-auto">
                                                {result.failedUsers.map((user, i) => (
                                                    <div key={`user-${i}`} className="text-sm text-red-700 mb-2">
                                                        User: {user.username} - {user.reason}
                                                    </div>
                                                ))}
                                                {result.failedClasses.map((cls, i) => (
                                                    <div key={`class-${i}`} className="text-sm text-red-700 mb-2">
                                                        Class: {cls.username} - {cls.reason}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    )
                })}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
                <Button
                    onClick={() => copyToClipboard(
                        JSON.stringify(results, null, 2),
                        'All Results'
                    )}
                >
                    📋 Copy All Results
                </Button>
            </div>
        </div>
    )
}
