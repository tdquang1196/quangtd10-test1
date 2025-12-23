import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
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
  schoolPrefix: string
}

export default function PreviewTab({ students, teachers, isCreating, progressMessage, totalCount, existingClasses: initialExistingClasses, isCheckingClasses: initialCheckingState, schoolPrefix }: PreviewTabProps) {
  const [existingClasses, setExistingClasses] = useState<string[]>(initialExistingClasses)
  const [isCheckingClasses, setIsCheckingClasses] = useState(initialCheckingState)
  const [existingAdminTeacher, setExistingAdminTeacher] = useState<{ username: string; displayName: string } | null>(null)
  const uniqueClasses = Array.from(new Set(students.map(s => s.className)))
  const existingClassSet = new Set(existingClasses)
  const newClassesCount = uniqueClasses.filter(c => !existingClassSet.has(c)).length
  const existingClassesCount = uniqueClasses.filter(c => existingClassSet.has(c)).length

  // Track if check is in progress to prevent duplicate calls
  const isCheckingRef = useRef(false)
  const hasFetchedRef = useRef(false)

  // Check if admin teacher checkbox is unchecked (no admin teacher in the list)
  const hasAdminTeacherInList = teachers.some(t => t.className && !t.className.includes('_'))
  const shouldFetchAdminTeacher = !hasAdminTeacherInList

  // Check existing classes when component mounts or when classes change
  useEffect(() => {
    let isCancelled = false

    // Skip if we've already fetched data for this component instance
    if (hasFetchedRef.current) {
      console.log('PreviewTab: Skipping - already fetched for this instance')
      return
    }

    // Skip if already checking
    if (isCheckingRef.current) {
      console.log('PreviewTab: Skipping - check already in progress')
      return
    }

    const checkExistingClasses = async () => {
      console.log('PreviewTab: Checking classes...', {
        uniqueClassesLength: uniqueClasses.length,
        schoolPrefix,
        uniqueClasses
      })

      if (uniqueClasses.length === 0 || !schoolPrefix) {
        console.log('PreviewTab: Skipping check - no classes or prefix')
        return
      }

      if (isCancelled) return

      // Mark as checking
      isCheckingRef.current = true
      setIsCheckingClasses(true)
      try {
        // Get configuration
        const apiUrl = process.env.NEXT_PUBLIC_API_URL

        console.log('PreviewTab: API Config', { apiUrl })

        if (!apiUrl) {
          console.error('PreviewTab: Missing API URL')
          setIsCheckingClasses(false)
          return
        }

        // Try to get existing token from localStorage
        let token = localStorage.getItem('auth_token')
        console.log('PreviewTab: Using token from localStorage', { hasToken: !!token })

        // Helper function to fetch groups
        const fetchGroups = async (authToken: string) => {
          const groupsResponse = await axios.get(
            `${apiUrl}/manage/User/Group?pageSize=1000&Text=${encodeURIComponent(schoolPrefix.toUpperCase())}`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`
              }
            }
          )
          return groupsResponse
        }

        // Try to fetch with existing token
        let groupsResponse
        try {
          if (token) {
            console.log('PreviewTab: Fetching groups with existing token...')
            groupsResponse = await fetchGroups(token)
          } else {
            throw new Error('No token available')
          }
        } catch (error: any) {
          // If 401 or no token, login and retry
          if (error.response?.status === 401 || !token) {
            console.log('PreviewTab: Token expired or missing, logging in...')

            // Remove invalid token
            localStorage.removeItem('auth_token')

            // Get admin credentials
            const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME
            const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD

            if (!adminUsername || !adminPassword) {
              console.error('PreviewTab: Missing admin credentials')
              setIsCheckingClasses(false)
              return
            }

            // Login to get new token
            const loginResponse = await axios.post(`${apiUrl}/auth/login`, {
              username: adminUsername,
              password: adminPassword
            })

            token = loginResponse.data.accessToken
            console.log('PreviewTab: Login successful, got new token')

            // Store new token
            if (token) {
              localStorage.setItem('auth_token', token)
              // Retry fetching groups with new token
              groupsResponse = await fetchGroups(token)
            } else {
              throw new Error('Failed to get access token')
            }
          } else {
            throw error
          }
        }

        if (isCancelled) return

        console.log('PreviewTab: Groups fetched', { count: groupsResponse.data.groups.length })

        // Create a map of existing class names
        const existingClassNames = new Set(
          groupsResponse.data.groups.map((g: any) => g.name.toLowerCase())
        )

        // Filter classes that exist
        const existing = uniqueClasses.filter(className =>
          existingClassNames.has(className.toLowerCase())
        )

        console.log('PreviewTab: Existing classes found', existing)
        if (!isCancelled) {
          setExistingClasses(existing)
        }

        // If admin teacher is not in the list, fetch existing admin teacher from backend
        if (shouldFetchAdminTeacher && schoolPrefix) {
          console.log('PreviewTab: Fetching existing admin teacher...')
          try {
            const adminTeacherUsername = `${schoolPrefix.toLowerCase()}gv`
            const usersResponse = await axios.get(
              `${apiUrl}/manage/Users?pageIndex=1&pageSize=100&filter=${adminTeacherUsername}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            )

            const adminTeacher = usersResponse.data.users.find((u: any) =>
              u.username.toLowerCase() === adminTeacherUsername
            )

            if (adminTeacher && !isCancelled) {
              console.log('PreviewTab: Found existing admin teacher', adminTeacher)
              setExistingAdminTeacher({
                username: adminTeacher.username,
                displayName: adminTeacher.displayName
              })
            } else {
              console.log('PreviewTab: No existing admin teacher found')
            }
          } catch (error) {
            console.error('PreviewTab: Failed to fetch admin teacher:', error)
          }
        }

        if (!isCancelled) {
          hasFetchedRef.current = true
        }
      } catch (error) {
        console.error('PreviewTab: Failed to check existing classes:', error)
      } finally {
        if (!isCancelled) {
          setIsCheckingClasses(false)
          isCheckingRef.current = false
        }
      }
    }

    checkExistingClasses()

    // Cleanup function to prevent setting state on unmounted component
    return () => {
      isCancelled = true
      isCheckingRef.current = false
    }
  }, [uniqueClasses.length, schoolPrefix])

  // Filter teachers: only show teachers for NEW classes (classes that don't exist)
  // Also keep the admin teacher (general teacher for all classes)
  const teachersToAdd = teachers.filter(teacher => {
    // Check if this is the admin teacher (className is the school prefix without grade/class)
    const isAdminTeacher = teacher.className && !teacher.className.includes('_')
    if (isAdminTeacher) return true

    // Only include teachers for NEW classes
    return !existingClassSet.has(teacher.className)
  })

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
            <div className="text-3xl font-bold text-purple-700 mb-1">{teachersToAdd.length}</div>
            <div className="text-sm font-semibold text-purple-600">Teachers</div>
            {teachers.length > teachersToAdd.length && (
              <div className="text-xs text-purple-600 mt-1">
                {teachers.length - teachersToAdd.length} skipped
              </div>
            )}
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
            <div className="text-3xl font-bold text-orange-700 mb-1">{students.length + teachersToAdd.length}</div>
            <div className="text-sm font-semibold text-orange-600">Total Users</div>
            <div className="text-xs text-orange-600 mt-1">
              to be created
            </div>
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
                  {existingClassesCount} of {uniqueClasses.length} classes already exist. Here's what will happen:
                </p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• <strong>Existing classes ({existingClassesCount}):</strong> Only students added, teachers skipped</li>
                  <li>• <strong>New classes ({newClassesCount}):</strong> Both students and teachers created</li>
                  <li>• <strong>Teachers to create:</strong> {teachersToAdd.length} of {teachers.length}</li>
                  {existingAdminTeacher && (
                    <li>• <strong>Existing admin teacher:</strong> {existingAdminTeacher.username} will be added to {newClassesCount} new classes</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box - Existing Admin Teacher */}
      {existingAdminTeacher && shouldFetchAdminTeacher && newClassesCount > 0 && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <CardContent className="p-5">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-2">Existing Admin Teacher Found</h3>
                <p className="text-sm text-blue-800 mb-2">
                  Admin teacher <strong>{existingAdminTeacher.username}</strong> ({existingAdminTeacher.displayName}) already exists.
                </p>
                <p className="text-sm text-blue-700">
                  This teacher will be automatically added to all {newClassesCount} new classes.
                </p>
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

      {/* Teachers Table - Only show teachers that will be created */}
      {teachersToAdd.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Teachers to Create ({teachersToAdd.length})
              {teachers.length > teachersToAdd.length && (
                <span className="text-sm font-normal text-gray-500">
                  ({teachers.length - teachersToAdd.length} skipped for existing classes)
                </span>
              )}
              {teachersToAdd.filter(t => t.warning).length > 0 && (
                <Badge variant="warning" className="ml-2">
                  {teachersToAdd.filter(t => t.warning).length} warnings
                </Badge>
              )}
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
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachersToAdd.map((teacher, idx) => {
                    const isAdminTeacher = teacher.className && !teacher.className.includes('_')
                    return (
                      <TableRow key={idx} className={teacher.warning ? 'bg-red-50' : ''}>
                        <TableCell className="font-mono font-semibold">
                          {teacher.username}
                          {teacher.warning && (
                            <span className="text-red-500 ml-1" title={teacher.warning}>⚠️</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-purple-600">{teacher.password}</TableCell>
                        <TableCell>
                          <Badge variant="default">{teacher.className}</Badge>
                        </TableCell>
                        <TableCell>
                          {isAdminTeacher ? (
                            <Badge variant="info">Admin Teacher</Badge>
                          ) : (
                            <Badge variant="success">New Class</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {teacher.warning ? (
                            <Badge variant="error" className="text-xs">
                              {teacher.warning}
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-xs">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
              {students.filter(s => s.warning).length > 0 && (
                <Badge variant="warning" className="ml-2">
                  {students.filter(s => s.warning).length} warnings
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Warning Banner */}
            {students.filter(s => s.warning).length > 0 && (() => {
              const studentsWithWarnings = students.filter(s => s.warning);
              const ageWarnings = studentsWithWarnings.filter(s => s.warning?.includes('Age') && s.warning?.includes('>= 16'));
              const otherWarnings = studentsWithWarnings.filter(s => !s.warning?.includes('Age') || !s.warning?.includes('>= 16'));

              return (
                <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-red-900 mb-2">
                        ⚠️ {studentsWithWarnings.length} Students Have Issues
                      </h3>
                      <div className="text-sm text-red-800 mb-2 space-y-1">
                        {ageWarnings.length > 0 && (
                          <p>🎂 <strong>{ageWarnings.length}</strong> students with age ≥ 16 (unusual for school migration)</p>
                        )}
                        {otherWarnings.length > 0 && (
                          <p>📝 <strong>{otherWarnings.length}</strong> students with name/format issues</p>
                        )}
                      </div>
                      <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-auto">
                        {studentsWithWarnings.slice(0, 10).map((s, i) => (
                          <li key={i}>
                            • <strong>{s.fullName}</strong> ({s.grade}): {s.warning}
                          </li>
                        ))}
                        {studentsWithWarnings.length > 10 && (
                          <li className="text-red-500">...and {studentsWithWarnings.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Calculate how many to show: all warnings + fill up to 50 total
                    const studentsWithWarnings = students.filter(s => s.warning);
                    const studentsWithoutWarnings = students.filter(s => !s.warning);
                    const remainingSlots = Math.max(0, 50 - studentsWithWarnings.length);
                    const normalStudentsToShow = studentsWithoutWarnings.slice(0, remainingSlots);

                    return (
                      <>
                        {/* Show ALL students with warnings first */}
                        {studentsWithWarnings.map((student, idx) => (
                          <TableRow key={`warn-${idx}`} className="bg-red-50">
                            <TableCell className="font-semibold">
                              {student.fullName}
                              <span className="text-red-500 ml-1" title={student.warning}>⚠️</span>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{student.username}</TableCell>
                            <TableCell className="font-mono text-blue-600">{student.password}</TableCell>
                            <TableCell>
                              <Badge variant="default">{student.grade}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{student.className}</TableCell>
                            <TableCell className="text-sm text-center">
                              {student.age ? (
                                <Badge variant={student.age >= 16 ? "warning" : "info"}>
                                  {student.age}
                                  {student.age >= 16 && " ⚠️"}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{student.phoneNumber}</TableCell>
                            <TableCell>
                              <Badge variant="error" className="text-xs">
                                {student.warning}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Then fill up to 50 total with students WITHOUT warnings */}
                        {normalStudentsToShow.map((student, idx) => (
                          <TableRow key={`ok-${idx}`}>
                            <TableCell className="font-semibold">{student.fullName}</TableCell>
                            <TableCell className="font-mono text-sm">{student.username}</TableCell>
                            <TableCell className="font-mono text-blue-600">{student.password}</TableCell>
                            <TableCell>
                              <Badge variant="default">{student.grade}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{student.className}</TableCell>
                            <TableCell className="text-sm text-center">
                              {student.age ? (
                                <Badge variant={student.age >= 16 ? "warning" : "info"}>
                                  {student.age}
                                  {student.age >= 16 && " ⚠️"}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{student.phoneNumber}</TableCell>
                            <TableCell>
                              <Badge variant="success" className="text-xs">OK</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>
            <div className="text-sm text-gray-500 mt-3 text-center space-y-1">
              {students.filter(s => s.warning).length > 0 && (
                <p className="text-red-600 font-medium">
                  ⚠️ Showing all {students.filter(s => s.warning).length} students with warnings
                </p>
              )}
              {(() => {
                const warningCount = students.filter(s => s.warning).length;
                const normalCount = students.filter(s => !s.warning).length;
                const shownNormal = Math.min(normalCount, Math.max(0, 50 - warningCount));
                if (normalCount > shownNormal) {
                  return (
                    <p>
                      + {shownNormal} of {normalCount} students without warnings (total shown: {warningCount + shownNormal})
                    </p>
                  );
                }
                return null;
              })()}
              <p className="text-xs text-blue-600 italic">
                ℹ️ Processing order remains unchanged (original file order)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
