'use client'

import { Button, Card, Badge } from '@/components/ui'

interface SchoolPreviewData {
    schoolPrefix: string
    students: any[]
    teachers: any[]
    classes: string[]
}

interface BatchPreviewTabProps {
    schools: SchoolPreviewData[]
    onBack: () => void
    onCreate: () => void
    isCreating: boolean
}

export default function BatchPreviewTab({ schools, onBack, onCreate, isCreating }: BatchPreviewTabProps) {
    const totalStudents = schools.reduce((sum, s) => sum + s.students.length, 0)
    const totalTeachers = schools.reduce((sum, s) => sum + s.teachers.length, 0)
    const totalClasses = schools.reduce((sum, s) => sum + s.classes.length, 0)
    const totalWarnings = schools.reduce((sum, s) => sum + s.students.filter((st: any) => st.warning).length, 0)

    return (
        <div className="space-y-6">
            {/* Summary */}
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Migration Preview</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <p className="text-sm text-gray-600 mb-1">Schools</p>
                        <p className="text-3xl font-bold text-blue-600">{schools.length}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-gray-600 mb-1">Total Students</p>
                        <p className="text-3xl font-bold text-green-600">{totalStudents}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <p className="text-sm text-gray-600 mb-1">Total Teachers</p>
                        <p className="text-3xl font-bold text-purple-600">{totalTeachers}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-orange-200">
                        <p className="text-sm text-gray-600 mb-1">Total Classes</p>
                        <p className="text-3xl font-bold text-orange-600">{totalClasses}</p>
                    </div>
                    {totalWarnings > 0 && (
                        <div className="bg-white rounded-lg p-4 border-2 border-red-300 bg-red-50">
                            <p className="text-sm text-red-600 mb-1">⚠️ Warnings</p>
                            <p className="text-3xl font-bold text-red-600">{totalWarnings}</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* Global Warning Banner */}
            {totalWarnings > 0 && (
                <Card className="p-5 bg-red-50 border-2 border-red-200">
                    <div className="flex gap-3">
                        <div className="flex-shrink-0">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-red-900 mb-2">
                                ⚠️ {totalWarnings} Students Have Issues
                            </h3>
                            <p className="text-sm text-red-800 mb-2">
                                Please fix these in your Excel files before uploading. Issues include special characters in names or invalid grade formats.
                            </p>
                            <div className="text-sm text-red-700">
                                {schools.map(school => {
                                    const schoolWarnings = school.students.filter((s: any) => s.warning).length
                                    if (schoolWarnings === 0) return null
                                    return (
                                        <span key={school.schoolPrefix} className="mr-3">
                                            <strong>{school.schoolPrefix}:</strong> {schoolWarnings} warnings
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Schools Preview */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Schools to Migrate</h3>

                {schools.map((school, index) => {
                    const schoolWarnings = school.students.filter((s: any) => s.warning)
                    return (
                        <Card key={school.schoolPrefix} className="p-6 border-2 border-gray-200 hover:border-blue-300 transition-colors">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        {school.schoolPrefix}
                                        {schoolWarnings.length > 0 && (
                                            <Badge variant="warning">{schoolWarnings.length} warnings</Badge>
                                        )}
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                        {school.students.length} students • {school.teachers.length} teachers • {school.classes.length} classes
                                    </p>
                                </div>
                            </div>

                            {/* School-level Warning */}
                            {schoolWarnings.length > 0 && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm font-semibold text-red-800 mb-2">
                                        ⚠️ {schoolWarnings.length} students have issues:
                                    </p>
                                    <ul className="text-xs text-red-700 space-y-1 max-h-24 overflow-auto">
                                        {schoolWarnings.slice(0, 5).map((s: any, i: number) => (
                                            <li key={i}>
                                                • <strong>{s.fullName}</strong> ({s.grade}): {s.warning}
                                            </li>
                                        ))}
                                        {schoolWarnings.length > 5 && (
                                            <li className="text-red-500">...and {schoolWarnings.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            {/* Classes Preview */}
                            <div className="mb-4">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Classes ({school.classes.length}):</p>
                                <div className="flex flex-wrap gap-2">
                                    {school.classes.map((cls, i) => (
                                        <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                                            {cls}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Students Sample */}
                            <div className="mb-4">
                                <p className="text-sm font-semibold text-gray-700 mb-2">
                                    Students ({school.students.length}) - First 5:
                                </p>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="space-y-1 text-sm">
                                        {school.students.slice(0, 5).map((student, i) => (
                                            <div key={i} className={`flex gap-4 text-gray-700 ${student.warning ? 'bg-red-50 p-1 rounded' : ''}`}>
                                                <span className="font-mono text-blue-600">{student.username}</span>
                                                <span>{student.displayName}</span>
                                                <span className="text-gray-500">({student.className})</span>
                                                {student.warning && (
                                                    <span className="text-red-500 text-xs" title={student.warning}>⚠️</span>
                                                )}
                                            </div>
                                        ))}
                                        {school.students.length > 5 && (
                                            <p className="text-gray-500 italic pt-1">
                                                ... and {school.students.length - 5} more students
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Teachers */}
                            {school.teachers.length > 0 && (
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 mb-2">
                                        Teachers ({school.teachers.length}):
                                    </p>
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="space-y-1 text-sm">
                                            {school.teachers.map((teacher, i) => (
                                                <div key={i} className="flex gap-4 text-gray-700">
                                                    <span className="font-mono text-blue-600">{teacher.username}</span>
                                                    <span>{teacher.displayName}</span>
                                                    <span className="text-gray-500">({teacher.className})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    )
                })}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <Button variant="secondary" onClick={onBack} disabled={isCreating}>
                    ← Back to Upload
                </Button>
                <Button
                    onClick={onCreate}
                    loading={isCreating}
                    disabled={schools.length === 0}
                    size="lg"
                >
                    Create {totalStudents + totalTeachers} Users across {schools.length} Schools
                </Button>
            </div>
        </div>
    )
}
