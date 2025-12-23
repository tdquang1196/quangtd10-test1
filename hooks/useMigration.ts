import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { processExcelData } from '@/utils/bulkRegistrationUtils'
import { StudentData, TeacherData, MigrationResult, NotificationState, TabType } from '@/types'
import { givePackageToUser } from '@/lib/api/users'
import {
  MigrationStatus,
  MigrationProgress
} from '@/lib/migrationService'
import {
  MigrationState,
  saveMigrationState,
  loadMigrationState,
  clearMigrationState,
  hasResumableState,
  generateSessionId,
} from '@/lib/migrationState'

export const useMigration = () => {
  const [file, setFile] = useState<File | null>(null)
  const [schoolPrefix, setSchoolPrefix] = useState('')
  const [students, setStudents] = useState<StudentData[]>([])
  const [teachers, setTeachers] = useState<TeacherData[]>([])
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [createdUsers, setCreatedUsers] = useState<any[]>([])
  const [failedUsers, setFailedUsers] = useState<Array<{ user: any; error: string }>>([])
  const [activeTab, setActiveTab] = useState<TabType>('upload')
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [notification, setNotification] = useState<NotificationState | null>(null)
  const [existingClasses, setExistingClasses] = useState<string[]>([])
  const [isCheckingClasses, setIsCheckingClasses] = useState(false)

  // Excel configuration
  const [excelConfig, setExcelConfig] = useState({
    startRow: 2, // Default: row 2 (skip header)
    fullNameColumn: 'A',
    gradeColumn: 'B',
    phoneNumberColumn: '', // Optional: column containing phone number
    birthDateColumn: '', // Optional: column containing birth date for age calculation
    usernameColumn: '', // Optional: if user already has username, skip them
    readAllSheets: false,
    excludeLastSheet: false // Optional: exclude last sheet (often teacher info)
  })

  // Subscription assignment state
  const [enableAutoSubscription, setEnableAutoSubscription] = useState(false)
  const [subscriptionId, setSubscriptionId] = useState('')
  const [subscriptionDescription, setSubscriptionDescription] = useState('')
  const [subscriptionRequester, setSubscriptionRequester] = useState('')
  const [subscriptionSource, setSubscriptionSource] = useState('4') // Default: TRIAL_GIVE
  const [isAssigningPackages, setIsAssigningPackages] = useState(false)
  const [packageAssignmentProgress, setPackageAssignmentProgress] = useState(0)
  const [packageAssignmentResult, setPackageAssignmentResult] = useState<{
    success: number
    failed: number
    failedUsers: Array<{ userId: string; username?: string; displayName?: string; error: string }>
  } | null>(null)

  // Batch migration state
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [currentSchoolIndex, setCurrentSchoolIndex] = useState(0)
  const [totalSchools, setTotalSchools] = useState(0)
  const [batchPreviewData, setBatchPreviewData] = useState<any[]>([])
  const [batchSubscriptionConfig, setBatchSubscriptionConfig] = useState<{
    enabled: boolean
    subscriptionId: string
    description: string
    requester: string
    source: string
  } | null>(null)
  const [retryingSchoolIndex, setRetryingSchoolIndex] = useState<number | null>(null)

  // Migration control state (pause/resume/cancel)
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('idle')
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null)
  const [migrationSessionId, setMigrationSessionId] = useState<string | null>(null)
  const [canResume, setCanResume] = useState(false)

  // Check for resumable state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCanResume(hasResumableState())
    }
  }, [])

  // Batch upload form state (persisted when navigating between tabs)
  const [batchSchoolsForm, setBatchSchoolsForm] = useState<Array<{
    id: string
    file: File | null
    schoolPrefix: string
    excelConfig: {
      startRow: number
      fullNameColumn: string
      gradeColumn: string
      phoneNumberColumn: string
      birthDateColumn: string
      usernameColumn: string
      readAllSheets: boolean
      excludeLastSheet: boolean
    }
    showConfig: boolean
  }>>([{
    id: crypto.randomUUID(),
    file: null,
    schoolPrefix: '',
    excelConfig: {
      startRow: 2,
      fullNameColumn: 'A',
      gradeColumn: 'B',
      phoneNumberColumn: '',
      birthDateColumn: '',
      usernameColumn: '',
      readAllSheets: false,
      excludeLastSheet: false
    },
    showConfig: false
  }])

  const [batchFormSubscriptionConfig, setBatchFormSubscriptionConfig] = useState<{
    enabled: boolean
    subscriptionId: string
    description: string
    requester: string
    source: string
  }>({
    enabled: false,
    subscriptionId: '',
    description: '',
    requester: '',
    source: '4'
  })

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ message, type })
  }

  const resetState = () => {
    setFile(null)
    setSchoolPrefix('')
    setStudents([])
    setTeachers([])
    setErrors([])
    setIsProcessing(false)
    setIsCreating(false)
    setCreatedUsers([])
    setFailedUsers([])
    setResult(null)
    setActiveTab('upload')
    setEnableAutoSubscription(false)
    setSubscriptionId('')
    setSubscriptionDescription('')
    setSubscriptionRequester('')
    setSubscriptionSource('4')
    setIsAssigningPackages(false)
    setPackageAssignmentProgress(0)
    setPackageAssignmentResult(null)
    setExcelConfig({
      startRow: 2,
      fullNameColumn: 'A',
      gradeColumn: 'B',
      phoneNumberColumn: '',
      birthDateColumn: '',
      usernameColumn: '',
      readAllSheets: false,
      excludeLastSheet: false
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setStudents([])
      setTeachers([])
      setErrors([])
    }
  }

  const clearFile = () => {
    setFile(null)
    setStudents([])
    setTeachers([])
    setErrors([])
  }

  const checkExistingClasses = async (studentList: StudentData[], prefix: string) => {
    setIsCheckingClasses(true)
    try {
      const uniqueClasses = Array.from(new Set(studentList.map(s => s.className)))

      // Get configuration
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || process.env.ADMIN_USERNAME
      const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD

      if (!apiUrl || !adminUsername || !adminPassword) {
        console.error('Missing configuration')
        return
      }

      // Use existing token from localStorage instead of logging in as admin
      const token = localStorage.getItem('auth_token')

      if (!token) {
        console.warn('No auth token found for checking classes')
        return
      }

      // Fetch existing groups from backend
      const groupsResponse = await axios.get(
        `${apiUrl}/manage/User/Group?pageSize=1000&Text=${encodeURIComponent(prefix.toUpperCase())}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      // Create a map of existing class names
      const existingClassNames = new Set(
        groupsResponse.data.groups.map((g: any) => g.name.toLowerCase())
      )

      // Filter classes that exist
      const existing = uniqueClasses.filter(className =>
        existingClassNames.has(className.toLowerCase())
      )

      setExistingClasses(existing)
    } catch (error) {
      console.error('Failed to check existing classes:', error)
    } finally {
      setIsCheckingClasses(false)
    }
  }

  // Convert column letter to index (A=0, B=1, etc.)
  const columnToIndex = (col: string): number => {
    let index = 0
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64)
    }
    return index - 1
  }

  const handleProcessFile = async () => {
    if (!file) {
      showNotification('Please select an Excel file to process', 'warning')
      return
    }

    if (!schoolPrefix || schoolPrefix.trim().length === 0) {
      showNotification('Please enter a school code', 'warning')
      return
    }

    setIsProcessing(true)
    setStudents([])
    setTeachers([])
    setErrors([])

    try {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })

          // Column indices
          const fullNameIdx = columnToIndex(excelConfig.fullNameColumn.toUpperCase())
          const gradeIdx = columnToIndex(excelConfig.gradeColumn.toUpperCase())
          // Optional columns - only read if mapping is provided
          const phoneIdx = excelConfig.phoneNumberColumn
            ? columnToIndex(excelConfig.phoneNumberColumn.toUpperCase())
            : -1
          const birthDateIdx = excelConfig.birthDateColumn
            ? columnToIndex(excelConfig.birthDateColumn.toUpperCase())
            : -1
          const usernameIdx = excelConfig.usernameColumn
            ? columnToIndex(excelConfig.usernameColumn.toUpperCase())
            : -1

          let allExcelRows: any[] = []
          let skippedCount = 0

          // Determine which sheets to read
          let sheetsToRead = excelConfig.readAllSheets
            ? [...workbook.SheetNames]
            : [workbook.SheetNames[0]]

          // Exclude last sheet if option is enabled (often contains teacher info)
          if (excelConfig.excludeLastSheet && sheetsToRead.length > 1) {
            sheetsToRead = sheetsToRead.slice(0, -1)
          }

          // Read data from selected sheets
          for (const sheetName of sheetsToRead) {
            const sheet = workbook.Sheets[sheetName]

            // Get sheet range to determine actual row numbers
            const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

            // Read with range starting from startRow (1-indexed in Excel, 0-indexed in range)
            const startRowIdx = excelConfig.startRow - 1 // Convert to 0-indexed
            const readRange = { ...range, s: { ...range.s, r: startRowIdx } }

            // Read data with the correct range
            const jsonData = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: '',
              range: readRange
            })

            // Map columns (jsonData now starts from startRow)
            const sheetRows = jsonData
              .map((row: any, idx: number) => {
                if (!Array.isArray(row)) return null

                // Check if username column is specified and has value - skip if already registered
                if (usernameIdx >= 0) {
                  const existingUsername = row[usernameIdx]?.toString().trim()
                  if (existingUsername) {
                    skippedCount++
                    return null // Skip this row
                  }
                }

                // Get optional values (only if column mapping is provided)
                const phoneNumber = phoneIdx >= 0 ? (row[phoneIdx]?.toString().trim() || '') : ''
                const birthDateValue = birthDateIdx >= 0 ? row[birthDateIdx] : undefined

                return {
                  fullName: (row[fullNameIdx]?.toString().trim() || ''),
                  grade: (row[gradeIdx]?.toString().trim() || ''),
                  phoneNumber,
                  birthDate: birthDateValue,
                  _sheet: sheetName,
                  _row: excelConfig.startRow + idx
                }
              })
              .filter((row: any) => row && row.fullName && row.grade)

            allExcelRows = [...allExcelRows, ...sheetRows]
          }

          // Show skipped count if any
          if (skippedCount > 0) {
            console.log(`Skipped ${skippedCount} rows (already have username)`)
          }

          if (allExcelRows.length === 0) {
            showNotification('No valid data found in Excel file', 'warning')
            setIsProcessing(false)
            return
          }

          const processed = processExcelData(
            allExcelRows,
            schoolPrefix.trim().toLowerCase(),
            new Set(),
            new Set()
          )

          setStudents(processed.students)
          setTeachers(processed.teachers)
          setErrors(processed.errors)

          if (processed.students.length > 0) {
            setActiveTab('preview')
            const sheetInfo = excelConfig.readAllSheets ? ` from ${sheetsToRead.length} sheet(s)` : ''
            showNotification(`Found ${processed.students.length} student(s) and ${processed.teachers.length} teacher(s)${sheetInfo}`, 'success')

            // Check existing classes
            checkExistingClasses(processed.students, schoolPrefix.trim().toLowerCase())
          }

          setIsProcessing(false)
        } catch (parseError) {
          console.error('Excel parsing error:', parseError)
          showNotification('Failed to parse Excel file. Please check the file format.', 'error')
          setIsProcessing(false)
        }
      }

      reader.onerror = () => {
        showNotification('Failed to read the file', 'error')
        setIsProcessing(false)
      }

      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('File processing error:', error)
      showNotification(error instanceof Error ? error.message : 'Unknown error', 'error')
      setIsProcessing(false)
    }
  }

  // Auto-assign packages to successfully migrated students
  const assignPackagesToStudents = async (students: any[]) => {
    if (!enableAutoSubscription || !subscriptionId || students.length === 0) {
      return
    }

    setIsAssigningPackages(true)
    setPackageAssignmentProgress(0)
    setProgressMessage(`Assigning subscription packages to ${students.length} students...`)

    const BATCH_SIZE = 5
    const BATCH_DELAY_MS = 300
    let successCount = 0
    const failedUsers: Array<{ userId: string; username?: string; displayName?: string; error: string }> = []

    try {
      // Split into batches
      const batches: any[][] = []
      for (let i = 0; i < students.length; i += BATCH_SIZE) {
        batches.push(students.slice(i, i + BATCH_SIZE))
      }

      // Process batches
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]

        // Parallel requests within batch
        const results = await Promise.allSettled(
          batch.map((student) =>
            givePackageToUser({
              subscriptionId: subscriptionId,
              userId: student.id,
              description: subscriptionDescription || `Migration batch ${new Date().toISOString().split('T')[0]}`,
              source: parseInt(subscriptionSource),
              requester: subscriptionRequester || 'Migration Tool',
            })
          )
        )

        // Process results
        results.forEach((result, idx) => {
          const student = batch[idx]
          if (result.status === 'fulfilled') {
            successCount++
          } else {
            const errorMsg = result.reason?.response?.data?.message || result.reason?.message || 'Unknown error'
            failedUsers.push({
              userId: student.id,
              username: student.actualUserName || student.username,
              displayName: student.displayName,
              error: errorMsg
            })
          }
        })

        // Update progress
        const processedCount = (batchIndex + 1) * BATCH_SIZE
        setPackageAssignmentProgress((Math.min(processedCount, students.length) / students.length) * 100)

        // Delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
        }
      }

      setPackageAssignmentResult({ success: successCount, failed: failedUsers.length, failedUsers })

      if (failedUsers.length === 0) {
        showNotification(`Successfully assigned packages to all ${successCount} students`, 'success')
      } else {
        showNotification(`Assigned: ${successCount}, Failed: ${failedUsers.length}`, 'warning')
      }
    } catch (error) {
      console.error('Package assignment error:', error)
      showNotification('Failed to assign packages', 'error')
    } finally {
      setIsAssigningPackages(false)
      setProgressMessage('')
    }
  }

  // Retry failed package assignments (single school)
  const retryFailedPackages = async () => {
    if (!packageAssignmentResult?.failedUsers.length || !subscriptionId) {
      return
    }

    setIsAssigningPackages(true)
    setPackageAssignmentProgress(0)
    setProgressMessage(`Retrying ${packageAssignmentResult.failedUsers.length} failed package assignments...`)

    const BATCH_SIZE = 5
    const BATCH_DELAY_MS = 300
    let successCount = packageAssignmentResult.success
    const stillFailedUsers: Array<{ userId: string; username?: string; displayName?: string; error: string }> = []

    try {
      const usersToRetry = packageAssignmentResult.failedUsers
      const batches: any[][] = []
      for (let i = 0; i < usersToRetry.length; i += BATCH_SIZE) {
        batches.push(usersToRetry.slice(i, i + BATCH_SIZE))
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]

        const results = await Promise.allSettled(
          batch.map((user) =>
            givePackageToUser({
              subscriptionId: subscriptionId,
              userId: user.userId,
              description: subscriptionDescription || `Migration batch ${new Date().toISOString().split('T')[0]}`,
              source: parseInt(subscriptionSource),
              requester: subscriptionRequester || 'Migration Tool',
            })
          )
        )

        results.forEach((result, idx) => {
          const user = batch[idx]
          if (result.status === 'fulfilled') {
            successCount++
          } else {
            const errorMsg = result.reason?.response?.data?.message || result.reason?.message || 'Unknown error'
            stillFailedUsers.push({ ...user, error: errorMsg })
          }
        })

        const processedCount = (batchIndex + 1) * BATCH_SIZE
        setPackageAssignmentProgress((Math.min(processedCount, usersToRetry.length) / usersToRetry.length) * 100)

        if (batchIndex < batches.length - 1) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
        }
      }

      setPackageAssignmentResult({ success: successCount, failed: stillFailedUsers.length, failedUsers: stillFailedUsers })

      if (stillFailedUsers.length === 0) {
        showNotification(`Successfully retried all failed assignments!`, 'success')
      } else {
        showNotification(`Retry: ${successCount - packageAssignmentResult.success} succeeded, ${stillFailedUsers.length} still failed`, 'warning')
      }
    } catch (error) {
      console.error('Retry error:', error)
      showNotification('Failed to retry package assignments', 'error')
    } finally {
      setIsAssigningPackages(false)
      setProgressMessage('')
    }
  }

  const handleCreateUsers = async () => {
    if (students.length === 0 && teachers.length === 0) {
      showNotification('Please process an Excel file first', 'warning')
      return
    }

    setIsCreating(true)
    setMigrationStatus('running')
    setMigrationSessionId(generateSessionId())
    setProgressMessage(`Processing ${students.length} students and ${teachers.length} teachers...`)
    setCreatedUsers([])
    setFailedUsers([])
    setTotalCount(students.length + teachers.length)

    try {
      const listDataStudent = students.map(student => ({
        username: student.username,
        displayName: student.displayName,
        password: student.password,
        classses: student.className,
        phoneNumber: student.phoneNumber || '',
        age: student.age
      }))

      const listDataTeacher = teachers.map(teacher => ({
        username: teacher.username,
        displayName: teacher.displayName,
        password: teacher.password,
        classses: teacher.className,
        phoneNumber: ''
      }))

      const uniqueClasses = Array.from(new Set(students.map(s => s.className)))
      const listDataClasses = uniqueClasses.map(className => {
        // Find the first student with this className to get the grade
        const studentWithClass = students.find(s => s.className === className)
        // Extract grade number from grade string (e.g., "1A" -> 1, "2B" -> 2)
        const gradeMatch = studentWithClass?.grade.match(/^\d+/)
        const gradeNumber = gradeMatch ? parseInt(gradeMatch[0]) : undefined

        return {
          username: className,
          displayName: '',
          password: '',
          classses: className,
          phoneNumber: '',
          grade: gradeNumber
        }
      })

      const token = localStorage.getItem('auth_token')
      const response = await axios.post('/api/migrate', {
        ListDataStudent: listDataStudent,
        ListDataTeacher: listDataTeacher,
        ListDataClasses: listDataClasses
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const apiResult = response.data
      setResult(apiResult)

      const allCreated = [
        ...(apiResult.ListDataStudent || []).map((s: any) => ({ username: s.username, displayName: s.displayName, role: 'Student' })),
        ...(apiResult.ListDataTeacher || []).map((t: any) => ({ username: t.username, displayName: t.displayName, role: 'Teacher' }))
      ]
      setCreatedUsers(allCreated)

      const allFailed = (apiResult.ListUserError || []).map((u: any) => ({
        user: { username: u.username, displayName: u.displayName },
        error: u.Reason || 'Failed to create user'
      }))
      setFailedUsers(allFailed)

      setIsCreating(false)
      // Update migration status based on API response
      setMigrationStatus(apiResult.migrationStatus || 'completed')
      clearMigrationState() // Clear saved state on completion
      setActiveTab('results')

      const successCount = allCreated.length
      const failCount = allFailed.length
      const classErrorCount = apiResult.ListClassError?.length || 0

      const message = `Created ${successCount} users, ${apiResult.ListDataClasses?.length || 0} classes. ${failCount > 0 ? `${failCount} users failed.` : ''} ${classErrorCount > 0 ? `${classErrorCount} classes failed.` : ''}`
      showNotification(message, successCount > 0 ? 'success' : 'error')

      // Auto-assign packages to successfully created students
      if (enableAutoSubscription && successCount > 0) {
        const successfulStudents = apiResult.ListDataStudent?.filter((s: any) => s.id) || []
        if (successfulStudents.length > 0) {
          await assignPackagesToStudents(successfulStudents)
        }
      }
    } catch (error) {
      console.error('Migration error:', error)
      setIsCreating(false)
      setMigrationStatus('idle')
      showNotification(error instanceof Error ? error.message : 'Unknown error occurred', 'error')
    }
  }

  // Process batch files and show preview
  const handleProcessBatch = async (
    schools: Array<{
      id: string
      file: File | null
      schoolPrefix: string
      excelConfig: {
        startRow: number
        fullNameColumn: string
        gradeColumn: string
        phoneNumberColumn: string
        usernameColumn: string
        readAllSheets: boolean
        excludeLastSheet: boolean
      }
    }>,
    subscriptionConfig?: {
      enabled: boolean
      subscriptionId: string
      description: string
      requester: string
      source: string
    }
  ) => {
    // Save subscription config for batch processing
    if (subscriptionConfig) {
      setBatchSubscriptionConfig(subscriptionConfig)
    }
    setIsProcessing(true)
    setBatchPreviewData([])

    const previewData: any[] = []

    for (let i = 0; i < schools.length; i++) {
      const school = schools[i]
      setProgressMessage(`Processing file ${i + 1}/${schools.length}: ${school.schoolPrefix}`)

      // Use each school's own excelConfig
      const config = school.excelConfig

      try {
        const fileData = await new Promise<any>((resolve, reject) => {
          if (!school.file) {
            reject(new Error('No file provided'))
            return
          }

          const reader = new FileReader()
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer)
              const workbook = XLSX.read(data, { type: 'array' })

              // Column indices (same as single school)
              const fullNameIdx = columnToIndex(config.fullNameColumn.toUpperCase())
              const gradeIdx = columnToIndex(config.gradeColumn.toUpperCase())
              // Optional columns - only read if mapping is provided
              const phoneIdx = config.phoneNumberColumn
                ? columnToIndex(config.phoneNumberColumn.toUpperCase())
                : -1
              const birthDateIdx = (config as any).birthDateColumn
                ? columnToIndex((config as any).birthDateColumn.toUpperCase())
                : -1
              const usernameIdx = config.usernameColumn
                ? columnToIndex(config.usernameColumn.toUpperCase())
                : -1

              let allExcelRows: any[] = []
              let skippedCount = 0

              // Determine which sheets to read
              let sheetsToRead = config.readAllSheets
                ? [...workbook.SheetNames]
                : [workbook.SheetNames[0]]

              // Exclude last sheet if option is enabled (often contains teacher info)
              if (config.excludeLastSheet && sheetsToRead.length > 1) {
                sheetsToRead = sheetsToRead.slice(0, -1)
              }

              // Read data from selected sheets
              for (const sheetName of sheetsToRead) {
                const sheet = workbook.Sheets[sheetName]

                // Get sheet range to determine actual row numbers
                const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

                // Read with range starting from startRow (1-indexed in Excel, 0-indexed in range)
                const startRowIdx = config.startRow - 1 // Convert to 0-indexed
                const readRange = { ...range, s: { ...range.s, r: startRowIdx } }

                // Read data with the correct range
                const jsonData = XLSX.utils.sheet_to_json(sheet, {
                  header: 1,
                  defval: '',
                  range: readRange
                })

                // Map columns (jsonData now starts from startRow)
                const sheetRows = jsonData
                  .map((row: any, idx: number) => {
                    if (!Array.isArray(row)) return null

                    // Check if username column is specified and has value - skip if already registered
                    if (usernameIdx >= 0) {
                      const existingUsername = row[usernameIdx]?.toString().trim()
                      if (existingUsername) {
                        skippedCount++
                        return null // Skip this row
                      }
                    }

                    // Get optional values (only if column mapping is provided)
                    const phoneNumber = phoneIdx >= 0 ? (row[phoneIdx]?.toString().trim() || '') : ''
                    const birthDateValue = birthDateIdx >= 0 ? row[birthDateIdx] : undefined

                    return {
                      fullName: (row[fullNameIdx]?.toString().trim() || ''),
                      grade: (row[gradeIdx]?.toString().trim() || ''),
                      phoneNumber,
                      birthDate: birthDateValue,
                      _sheet: sheetName,
                      _row: config.startRow + idx
                    }
                  })
                  .filter((row: any) => row && row.fullName && row.grade)

                allExcelRows = [...allExcelRows, ...sheetRows]
              }

              // Log skipped count if any
              if (skippedCount > 0) {
                console.log(`[${school.schoolPrefix}] Skipped ${skippedCount} rows (already have username)`)
              }

              if (allExcelRows.length === 0) {
                reject(new Error('No valid data found in Excel file'))
                return
              }

              const processed = processExcelData(
                allExcelRows,
                school.schoolPrefix.trim().toLowerCase(),
                new Set(),
                new Set()
              )

              resolve(processed)
            } catch (error) {
              reject(error)
            }
          }
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsArrayBuffer(school.file)
        })

        const uniqueClasses = Array.from(new Set(fileData.students.map((s: any) => s.className)))

        previewData.push({
          schoolPrefix: school.schoolPrefix,
          students: fileData.students,
          teachers: fileData.teachers,
          classes: uniqueClasses
        })
      } catch (error) {
        console.error(`Failed to process file for ${school.schoolPrefix}:`, error)
        showNotification(
          `Failed to process ${school.schoolPrefix}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        )
        setIsProcessing(false)
        return
      }
    }

    setBatchPreviewData(previewData)
    setIsProcessing(false)
    setActiveTab('batch-preview')
    showNotification(
      `Processed ${previewData.length} schools successfully`,
      'success'
    )
  }

  // Create users from batch preview data
  const handleCreateBatch = async () => {
    if (batchPreviewData.length === 0) return

    setIsBatchProcessing(true)
    setMigrationStatus('running')
    setMigrationSessionId(generateSessionId())
    setTotalSchools(batchPreviewData.length)
    setCurrentSchoolIndex(0)
    setBatchResults([])
    setActiveTab('batch-results')

    const results: any[] = []

    for (let i = 0; i < batchPreviewData.length; i++) {
      const school = batchPreviewData[i]
      setCurrentSchoolIndex(i + 1)
      setProgressMessage(`Migrating school ${i + 1}/${batchPreviewData.length}: ${school.schoolPrefix}`)

      let packageResult: { success: number; failed: number; failedUsers: Array<{ userId: string; username?: string; displayName?: string; error: string }> } | null = null

      try {
        const listDataStudent = school.students.map((student: any) => ({
          username: student.username,
          displayName: student.displayName,
          password: student.password,
          classses: student.className,
          phoneNumber: student.phoneNumber || '',
          age: student.age
        }))

        const listDataTeacher = school.teachers.map((teacher: any) => ({
          username: teacher.username,
          displayName: teacher.displayName,
          password: teacher.password,
          classses: teacher.className,
          phoneNumber: ''
        }))

        const listDataClasses = school.classes.map((className: string) => {
          const studentWithClass = school.students.find((s: any) => s.className === className)
          const gradeMatch = studentWithClass?.grade.match(/^\d+/)
          const gradeNumber = gradeMatch ? parseInt(gradeMatch[0]) : undefined

          return {
            username: className,
            displayName: '',
            password: '',
            classses: className,
            phoneNumber: '',
            grade: gradeNumber
          }
        })

        const token = localStorage.getItem('auth_token')
        const response = await axios.post('/api/migrate', {
          ListDataStudent: listDataStudent,
          ListDataTeacher: listDataTeacher,
          ListDataClasses: listDataClasses
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        const apiResult = response.data

        // Auto-assign packages if enabled
        if (batchSubscriptionConfig?.enabled && batchSubscriptionConfig.subscriptionId) {
          const successfulStudents = apiResult.ListDataStudent?.filter((s: any) => s.id) || []
          if (successfulStudents.length > 0) {
            setProgressMessage(`Assigning packages to ${successfulStudents.length} students in ${school.schoolPrefix}...`)

            const BATCH_SIZE = 5
            const BATCH_DELAY_MS = 300
            let successCount = 0
            const failedUsers: Array<{ userId: string; username?: string; displayName?: string; error: string }> = []

            try {
              // Split into batches
              const batches: any[][] = []
              for (let j = 0; j < successfulStudents.length; j += BATCH_SIZE) {
                batches.push(successfulStudents.slice(j, j + BATCH_SIZE))
              }

              // Process batches
              for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex]

                const batchResults = await Promise.allSettled(
                  batch.map((student: any) =>
                    givePackageToUser({
                      subscriptionId: batchSubscriptionConfig.subscriptionId,
                      userId: student.id,
                      description: batchSubscriptionConfig.description || `Batch migration ${new Date().toISOString().split('T')[0]}`,
                      source: parseInt(batchSubscriptionConfig.source),
                      requester: batchSubscriptionConfig.requester || 'Migration Tool',
                    })
                  )
                )

                batchResults.forEach((result, idx) => {
                  const student = batch[idx]
                  if (result.status === 'fulfilled') {
                    successCount++
                  } else {
                    const errorMsg = result.reason?.response?.data?.message || result.reason?.message || 'Unknown error'
                    failedUsers.push({
                      userId: student.id,
                      username: student.actualUserName || student.username,
                      displayName: student.displayName,
                      error: errorMsg
                    })
                  }
                })

                if (batchIndex < batches.length - 1) {
                  await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
                }
              }

              packageResult = { success: successCount, failed: failedUsers.length, failedUsers }
            } catch (error) {
              console.error(`Package assignment error for ${school.schoolPrefix}:`, error)
            }
          }
        }

        results.push({
          schoolPrefix: school.schoolPrefix,
          students: apiResult.ListDataStudent || [],
          teachers: apiResult.ListDataTeacher || [],
          classes: apiResult.ListDataClasses || [],
          failedUsers: apiResult.ListUserError || [],
          failedClasses: apiResult.ListClassError || [],
          packageAssignment: packageResult,
          roleAssignmentError: apiResult.roleAssignmentError || undefined
        })

        const userCount = (apiResult.ListDataStudent?.length || 0) + (apiResult.ListDataTeacher?.length || 0)
        let message = `✅ ${school.schoolPrefix}: Created ${userCount} users`
        if (packageResult) {
          message += ` | Packages: ${packageResult.success} assigned`
          if (packageResult.failed > 0) {
            message += `, ${packageResult.failed} failed`
          }
        }
        showNotification(message, 'success')
      } catch (error) {
        console.error(`Failed to migrate school ${school.schoolPrefix}:`, error)
        results.push({
          schoolPrefix: school.schoolPrefix,
          students: [],
          teachers: [],
          classes: [],
          failedUsers: [],
          failedClasses: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          packageAssignment: null
        })
        showNotification(
          `❌ ${school.schoolPrefix}: Failed - ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        )
      }
    }

    setBatchResults(results)
    setIsBatchProcessing(false)
    setMigrationStatus('completed')
    clearMigrationState()
    setProgressMessage('')

    const totalSuccess = results.reduce((sum, r) => sum + (r.students?.length || 0) + (r.teachers?.length || 0), 0)
    const totalPackagesAssigned = results.reduce((sum, r) => sum + (r.packageAssignment?.success || 0), 0)

    let finalMessage = `🎉 Batch migration complete! Created ${totalSuccess} users across ${batchPreviewData.length} schools`
    if (totalPackagesAssigned > 0) {
      finalMessage += ` | ${totalPackagesAssigned} packages assigned`
    }

    showNotification(finalMessage, 'success')
  }

  // Retry failed user migrations (resume from failed step)
  const retryFailedUsers = async () => {
    if (!result?.ListUserError || result.ListUserError.length === 0) {
      showNotification('No failed users to retry', 'warning')
      return
    }

    setIsCreating(true)
    setProgressMessage(`Retrying ${result.ListUserError.length} failed users (resume from failed step)...`)

    try {
      // Send full user data including state to the retry endpoint
      // This allows the backend to resume from the exact step that failed
      const failedUsersWithState = result.ListUserError.map((user: any) => ({
        id: user.id,
        username: user.username,
        actualUserName: user.actualUserName,
        displayName: user.displayName,
        actualDisplayName: user.actualDisplayName,
        password: user.password,
        classses: user.classses,
        phoneNumber: user.phoneNumber || '',
        grade: user.grade,
        accessToken: user.accessToken,
        loginDisplayName: user.loginDisplayName,
        state: user.state || {}, // Include state for resume logic
        retryCount: user.retryCount || 0
      }))

      const token = localStorage.getItem('auth_token')
      const response = await axios.post('/api/migrate/retry', {
        failedUsers: failedUsersWithState,
        // Include context for group/class assignment
        schoolPrefix: schoolPrefix,
        classes: result.ListDataClasses || [],
        allStudents: result.ListDataStudent || [],
        allTeachers: result.ListDataTeacher || []
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const retryResult = response.data

      // Merge retry results with existing results
      const updatedStudents = [...result.ListDataStudent]
      const updatedTeachers = [...result.ListDataTeacher]
      const updatedErrors = [...result.ListUserError]

      // Helper function to match users by multiple fields
      const matchUser = (a: any, b: any) => {
        // Compare by id if both have id
        if (a.id && b.id && a.id === b.id) return true
        // Compare by actualUserName (the final username after registration)
        if (a.actualUserName && b.actualUserName && a.actualUserName === b.actualUserName) return true
        // Compare by original username
        if (a.username && b.username && a.username === b.username) return true
        // Cross compare username and actualUserName
        if (a.username && b.actualUserName && a.username === b.actualUserName) return true
        if (a.actualUserName && b.username && a.actualUserName === b.username) return true
        return false
      }

      // Update successful retries - REPLACE existing entries, don't add duplicates
      retryResult.successfulUsers?.forEach((user: any) => {
        // Check if this is a student
        const studentIndex = updatedStudents.findIndex((s: any) => matchUser(s, user))
        if (studentIndex >= 0) {
          // Replace with the updated user data
          updatedStudents[studentIndex] = {
            ...updatedStudents[studentIndex],
            ...user
          }
        }

        // Check if this is a teacher
        const teacherIndex = updatedTeachers.findIndex((t: any) => matchUser(t, user))
        if (teacherIndex >= 0) {
          // Replace with the updated user data
          updatedTeachers[teacherIndex] = {
            ...updatedTeachers[teacherIndex],
            ...user
          }
        }

        // Remove from errors if successful
        const errorIndex = updatedErrors.findIndex((e: any) => matchUser(e, user))
        if (errorIndex >= 0) {
          updatedErrors.splice(errorIndex, 1)
        }
      })

      // Update still failed users with new state/reason
      retryResult.stillFailedUsers?.forEach((user: any) => {
        const errorIndex = updatedErrors.findIndex((e: any) => matchUser(e, user))
        if (errorIndex >= 0) {
          // Update existing error with new state and reason
          updatedErrors[errorIndex] = {
            ...updatedErrors[errorIndex],
            ...user
          }
        }
      })

      // Update result state
      const updatedResult = {
        ...result,
        ListDataStudent: updatedStudents,
        ListDataTeacher: updatedTeachers,
        ListUserError: updatedErrors,
        ListClassError: result.ListClassError || []
      }
      setResult(updatedResult)

      // Update created/failed users for UI
      const allCreated = [
        ...updatedStudents.filter((s: any) => s.id && !updatedErrors.find((e: any) => matchUser(e, s))),
        ...updatedTeachers.filter((t: any) => t.id && !updatedErrors.find((e: any) => matchUser(e, t)))
      ]
      setCreatedUsers(allCreated)

      const allFailed = updatedErrors.map((u: any) => ({
        user: { username: u.actualUserName || u.username, displayName: u.actualDisplayName || u.displayName },
        error: u.reason || 'Failed to create user'
      }))
      setFailedUsers(allFailed)

      const retriedSuccess = retryResult.successfulUsers?.length || 0
      const stillFailed = retryResult.stillFailedUsers?.length || 0

      if (stillFailed === 0) {
        showNotification(`All ${retriedSuccess} failed users successfully retried!`, 'success')
      } else {
        showNotification(`Retry complete: ${retriedSuccess} succeeded, ${stillFailed} still failed`, 'warning')
      }

      // Auto-assign packages to newly successful students if enabled
      if (enableAutoSubscription && retryResult.successfulUsers?.length > 0) {
        const successfulStudents = retryResult.successfulUsers.filter((u: any) =>
          u.id && result.ListDataStudent.some((s: any) =>
            s.username === u.username || s.actualUserName === u.actualUserName
          )
        )
        if (successfulStudents.length > 0) {
          await assignPackagesToStudents(successfulStudents)
        }
      }
    } catch (error) {
      console.error('Retry error:', error)
      showNotification(error instanceof Error ? error.message : 'Failed to retry', 'error')
    } finally {
      setIsCreating(false)
      setProgressMessage('')
    }
  }

  // Retry failed package assignments for a specific school in batch results
  const retryBatchSchoolPackages = async (schoolIndex: number) => {
    const school = batchResults[schoolIndex]
    if (!school?.packageAssignment?.failedUsers?.length || !batchSubscriptionConfig?.subscriptionId) {
      return
    }

    setRetryingSchoolIndex(schoolIndex)
    setProgressMessage(`Retrying ${school.packageAssignment.failedUsers.length} failed assignments for ${school.schoolPrefix}...`)

    const BATCH_SIZE = 5
    const BATCH_DELAY_MS = 300
    let successCount = school.packageAssignment.success
    const stillFailedUsers: Array<{ userId: string; username?: string; displayName?: string; error: string }> = []

    try {
      const usersToRetry = school.packageAssignment.failedUsers
      const batches: any[][] = []
      for (let i = 0; i < usersToRetry.length; i += BATCH_SIZE) {
        batches.push(usersToRetry.slice(i, i + BATCH_SIZE))
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]

        const results = await Promise.allSettled(
          batch.map((user) =>
            givePackageToUser({
              subscriptionId: batchSubscriptionConfig.subscriptionId,
              userId: user.userId,
              description: batchSubscriptionConfig.description || `Batch migration ${new Date().toISOString().split('T')[0]}`,
              source: parseInt(batchSubscriptionConfig.source),
              requester: batchSubscriptionConfig.requester || 'Migration Tool',
            })
          )
        )

        results.forEach((result, idx) => {
          const user = batch[idx]
          if (result.status === 'fulfilled') {
            successCount++
          } else {
            const errorMsg = result.reason?.response?.data?.message || result.reason?.message || 'Unknown error'
            stillFailedUsers.push({ ...user, error: errorMsg })
          }
        })

        if (batchIndex < batches.length - 1) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
        }
      }

      // Update the school's package assignment result
      const updatedResults = [...batchResults]
      updatedResults[schoolIndex] = {
        ...school,
        packageAssignment: {
          success: successCount,
          failed: stillFailedUsers.length,
          failedUsers: stillFailedUsers
        }
      }
      setBatchResults(updatedResults)

      if (stillFailedUsers.length === 0) {
        showNotification(`${school.schoolPrefix}: All retries succeeded!`, 'success')
      } else {
        const retriedSuccess = successCount - school.packageAssignment.success
        showNotification(`${school.schoolPrefix}: ${retriedSuccess} succeeded, ${stillFailedUsers.length} still failed`, 'warning')
      }
    } catch (error) {
      console.error(`Retry error for ${school.schoolPrefix}:`, error)
      showNotification(`Failed to retry for ${school.schoolPrefix}`, 'error')
    } finally {
      setRetryingSchoolIndex(null)
      setProgressMessage('')
    }
  }

  // Retry role assignment for teachers
  const retryRoleAssignment = async () => {
    if (!result) {
      showNotification('No migration result found', 'warning')
      return
    }

    setIsCreating(true)
    setProgressMessage('Retrying teacher role assignment...')

    try {
      const token = localStorage.getItem('auth_token')
      const response = await axios.post('/api/migrate/retry-role-assignment', {
        teachers: result.ListDataTeacher
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (response.data.success) {
        // Update result to remove role assignment error
        setResult({
          ...result,
          roleAssignmentError: undefined
        })
        showNotification('✅ Successfully assigned teachers to role!', 'success')
      } else {
        showNotification(`❌ Role assignment failed: ${response.data.error}`, 'error')
      }
    } catch (error: any) {
      console.error('Retry role assignment error:', error)
      showNotification(
        `Failed to retry role assignment: ${error.response?.data?.message || error.message}`,
        'error'
      )
    } finally {
      setIsCreating(false)
      setProgressMessage('')
    }
  }

  // Retry role assignment for a specific school in batch mode
  const retryBatchSchoolRoleAssignment = async (schoolIndex: number) => {
    const school = batchResults[schoolIndex]
    if (!school || !school.teachers || school.teachers.length === 0) {
      showNotification('No teachers found for this school', 'warning')
      return
    }

    if (!school.roleAssignmentError) {
      showNotification('No role assignment error for this school', 'info')
      return
    }

    setRetryingSchoolIndex(schoolIndex)
    setProgressMessage(`Retrying role assignment for ${school.schoolPrefix}...`)

    try {
      const token = localStorage.getItem('auth_token')
      const response = await axios.post('/api/migrate/retry-role-assignment', {
        teachers: school.teachers
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (response.data.success) {
        // Update batch results to clear role assignment error
        const updatedResults = [...batchResults]
        updatedResults[schoolIndex] = {
          ...school,
          roleAssignmentError: undefined
        }
        setBatchResults(updatedResults)
        showNotification(`✅ ${school.schoolPrefix}: Successfully assigned teachers to role!`, 'success')
      } else {
        showNotification(`❌ ${school.schoolPrefix}: Role assignment failed: ${response.data.error}`, 'error')
      }
    } catch (error: any) {
      console.error(`Retry role assignment error for ${school.schoolPrefix}:`, error)
      showNotification(
        `Failed to retry role assignment for ${school.schoolPrefix}: ${error.response?.data?.message || error.message}`,
        'error'
      )
    } finally {
      setRetryingSchoolIndex(null)
      setProgressMessage('')
    }
  }

  // Retry failed users for a specific school in batch mode (resume from failed step)
  const retryBatchSchoolFailedUsers = async (schoolIndex: number) => {
    const school = batchResults[schoolIndex]
    if (!school || !school.failedUsers || school.failedUsers.length === 0) {
      showNotification('No failed users to retry for this school', 'warning')
      return
    }

    setRetryingSchoolIndex(schoolIndex)
    setProgressMessage(`Retrying ${school.failedUsers.length} failed users for ${school.schoolPrefix} (resume from failed step)...`)

    try {
      // Send full user data including state to the retry endpoint
      const failedUsersWithState = school.failedUsers.map((user: any) => ({
        id: user.id,
        username: user.username,
        actualUserName: user.actualUserName,
        displayName: user.displayName,
        actualDisplayName: user.actualDisplayName,
        password: user.password,
        classses: user.classses,
        phoneNumber: user.phoneNumber || '',
        grade: user.grade,
        accessToken: user.accessToken,
        loginDisplayName: user.loginDisplayName,
        state: user.state || {},
        retryCount: user.retryCount || 0
      }))

      const token = localStorage.getItem('auth_token')
      const response = await axios.post('/api/migrate/retry', {
        failedUsers: failedUsersWithState,
        // Include context for group/class assignment in batch mode
        schoolPrefix: school.schoolPrefix,
        classes: school.classes || [],
        allStudents: school.students || [],
        allTeachers: school.teachers || []
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const retryResult = response.data

      // Merge retry results with existing school results
      const updatedStudents = [...school.students]
      const updatedTeachers = [...school.teachers]
      const updatedErrors = [...school.failedUsers]

      // Helper function to match users by multiple fields
      const matchUser = (a: any, b: any) => {
        // Compare by id if both have id
        if (a.id && b.id && a.id === b.id) return true
        // Compare by actualUserName (the final username after registration)
        if (a.actualUserName && b.actualUserName && a.actualUserName === b.actualUserName) return true
        // Compare by original username
        if (a.username && b.username && a.username === b.username) return true
        // Cross compare username and actualUserName
        if (a.username && b.actualUserName && a.username === b.actualUserName) return true
        if (a.actualUserName && b.username && a.actualUserName === b.username) return true
        return false
      }

      // Update successful retries - REPLACE existing entries
      retryResult.successfulUsers?.forEach((user: any) => {
        // Check if this is a student
        const studentIndex = updatedStudents.findIndex((s: any) => matchUser(s, user))
        if (studentIndex >= 0) {
          updatedStudents[studentIndex] = {
            ...updatedStudents[studentIndex],
            ...user
          }
        }

        // Check if this is a teacher
        const teacherIndex = updatedTeachers.findIndex((t: any) => matchUser(t, user))
        if (teacherIndex >= 0) {
          updatedTeachers[teacherIndex] = {
            ...updatedTeachers[teacherIndex],
            ...user
          }
        }

        // Remove from errors if successful
        const errorIndex = updatedErrors.findIndex((e: any) => matchUser(e, user))
        if (errorIndex >= 0) {
          updatedErrors.splice(errorIndex, 1)
        }
      })

      // Update still failed users with new state/reason
      retryResult.stillFailedUsers?.forEach((user: any) => {
        const errorIndex = updatedErrors.findIndex((e: any) => matchUser(e, user))
        if (errorIndex >= 0) {
          updatedErrors[errorIndex] = {
            ...updatedErrors[errorIndex],
            ...user
          }
        }
      })

      // Update batch results
      const updatedResults = [...batchResults]
      updatedResults[schoolIndex] = {
        ...school,
        students: updatedStudents,
        teachers: updatedTeachers,
        failedUsers: updatedErrors
      }
      setBatchResults(updatedResults)

      const retriedSuccess = retryResult.successfulUsers?.length || 0
      const stillFailed = retryResult.stillFailedUsers?.length || 0

      if (stillFailed === 0) {
        showNotification(`✅ ${school.schoolPrefix}: All ${retriedSuccess} retries succeeded!`, 'success')
      } else {
        showNotification(`${school.schoolPrefix}: ${retriedSuccess} succeeded, ${stillFailed} still failed`, 'warning')
      }

      // Auto-assign packages if enabled
      if (batchSubscriptionConfig?.enabled && batchSubscriptionConfig.subscriptionId) {
        const newSuccessfulStudents = retryResult.successfulUsers?.filter((u: any) =>
          u.id && school.students.some((s: any) =>
            s.username === u.username || s.actualUserName === u.actualUserName
          )
        ) || []

        if (newSuccessfulStudents.length > 0) {
          setProgressMessage(`Assigning packages to ${newSuccessfulStudents.length} newly succeeded students...`)

          const BATCH_SIZE = 5
          const BATCH_DELAY_MS = 300
          let packageSuccessCount = 0
          const packageFailedUsers: any[] = []

          const batches: any[][] = []
          for (let i = 0; i < newSuccessfulStudents.length; i += BATCH_SIZE) {
            batches.push(newSuccessfulStudents.slice(i, i + BATCH_SIZE))
          }

          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex]
            const packageResults = await Promise.allSettled(
              batch.map((student: any) =>
                givePackageToUser({
                  subscriptionId: batchSubscriptionConfig.subscriptionId,
                  userId: student.id,
                  description: batchSubscriptionConfig.description || `Retry migration ${new Date().toISOString().split('T')[0]}`,
                  source: parseInt(batchSubscriptionConfig.source),
                  requester: batchSubscriptionConfig.requester || 'Migration Tool',
                })
              )
            )

            packageResults.forEach((result, idx) => {
              if (result.status === 'fulfilled') {
                packageSuccessCount++
              } else {
                packageFailedUsers.push({
                  userId: batch[idx].id,
                  username: batch[idx].actualUserName || batch[idx].username,
                  error: result.reason?.message || 'Unknown error'
                })
              }
            })

            if (batchIndex < batches.length - 1) {
              await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
            }
          }

          // Update package assignment in results
          const currentPackage = updatedResults[schoolIndex].packageAssignment || { success: 0, failed: 0, failedUsers: [] }
          updatedResults[schoolIndex] = {
            ...updatedResults[schoolIndex],
            packageAssignment: {
              success: currentPackage.success + packageSuccessCount,
              failed: currentPackage.failed - packageSuccessCount + packageFailedUsers.length,
              failedUsers: [...(currentPackage.failedUsers || []).filter((u: any) =>
                !newSuccessfulStudents.some((s: any) => s.id === u.userId)
              ), ...packageFailedUsers]
            }
          }
          setBatchResults(updatedResults)

          if (packageSuccessCount > 0) {
            showNotification(`📦 Assigned ${packageSuccessCount} packages to newly succeeded students`, 'success')
          }
        }
      }
    } catch (error: any) {
      console.error(`Retry error for ${school.schoolPrefix}:`, error)
      showNotification(`Failed to retry for ${school.schoolPrefix}: ${error.message}`, 'error')
    } finally {
      setRetryingSchoolIndex(null)
      setProgressMessage('')
    }
  }

  // ===== MIGRATION CONTROL FUNCTIONS (pause/resume/cancel) =====

  /**
   * Pause the current migration
   */
  const pauseMigration = useCallback(async () => {
    if (migrationStatus !== 'running') {
      showNotification('No running migration to pause', 'warning')
      return
    }

    try {
      const token = localStorage.getItem('auth_token')
      await axios.post('/api/migrate/control', { action: 'pause' }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMigrationStatus('paused')
      showNotification('Migration paused', 'info')

      // Save state for resume
      if (migrationProgress) {
        const state: MigrationState = {
          sessionId: migrationSessionId || generateSessionId(),
          status: 'paused',
          startTime: Date.now(),
          lastUpdated: Date.now(),
          currentPhase: migrationProgress.phase,
          currentUserIndex: migrationProgress.currentIndex,
          totalUsers: migrationProgress.totalUsers,
          processedRegistrations: migrationProgress.processedRegistrations,
          processedLogins: migrationProgress.processedLogins,
          processedInits: migrationProgress.processedInits,
          processedClasses: migrationProgress.processedClasses,
          students: migrationProgress.students as any[],
          teachers: migrationProgress.teachers as any[],
          classes: migrationProgress.classes,
          listUserError: migrationProgress.listUserError as any[],
          listClassError: migrationProgress.listClassError,
          schoolPrefix: schoolPrefix,
        }
        saveMigrationState(state)
        setCanResume(true)
      }
    } catch (error: any) {
      console.error('Pause error:', error)
      showNotification('Failed to pause migration', 'error')
    }
  }, [migrationStatus, migrationProgress, migrationSessionId, schoolPrefix])

  /**
   * Resume a paused or saved migration
   */
  const resumeMigration = useCallback(async () => {
    // Check for saved state
    const savedState = loadMigrationState()

    if (!savedState && migrationStatus !== 'paused') {
      showNotification('No migration to resume', 'warning')
      return
    }

    try {
      const token = localStorage.getItem('auth_token')
      await axios.post('/api/migrate/control', { action: 'resume' }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMigrationStatus('running')
      showNotification('Migration resumed', 'info')
    } catch (error: any) {
      console.error('Resume error:', error)
      showNotification('Failed to resume migration', 'error')
    }
  }, [migrationStatus])

  /**
   * Cancel the current migration (keeps created data)
   */
  const cancelMigration = useCallback(async () => {
    if (migrationStatus !== 'running' && migrationStatus !== 'paused') {
      showNotification('No migration to cancel', 'warning')
      return
    }

    try {
      const token = localStorage.getItem('auth_token')
      await axios.post('/api/migrate/control', { action: 'cancel' }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMigrationStatus('cancelled')
      clearMigrationState()
      setCanResume(false)
      showNotification('Migration cancelled. Created users/classes have been kept.', 'warning')
    } catch (error: any) {
      console.error('Cancel error:', error)
      showNotification('Failed to cancel migration', 'error')
    }
  }, [migrationStatus])

  /**
   * Clear saved migration state
   */
  const clearSavedMigration = useCallback(() => {
    clearMigrationState()
    setCanResume(false)
    setMigrationProgress(null)
    showNotification('Saved migration state cleared', 'info')
  }, [])

  /**
   * Get progress percentage (0-100)
   */
  const getProgressPercentage = useCallback((): number => {
    if (!migrationProgress || migrationProgress.totalUsers === 0) return 0

    const weights = { registration: 0.3, login: 0.2, initialization: 0.3, classes: 0.15, roles: 0.05 }
    let progress = 0

    progress += (migrationProgress.processedRegistrations / migrationProgress.totalUsers) * weights.registration * 100
    progress += (migrationProgress.processedLogins / migrationProgress.totalUsers) * weights.login * 100
    progress += (migrationProgress.processedInits / migrationProgress.totalUsers) * weights.initialization * 100

    if (migrationProgress.totalClasses > 0) {
      progress += (migrationProgress.processedClasses / migrationProgress.totalClasses) * weights.classes * 100
    }

    if (migrationProgress.phase === 'completed') {
      progress = 100
    }

    return Math.min(100, Math.round(progress))
  }, [migrationProgress])

  return {
    // State
    file,
    schoolPrefix,
    students,
    teachers,
    errors,
    isProcessing,
    isCreating,
    progressMessage,
    totalCount,
    createdUsers,
    failedUsers,
    activeTab,
    result,
    notification,
    existingClasses,
    isCheckingClasses,
    excelConfig,
    batchResults,
    isBatchProcessing,
    currentSchoolIndex,
    totalSchools,
    batchPreviewData,
    retryingSchoolIndex,
    // Batch form state (persisted)
    batchSchoolsForm,
    setBatchSchoolsForm,
    batchFormSubscriptionConfig,
    setBatchFormSubscriptionConfig,
    // Subscription state
    enableAutoSubscription,
    subscriptionId,
    subscriptionDescription,
    subscriptionRequester,
    subscriptionSource,
    isAssigningPackages,
    packageAssignmentProgress,
    packageAssignmentResult,
    // Actions
    setSchoolPrefix,
    setActiveTab,
    setNotification,
    showNotification,
    resetState,
    handleFileChange,
    handleProcessFile,
    handleCreateUsers,
    setExcelConfig,
    clearFile,
    handleProcessBatch,
    handleCreateBatch,
    retryBatchSchoolPackages,
    retryBatchSchoolFailedUsers,
    retryBatchSchoolRoleAssignment,
    retryFailedUsers,
    retryRoleAssignment,
    // Subscription actions
    setEnableAutoSubscription,
    setSubscriptionId,
    setSubscriptionDescription,
    setSubscriptionRequester,
    setSubscriptionSource,
    retryFailedPackages,
    // Migration control (pause/resume/cancel)
    migrationStatus,
    migrationProgress,
    migrationSessionId,
    canResume,
    pauseMigration,
    resumeMigration,
    cancelMigration,
    clearSavedMigration,
    getProgressPercentage,
    setMigrationStatus,
    setMigrationProgress,
  }
}
