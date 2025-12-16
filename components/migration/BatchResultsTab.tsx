'use client'

import { useState } from 'react'
import { Button, Card } from '@/components/ui'
import { PackageAssignmentSection } from './PackageAssignmentSection'

interface SchoolResult {
    schoolPrefix: string
    students: any[]
    teachers: any[]
    classes: any[]
    failedUsers: any[]
    failedClasses: any[]
    packageAssignment?: {
        success: number
        failed: number
        failedUsers: Array<{ userId: string; username?: string; displayName?: string; error: string }>
    } | null
}

interface BatchResultsTabProps {
    results: SchoolResult[]
    onClose: () => void
    retryBatchSchoolPackages?: (schoolIndex: number) => Promise<void>
    retryBatchSchoolFailedUsers?: (schoolIndex: number) => Promise<void>
    retryingSchoolIndex?: number | null
}

export default function BatchResultsTab({ results, onClose, retryBatchSchoolPackages, retryBatchSchoolFailedUsers, retryingSchoolIndex }: BatchResultsTabProps) {
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

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                    <div className="bg-white rounded-lg p-4 border border-orange-200">
                        <p className="text-sm text-gray-600 mb-1">Packages Assigned</p>
                        <p className="text-3xl font-bold text-orange-600">
                            {results.reduce((sum, r) => sum + (r.packageAssignment?.success || 0), 0)}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                        <p className="text-sm text-gray-600 mb-1">Total Errors</p>
                        <p className="text-3xl font-bold text-red-600">
                            {results.reduce((sum, r) => sum + r.failedUsers.length + r.failedClasses.length, 0)}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Package Assignment for All Schools */}
            {getAllStudents().filter(s => s.id).length > 0 && (
                <>
                    <div className="border-t-2 border-gray-200 my-4" />
                    <div className="text-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">📦 Package Assignment (All Schools)</h3>
                        <p className="text-sm text-gray-600">Assign subscription packages to all students from all schools</p>
                    </div>
                    <PackageAssignmentSection
                        users={getAllStudents()
                            .filter(s => s.id)
                            .map(s => ({
                                userId: s.id,
                                username: s.actualUserName || s.username,
                                displayName: s.displayName
                            }))}
                        onSuccess={(success, failed) => {
                            if (failed === 0) {
                                alert(`✅ Successfully assigned packages to all ${success} students!`)
                            } else {
                                alert(`⚠️ Assigned: ${success}, Failed: ${failed}`)
                            }
                        }}
                        onError={(error) => alert(`❌ Error: ${error}`)}
                    />
                </>
            )}

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
                                                {result.packageAssignment && (
                                                    <span className="text-orange-600">
                                                        {' '}• {result.packageAssignment.success} packages
                                                        {result.packageAssignment.failed > 0 && ` (${result.packageAssignment.failed} failed)`}
                                                    </span>
                                                )}
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
                                                result.teachers.map(t => t.classses).join('\n'),
                                                'Teacher Classes'
                                            )}
                                        >
                                            🏫 Teacher Classes
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

                                    {/* Per-School Package Assignment (if not already assigned via auto) */}
                                    {result.students.filter(s => s.id).length > 0 && !result.packageAssignment && (
                                        <div className="border-t border-gray-200 pt-4">
                                            <h5 className="font-semibold text-gray-900 mb-3">📦 Assign Packages ({result.students.filter(s => s.id).length} students)</h5>
                                            <PackageAssignmentSection
                                                users={result.students
                                                    .filter(s => s.id)
                                                    .map(s => ({
                                                        userId: s.id,
                                                        username: s.actualUserName || s.username,
                                                        displayName: s.displayName
                                                    }))}
                                                onSuccess={(success, failed) => {
                                                    if (failed === 0) {
                                                        alert(`✅ ${result.schoolPrefix}: Assigned packages to all ${success} students!`)
                                                    } else {
                                                        alert(`⚠️ ${result.schoolPrefix}: ${success} succeeded, ${failed} failed`)
                                                    }
                                                }}
                                                onError={(error) => alert(`❌ ${result.schoolPrefix}: ${error}`)}
                                            />
                                        </div>
                                    )}

                                    {/* Package Assignment Status */}
                                    {result.packageAssignment && (
                                        <div className={`p-4 rounded-lg border-2 ${result.packageAssignment.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.packageAssignment.failed === 0 ? 'bg-green-500' : 'bg-orange-500'}`}>
                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        {result.packageAssignment.failed === 0 ? (
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        ) : (
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        )}
                                                    </svg>
                                                </div>
                                                <div className="flex-1">
                                                    <h5 className={`font-semibold ${result.packageAssignment.failed === 0 ? 'text-green-900' : 'text-orange-900'}`}>
                                                        {result.packageAssignment.failed === 0 ? '📦 All Packages Assigned Successfully' : '📦 Package Assignment Completed with Errors'}
                                                    </h5>
                                                    <p className={`text-sm ${result.packageAssignment.failed === 0 ? 'text-green-700' : 'text-orange-700'}`}>
                                                        Success: {result.packageAssignment.success} students
                                                        {result.packageAssignment.failed > 0 && ` | Failed: ${result.packageAssignment.failed} students`}
                                                    </p>
                                                </div>
                                                {result.packageAssignment.failed > 0 && retryBatchSchoolPackages && (
                                                    <Button
                                                        onClick={() => retryBatchSchoolPackages(index)}
                                                        variant="secondary"
                                                        size="sm"
                                                        disabled={retryingSchoolIndex === index}
                                                        loading={retryingSchoolIndex === index}
                                                    >
                                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                        Retry ({result.packageAssignment.failed})
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Failed Users List */}
                                            {result.packageAssignment.failed > 0 && result.packageAssignment.failedUsers && result.packageAssignment.failedUsers.length > 0 && (
                                                <div className="mt-4 border-t border-orange-200 pt-4">
                                                    <h6 className="text-xs font-semibold text-orange-900 mb-2">Failed Assignments:</h6>
                                                    <div className="bg-white rounded border border-orange-200 max-h-32 overflow-auto">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-orange-50 sticky top-0">
                                                                <tr>
                                                                    <th className="px-2 py-1 text-left font-semibold text-gray-700">Username</th>
                                                                    <th className="px-2 py-1 text-left font-semibold text-gray-700">Error</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {result.packageAssignment.failedUsers.map((user, i) => (
                                                                    <tr key={i} className="border-t border-orange-100">
                                                                        <td className="px-2 py-1 font-mono text-gray-700">{user.username || user.userId}</td>
                                                                        <td className="px-2 py-1 text-red-600">{user.error}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Errors */}
                                    {totalErrors > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <h5 className="font-semibold text-red-900">❌ Errors ({totalErrors})</h5>
                                                {result.failedUsers.length > 0 && retryBatchSchoolFailedUsers && (
                                                    <Button
                                                        onClick={() => retryBatchSchoolFailedUsers(index)}
                                                        variant="secondary"
                                                        size="sm"
                                                        disabled={retryingSchoolIndex === index}
                                                        loading={retryingSchoolIndex === index}
                                                    >
                                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                        Retry Failed Users ({result.failedUsers.length})
                                                    </Button>
                                                )}
                                            </div>
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
