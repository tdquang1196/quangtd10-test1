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
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setStudents([])
      setTeachers([])
      setErrors([])
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

          const processed = processExcelData(excelRows, schoolPrefix.trim().toLowerCase())

          setStudents(processed.students)
          setTeachers(processed.teachers)
          setErrors(processed.errors)

          if (processed.students.length > 0) {
            setActiveTab('preview')
            showNotification(`Found ${processed.students.length} student(s) and ${processed.teachers.length} teacher(s)`, 'success')
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

      const response = await axios.post('/api/migrate', {
        ListDataStudent: listDataStudent,
        ListDataTeacher: listDataTeacher,
        ListDataClasses: listDataClasses
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
    // Actions
    setSchoolPrefix,
    setActiveTab,
    setNotification,
    showNotification,
    resetState,
    handleFileChange,
    handleProcessFile,
    handleCreateUsers,
  }
}
