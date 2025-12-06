import { useState } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { processExcelData } from '@/utils/bulkRegistrationUtils'
import { StudentData, TeacherData, MigrationResult, NotificationState, TabType } from '@/types'

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
  const [includeAdminTeacher, setIncludeAdminTeacher] = useState(false)

  // Batch migration state
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [currentSchoolIndex, setCurrentSchoolIndex] = useState(0)
  const [totalSchools, setTotalSchools] = useState(0)
  const [batchPreviewData, setBatchPreviewData] = useState<any[]>([])

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
    setIncludeAdminTeacher(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setStudents([])
      setTeachers([])
      setErrors([])
    }
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

          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: ['fullName', 'grade', 'phoneNumber'] })

          const excelRows = jsonData
            .map((row: any) => ({
              fullName: row.fullName?.toString().trim() || '',
              grade: row.grade?.toString().trim() || '',
              phoneNumber: row.phoneNumber?.toString().trim() || ''
            }))
            .filter(row => row.fullName && row.grade)

          if (excelRows.length === 0) {
            showNotification('No valid data found in Excel file', 'warning')
            setIsProcessing(false)
            return
          }

          const processed = processExcelData(
            excelRows,
            schoolPrefix.trim().toLowerCase(),
            new Set(),
            new Set(),
            includeAdminTeacher
          )

          setStudents(processed.students)
          setTeachers(processed.teachers)
          setErrors(processed.errors)

          if (processed.students.length > 0) {
            setActiveTab('preview')
            showNotification(`Found ${processed.students.length} student(s) and ${processed.teachers.length} teacher(s)`, 'success')

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

  const handleCreateUsers = async () => {
    if (students.length === 0 && teachers.length === 0) {
      showNotification('Please process an Excel file first', 'warning')
      return
    }

    setIsCreating(true)
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
        phoneNumber: student.phoneNumber || ''
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
      setActiveTab('results')

      const successCount = allCreated.length
      const failCount = allFailed.length
      const classErrorCount = apiResult.ListClassError?.length || 0

      const message = `Created ${successCount} users, ${apiResult.ListDataClasses?.length || 0} classes. ${failCount > 0 ? `${failCount} users failed.` : ''} ${classErrorCount > 0 ? `${classErrorCount} classes failed.` : ''}`
      showNotification(message, successCount > 0 ? 'success' : 'error')
    } catch (error) {
      console.error('Migration error:', error)
      setIsCreating(false)
      showNotification(error instanceof Error ? error.message : 'Unknown error occurred', 'error')
    }
  }

  // Process batch files and show preview
  const handleProcessBatch = async (schools: Array<{
    id: string
    file: File | null
    schoolPrefix: string
    createAdminTeacher: boolean
  }>) => {
    setIsProcessing(true)
    setBatchPreviewData([])

    const previewData: any[] = []

    for (let i = 0; i < schools.length; i++) {
      const school = schools[i]
      setProgressMessage(`Processing file ${i + 1}/${schools.length}: ${school.schoolPrefix}`)

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
              const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
              const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: ['fullName', 'grade', 'phoneNumber'] })

              const excelRows = jsonData
                .map((row: any) => ({
                  fullName: row.fullName?.toString().trim() || '',
                  grade: row.grade?.toString().trim() || '',
                  phoneNumber: row.phoneNumber?.toString().trim() || ''
                }))
                .filter(row => row.fullName && row.grade)

              const processed = processExcelData(
                excelRows,
                school.schoolPrefix.trim().toLowerCase(),
                new Set(),
                new Set(),
                school.createAdminTeacher
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
          classes: uniqueClasses,
          createAdminTeacher: school.createAdminTeacher
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
    setTotalSchools(batchPreviewData.length)
    setCurrentSchoolIndex(0)
    setBatchResults([])
    setActiveTab('batch-results')

    const results: any[] = []

    for (let i = 0; i < batchPreviewData.length; i++) {
      const school = batchPreviewData[i]
      setCurrentSchoolIndex(i + 1)
      setProgressMessage(`Migrating school ${i + 1}/${batchPreviewData.length}: ${school.schoolPrefix}`)

      try {
        const listDataStudent = school.students.map((student: any) => ({
          username: student.username,
          displayName: student.displayName,
          password: student.password,
          classses: student.className,
          phoneNumber: student.phoneNumber || ''
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

        results.push({
          schoolPrefix: school.schoolPrefix,
          students: apiResult.ListDataStudent || [],
          teachers: apiResult.ListDataTeacher || [],
          classes: apiResult.ListDataClasses || [],
          failedUsers: apiResult.ListUserError || [],
          failedClasses: apiResult.ListClassError || []
        })

        showNotification(
          `✅ ${school.schoolPrefix}: Created ${(apiResult.ListDataStudent?.length || 0) + (apiResult.ListDataTeacher?.length || 0)} users`,
          'success'
        )
      } catch (error) {
        console.error(`Failed to migrate school ${school.schoolPrefix}:`, error)
        results.push({
          schoolPrefix: school.schoolPrefix,
          students: [],
          teachers: [],
          classes: [],
          failedUsers: [],
          failedClasses: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        showNotification(
          `❌ ${school.schoolPrefix}: Failed - ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        )
      }
    }

    setBatchResults(results)
    setIsBatchProcessing(false)
    setProgressMessage('')

    const totalSuccess = results.reduce((sum, r) => sum + (r.students?.length || 0) + (r.teachers?.length || 0), 0)
    showNotification(
      `🎉 Batch migration complete! Created ${totalSuccess} users across ${batchPreviewData.length} schools`,
      'success'
    )
  }

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
    includeAdminTeacher,
    batchResults,
    isBatchProcessing,
    currentSchoolIndex,
    totalSchools,
    batchPreviewData,
    // Actions
    setSchoolPrefix,
    setActiveTab,
    setNotification,
    showNotification,
    resetState,
    handleFileChange,
    handleProcessFile,
    handleCreateUsers,
    setIncludeAdminTeacher,
    handleProcessBatch,
    handleCreateBatch,
  }
}
