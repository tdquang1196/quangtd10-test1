import { StudentData, TeacherData } from '@/types'
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

interface PreviewTabProps {
  students: StudentData[]
  teachers: TeacherData[]
  isCreating: boolean
  progressMessage: string
  totalCount: number
  existingClasses: string[]
  isCheckingClasses: boolean
}

export default function PreviewTab({ students, teachers, isCreating, progressMessage, totalCount, existingClasses, isCheckingClasses }: PreviewTabProps) {
  const uniqueClasses = Array.from(new Set(students.map(s => s.className)))
  const existingClassSet = new Set(existingClasses)
  const newClassesCount = uniqueClasses.filter(c => !existingClassSet.has(c)).length
  const existingClassesCount = uniqueClasses.filter(c => existingClassSet.has(c)).length

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
          <CardContent className="p-5 text-center">
            <div className="text-3xl font-bold text-blue-700 mb-1">{students.length}</div>
            <div className="text-sm font-semibold text-blue-600">Students</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
          <CardContent className="p-5 text-center">
            <div className="text-3xl font-bold text-purple-700 mb-1">{teachers.length}</div>
            <div className="text-sm font-semibold text-purple-600">Teachers</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
          <CardContent className="p-5 text-center">
            {isCheckingClasses ? (
              <>
                <div className="text-2xl font-bold text-green-700 mb-1">
                  <div className="inline-block w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="text-xs font-semibold text-green-600">Checking...</div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-green-700 mb-1">{uniqueClasses.length}</div>
                <div className="text-sm font-semibold text-green-600">Classes</div>
                {existingClasses.length > 0 && (
                  <div className="text-xs text-green-600 mt-1">
                    {newClassesCount} new, {existingClassesCount} existing
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200">
          <CardContent className="p-5 text-center">
            <div className="text-3xl font-bold text-orange-700 mb-1">{students.length + teachers.length}</div>
            <div className="text-sm font-semibold text-orange-600">Total Users</div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {isCreating && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-200 rounded-full"></div>
                <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-blue-900 mb-2">{progressMessage}</p>
                <p className="text-sm text-blue-700">Processing {totalCount} users... This may take a few minutes.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box - Existing Classes */}
      {existingClasses.length > 0 && !isCheckingClasses && (
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
          <CardContent className="p-5">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-yellow-900 mb-2">Existing Classes Detected</h3>
                <p className="text-sm text-yellow-800 mb-2">
                  {existingClassesCount} of {uniqueClasses.length} classes already exist in the system:
                </p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• <strong>Existing classes:</strong> Students will be added to the existing class (no new teachers created)</li>
                  <li>• <strong>New classes:</strong> Class and teacher accounts will be created</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Classes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Classes Overview
            </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Students</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueClasses.map((className) => {
                const teacher = teachers.find(t => t.className === className)
                const studentCount = students.filter(s => s.className === className).length
                const isExisting = existingClassSet.has(className)
                return (
                  <TableRow key={className}>
                    <TableCell className="font-semibold">{className}</TableCell>
                    <TableCell>
                      {isCheckingClasses ? (
                        <Badge variant="default">Checking...</Badge>
                      ) : isExisting ? (
                        <Badge variant="warning">Exists</Badge>
                      ) : (
                        <Badge variant="success">New</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isExisting ? (
                        <Badge variant="default" className="opacity-50">Skipped</Badge>
                      ) : (
                        <Badge variant="info">{teacher?.username || '-'}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">{studentCount}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Teachers Table */}
      {teachers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Teachers ({teachers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-auto">
              <Table>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Class</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono font-semibold">{teacher.username}</TableCell>
                      <TableCell className="font-mono text-purple-600">{teacher.password}</TableCell>
                      <TableCell>
                        <Badge variant="default">{teacher.className}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students Table */}
      {students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Students (First 50 of {students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.slice(0, 50).map((student, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold">{student.fullName}</TableCell>
                      <TableCell className="font-mono text-sm">{student.username}</TableCell>
                      <TableCell className="font-mono text-blue-600">{student.password}</TableCell>
                      <TableCell>
                        <Badge variant="default">{student.grade}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{student.className}</TableCell>
                      <TableCell className="text-sm text-gray-600">{student.phoneNumber}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {students.length > 50 && (
              <p className="text-sm text-gray-500 mt-3 text-center">
                Showing first 50 of {students.length} students
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
