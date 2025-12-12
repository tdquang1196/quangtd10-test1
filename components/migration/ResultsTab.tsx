import { useState } from 'react'
import { MigrationResult } from '@/types'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { PackageAssignmentSection } from './PackageAssignmentSection'

interface ResultsTabProps {
  result: MigrationResult | null
  createdUsers: any[]
  failedUsers: Array<{ user: any; error: string }>
  showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
  isAssigningPackages?: boolean
  packageAssignmentProgress?: number
  packageAssignmentResult?: {
    success: number
    failed: number
    failedUsers: Array<{ userId: string; username?: string; displayName?: string; error: string }>
  } | null
  retryFailedPackages?: () => Promise<void>
  retryFailedUsers?: () => Promise<void>
  retryRoleAssignment?: () => Promise<void>
  isRetrying?: boolean
}

export default function ResultsTab({
  result,
  createdUsers,
  failedUsers,
  showNotification,
  isAssigningPackages = false,
  packageAssignmentProgress = 0,
  packageAssignmentResult = null,
  retryFailedPackages,
  retryFailedUsers,
  retryRoleAssignment,
  isRetrying = false
}: ResultsTabProps) {
  // Package assignment tracking
  const [packageAssignmentStatus, setPackageAssignmentStatus] = useState<{
    attempted: boolean
    successCount: number
    failedCount: number
  } | null>(null)
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Copied to clipboard!', 'success')
    }).catch(() => {
      showNotification('Failed to copy', 'error')
    })
  }

  const copySuccessData = () => {
    if (!result) return

    const successStudents = result.ListDataStudent.filter((s: any) =>
      !result.ListUserError.find((e: any) => e.username === s.username)
    )
    const successTeachers = result.ListDataTeacher.filter((t: any) =>
      !result.ListUserError.find((e: any) => e.username === t.username)
    )

    const jsonData = {
      students: successStudents,
      teachers: successTeachers,
      summary: {
        totalStudents: successStudents.length,
        totalTeachers: successTeachers.length,
        totalUsers: successStudents.length + successTeachers.length
      },
      packageAssignment: packageAssignmentStatus || {
        attempted: false,
        successCount: 0,
        failedCount: 0
      }
    }

    copyToClipboard(JSON.stringify(jsonData, null, 2))
  }

  const copyErrorData = () => {
    if (!result || !result.ListUserError) return

    const jsonData = {
      failedUsers: result.ListUserError,
      failedClasses: result.ListClassError || [],
      summary: {
        totalFailedUsers: result.ListUserError.length,
        totalFailedClasses: result.ListClassError?.length || 0
      }
    }

    copyToClipboard(JSON.stringify(jsonData, null, 2))
  }

  const copyStudentUsernames = () => {
    const usernames = successStudents.map((s: any) => s.actualUserName || s.username).join('\n')
    copyToClipboard(usernames)
  }

  const copyStudentPasswords = () => {
    const passwords = successStudents.map((s: any) => s.password).join('\n')
    copyToClipboard(passwords)
  }

  const copyTeacherUsernames = () => {
    const usernames = successTeachers.map((t: any) => t.actualUserName || t.username).join('\n')
    copyToClipboard(usernames)
  }

  const copyTeacherPasswords = () => {
    const passwords = successTeachers.map((t: any) => t.password).join('\n')
    copyToClipboard(passwords)
  }

  const copyTeacherClasses = () => {
    const classes = successTeachers.map((t: any) => t.classses).join('\n')
    copyToClipboard(classes)
  }

  const successStudents = result?.ListDataStudent.filter((s: any) =>
    !result.ListUserError.find((e: any) => e.username === s.username)
  ) || []

  const successTeachers = result?.ListDataTeacher.filter((t: any) =>
    !result.ListUserError.find((e: any) => e.username === t.username)
  ) || []

  // Transform successful students for package assignment (only students with IDs)
  const studentsForPackage = successStudents
    .filter(s => s.id) // Ensure ID exists
    .map(s => ({
      userId: s.id!,
      username: s.actualUserName || s.username,
      displayName: s.displayName
    }))

  // Package assignment callbacks
  const handlePackageSuccess = (successCount: number, failedCount: number) => {
    setPackageAssignmentStatus({
      attempted: true,
      successCount,
      failedCount
    })

    // Show notification
    if (failedCount === 0) {
      showNotification(
        `Successfully assigned packages to all ${successCount} students`,
        'success'
      )
    } else {
      showNotification(
        `Packages assigned: ${successCount} succeeded, ${failedCount} failed`,
        'warning'
      )
    }
  }

  const handlePackageError = (error: string) => {
    showNotification(`Package assignment failed: ${error}`, 'error')
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-4xl font-bold text-green-700 mb-2">{createdUsers.length}</div>
            <div className="text-lg font-semibold text-green-600">Successfully Created</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-300">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-4xl font-bold text-red-700 mb-2">{failedUsers.length}</div>
            <div className="text-lg font-semibold text-red-600">Failed</div>
          </CardContent>
        </Card>
      </div>

      {/* Success - Students */}
      {successStudents.length > 0 && (
        <Card className="border-2 border-green-200">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Students Created Successfully ({successStudents.length})
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {successStudents.map((student: any, idx: number) => (
                    <TableRow key={`s-${idx}`}>
                      <TableCell className="font-mono text-xs text-gray-600">{student.id || '-'}</TableCell>
                      <TableCell className="font-mono font-semibold">{student.actualUserName || student.username}</TableCell>
                      <TableCell className="font-mono text-green-600 font-semibold">{student.password}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success - Teachers */}
      {successTeachers.length > 0 && (
        <Card className="border-2 border-purple-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Teachers Created Successfully ({successTeachers.length})
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Class</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {successTeachers.map((teacher: any, idx: number) => (
                    <TableRow key={`t-${idx}`}>
                      <TableCell className="font-mono text-xs text-gray-600">{teacher.id || '-'}</TableCell>
                      <TableCell className="font-mono font-semibold">{teacher.actualUserName || teacher.username}</TableCell>
                      <TableCell className="font-mono text-purple-600 font-semibold">{teacher.password}</TableCell>
                      <TableCell>
                        <Badge variant="info">{teacher.classses}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Copy Buttons */}
      {result && createdUsers.length > 0 && (
        <div className="space-y-4">
          {/* Main Copy Button */}
          <div className="flex justify-center">
            <Button
              onClick={copySuccessData}
              variant="success"
              size="lg"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
            >
              Copy All Success Data (JSON)
            </Button>
          </div>

          {/* Quick Copy Buttons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Student Usernames */}
            {successStudents.length > 0 && (
              <Button
                onClick={copyStudentUsernames}
                variant="secondary"
                size="md"
                className="w-full"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              >
                Copy Student Usernames
              </Button>
            )}

            {/* Student Passwords */}
            {successStudents.length > 0 && (
              <Button
                onClick={copyStudentPasswords}
                variant="secondary"
                size="md"
                className="w-full"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                }
              >
                Copy Student Passwords
              </Button>
            )}

            {/* Teacher Usernames */}
            {successTeachers.length > 0 && (
              <Button
                onClick={copyTeacherUsernames}
                variant="secondary"
                size="md"
                className="w-full"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
              >
                Copy Teacher Usernames
              </Button>
            )}

            {/* Teacher Passwords */}
            {successTeachers.length > 0 && (
              <Button
                onClick={copyTeacherPasswords}
                variant="secondary"
                size="md"
                className="w-full"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                }
              >
                Copy Teacher Passwords
              </Button>
            )}

            {/* Teacher Classes */}
            {successTeachers.length > 0 && (
              <Button
                onClick={copyTeacherClasses}
                variant="secondary"
                size="md"
                className="w-full"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              >
                Copy Teacher Classes
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Auto Package Assignment Status */}
      {isAssigningPackages && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-blue-900">Assigning Subscription Packages</h3>
              <span className="text-sm font-medium text-blue-700">
                {Math.round(packageAssignmentProgress)}%
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${packageAssignmentProgress}%` }}
              />
            </div>
            <p className="text-xs text-blue-600 text-center mt-2">
              Please wait, do not close this window...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Auto Package Assignment Result */}
      {packageAssignmentResult && (
        <Card className={`border-2 ${packageAssignmentResult.failed === 0 ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${packageAssignmentResult.failed === 0 ? 'bg-green-500' : 'bg-orange-500'}`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {packageAssignmentResult.failed === 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  )}
                </svg>
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold ${packageAssignmentResult.failed === 0 ? 'text-green-900' : 'text-orange-900'}`}>
                  {packageAssignmentResult.failed === 0
                    ? 'Subscription Packages Assigned Successfully!'
                    : 'Subscription Assignment Completed with Errors'}
                </h3>
                <p className={`text-sm ${packageAssignmentResult.failed === 0 ? 'text-green-700' : 'text-orange-700'}`}>
                  Success: {packageAssignmentResult.success} students
                  {packageAssignmentResult.failed > 0 && ` | Failed: ${packageAssignmentResult.failed} students`}
                </p>
              </div>
              {packageAssignmentResult.failed > 0 && retryFailedPackages && (
                <Button
                  onClick={retryFailedPackages}
                  variant="secondary"
                  size="sm"
                  disabled={isAssigningPackages}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  }
                >
                  Retry Failed ({packageAssignmentResult.failed})
                </Button>
              )}
            </div>

            {/* Failed Users List */}
            {packageAssignmentResult.failed > 0 && packageAssignmentResult.failedUsers.length > 0 && (
              <div className="mt-4 border-t border-orange-200 pt-4">
                <h4 className="text-sm font-semibold text-orange-900 mb-2">Failed Package Assignments:</h4>
                <div className="bg-white rounded-lg border border-orange-200 max-h-48 overflow-auto">
                  <Table>
                    <TableHeader sticky>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packageAssignmentResult.failedUsers.map((user, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">{user.username || user.userId}</TableCell>
                          <TableCell className="text-sm">{user.displayName || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="error" className="text-xs">{user.error}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Package Assignment Section */}
      {studentsForPackage.length > 0 && !isAssigningPackages && !packageAssignmentResult && (
        <>
          <div className="border-t-2 border-gray-200 my-8" />
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Package Assignment</h3>
            <p className="text-sm text-gray-600">Assign subscription packages to newly created students</p>
          </div>
          <PackageAssignmentSection
            users={studentsForPackage}
            onSuccess={handlePackageSuccess}
            onError={handlePackageError}
          />
        </>
      )}

      {/* Role Assignment Error */}
      {result?.roleAssignmentError && (
        <Card className="border-2 border-orange-300 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 text-lg">Teacher Role Assignment Failed</h3>
                <p className="text-sm text-orange-700 mt-1">
                  {result.roleAssignmentError}
                </p>
                <p className="text-xs text-orange-600 mt-2">
                  Teachers were created successfully but could not be assigned to the "Teacher" role.
                  This may be due to a network timeout or server issue.
                </p>
              </div>
              {retryRoleAssignment && (
                <Button
                  onClick={retryRoleAssignment}
                  variant="secondary"
                  size="md"
                  disabled={isRetrying}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  }
                >
                  {isRetrying ? 'Retrying...' : 'Retry Role Assignment'}
                </Button>
              )}
            </div>
            <div className="mt-4 bg-white rounded-lg border border-orange-200 p-4">
              <h4 className="text-sm font-semibold text-orange-900 mb-2">What this means:</h4>
              <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                <li>Teacher accounts were created successfully</li>
                <li>Teachers can log in and access the system</li>
                <li>However, they were not assigned to the "Teacher" role automatically</li>
                <li>Click "Retry Role Assignment" to try again</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Users */}
      {result && result.ListUserError && result.ListUserError.length > 0 && (
        <Card className="border-2 border-red-300">
          <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Failed Users ({result.ListUserError.length})
              </div>
              <div className="flex gap-2">
                {retryFailedUsers && (
                  <Button
                    onClick={retryFailedUsers}
                    variant="secondary"
                    size="sm"
                    disabled={isRetrying}
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    }
                  >
                    Retry Failed ({result.ListUserError.length})
                  </Button>
                )}
                <Button
                  onClick={copyErrorData}
                  variant="danger"
                  size="sm"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  }
                >
                  Copy Errors
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Error Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.ListUserError.map((failed: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{failed.username}</TableCell>
                      <TableCell className="font-mono">{failed.password}</TableCell>
                      <TableCell>{failed.classses}</TableCell>
                      <TableCell className="text-gray-600">{failed.phoneNumber || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="error">{failed.reason || 'Unknown error'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 bg-red-50 border-t border-red-200">
              <p className="text-sm text-red-800 flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Copy error data, fix issues in your Excel file, and re-upload only the failed users
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
