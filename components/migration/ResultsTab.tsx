import { useState } from 'react'
import { MigrationResult } from '@/types'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { PackageAssignmentSection } from './PackageAssignmentSection'

interface ResultsTabProps {
  result: MigrationResult | null
  createdUsers: any[]
  failedUsers: Array<{ user: any; error: string }>
  showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export default function ResultsTab({ result, createdUsers, failedUsers, showNotification }: ResultsTabProps) {
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

      {/* Package Assignment Section */}
      {studentsForPackage.length > 0 && (
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
