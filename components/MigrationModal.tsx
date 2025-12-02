'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import axios from 'axios'
import { processExcelData, StudentData, TeacherData } from '@/utils/bulkRegistrationUtils'
import Notification from './Notification'

interface MigrationModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'upload' | 'preview' | 'results'

interface NotificationState {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

export default function MigrationModal({ isOpen, onClose }: MigrationModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [schoolPrefix, setSchoolPrefix] = useState('')
  const [students, setStudents] = useState<StudentData[]>([])
  const [teachers, setTeachers] = useState<TeacherData[]>([])
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createProgress, setCreateProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [processedCount, setProcessedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [createdUsers, setCreatedUsers] = useState<any[]>([])
  const [failedUsers, setFailedUsers] = useState<Array<{ user: any; error: string }>>([])
  const [activeTab, setActiveTab] = useState<TabType>('upload')
  const [result, setResult] = useState<any>(null)
  const [notification, setNotification] = useState<NotificationState | null>(null)

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ message, type })
  }

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

    const csvContent = [
      '=== STUDENTS ===',
      'Id,Actual Username,Password,Actual Display Name,Class,Phone',
      ...successStudents.map((s: any) =>
        `${s.id || ''},${s.actualUserName || s.username},${s.password},${s.actualDisplayName || s.displayName},${s.classses},${s.phoneNumber || ''}`
      ),
      '',
      '=== TEACHERS ===',
      'Id,Actual Username,Password,Actual Display Name,Class',
      ...successTeachers.map((t: any) =>
        `${t.id || ''},${t.actualUserName || t.username},${t.password},${t.actualDisplayName || t.displayName},${t.classses}`
      )
    ].join('\n')

    copyToClipboard(csvContent)
  }

  const copyErrorData = () => {
    if (!result || !result.ListUserError) return

    const csvContent = [
      'Username,Display Name,Password,Class,Phone,Error Reason',
      ...result.ListUserError.map((u: any) =>
        `${u.username},${u.displayName},${u.password},${u.classses},${u.phoneNumber || ''},${u.reason || ''}`
      )
    ].join('\n')

    copyToClipboard(csvContent)
  }

  if (!isOpen) return null

  const handleClose = () => {
    setFile(null)
    setSchoolPrefix('')
    setStudents([])
    setTeachers([])
    setErrors([])
    setIsProcessing(false)
    setIsCreating(false)
    setCreateProgress(0)
    setCreatedUsers([])
    setFailedUsers([])
    setResult(null)
    setActiveTab('upload')
    onClose()
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

          // Get first sheet
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: ['fullName', 'grade', 'phoneNumber'] })

          // Filter out empty rows
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

          // Process the data
          const processed = processExcelData(
            excelRows,
            schoolPrefix.trim().toLowerCase()
          )

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
    setCreateProgress(0)
    setProgressMessage('Initializing migration...')
    setCreatedUsers([])
    setFailedUsers([])
    setTotalCount(students.length + teachers.length)
    setProcessedCount(0)

    try {
      // Prepare student data
      const listDataStudent = students.map(student => ({
        username: student.username,
        displayName: student.displayName,
        password: student.password,
        classses: student.className,
        phoneNumber: student.phoneNumber || ''
      }))

      // Prepare teacher data
      const listDataTeacher = teachers.map(teacher => ({
        username: teacher.username,
        displayName: teacher.displayName,
        password: teacher.password,
        classses: teacher.className,
        phoneNumber: ''
      }))

      // Prepare class data (unique classes from students only)
      const uniqueClasses = Array.from(new Set(students.map(s => s.className)))
      const listDataClasses = uniqueClasses.map(className => ({
        username: className,
        displayName: '',
        password: '',
        classses: className,
        phoneNumber: ''
      }))

      setCreateProgress(10)
      setProgressMessage(`Processing ${students.length} students and ${teachers.length} teachers...`)

      // Call local API route which uses MigrationService
      const response = await axios.post('/api/migrate', {
        ListDataStudent: listDataStudent,
        ListDataTeacher: listDataTeacher,
        ListDataClasses: listDataClasses
      })

      setCreateProgress(90)
      setProgressMessage('Finalizing...')

      // Process response
      const apiResult = response.data
      setResult(apiResult)

      // Mark created users
      const allCreated = [
        ...(apiResult.ListDataStudent || []).map((s: any) => ({ username: s.username, displayName: s.displayName, role: 'Student' })),
        ...(apiResult.ListDataTeacher || []).map((t: any) => ({ username: t.username, displayName: t.displayName, role: 'Teacher' }))
      ]
      setCreatedUsers(allCreated)

      // Mark failed users
      const allFailed = (apiResult.ListUserError || []).map((u: any) => ({
        user: { username: u.username, displayName: u.displayName },
        error: u.Reason || 'Failed to create user'
      }))
      setFailedUsers(allFailed)

      setCreateProgress(100)
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

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            Bulk User Migration
          </h2>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid #e5e7eb', padding: '0 20px', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'upload' ? '2px solid #007bff' : 'none',
              color: activeTab === 'upload' ? '#007bff' : '#666',
              fontWeight: activeTab === 'upload' ? '600' : '400'
            }}
          >
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            disabled={students.length === 0}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'preview' ? '2px solid #007bff' : 'none',
              color: activeTab === 'preview' ? '#007bff' : '#666',
              fontWeight: activeTab === 'preview' ? '600' : '400',
              cursor: students.length === 0 ? 'not-allowed' : 'pointer',
              opacity: students.length === 0 ? 0.5 : 1
            }}
          >
            Preview ({students.length + teachers.length})
          </button>
          <button
            onClick={() => setActiveTab('results')}
            disabled={createdUsers.length === 0 && failedUsers.length === 0}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'results' ? '2px solid #007bff' : 'none',
              color: activeTab === 'results' ? '#007bff' : '#666',
              fontWeight: activeTab === 'results' ? '600' : '400',
              cursor: createdUsers.length === 0 && failedUsers.length === 0 ? 'not-allowed' : 'pointer',
              opacity: createdUsers.length === 0 && failedUsers.length === 0 ? 0.5 : 1
            }}
          >
            Results
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: '#e0f2fe', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>Excel File Format:</p>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Column 1: Full name (Vietnamese text)</li>
                  <li>Column 2: Grade (e.g., 1A, 1B, 2C, etc.)</li>
                  <li>Column 3: Phone number</li>
                </ul>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  School Code (Prefix) *
                </label>
                <input
                  type="text"
                  value={schoolPrefix}
                  onChange={(e) => setSchoolPrefix(e.currentTarget.value)}
                  placeholder="e.g., hytkltt"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Excel File *
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>

              {errors.length > 0 && (
                <div style={{ padding: '12px', backgroundColor: '#fee2e2', borderRadius: '6px', maxHeight: '150px', overflow: 'auto' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '500', color: '#dc2626' }}>Parsing Errors:</p>
                  {errors.map((err, idx) => (
                    <p key={idx} style={{ margin: '4px 0', fontSize: '14px' }}>
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>Summary</p>
                <p style={{ margin: '4px 0' }}>Students: {students.length}</p>
                <p style={{ margin: '4px 0' }}>Teachers: {teachers.length}</p>
                <p style={{ margin: '4px 0' }}>Classes: {new Set(students.map(s => s.className)).size}</p>
                <p style={{ margin: '4px 0' }}>Total Users: {students.length + teachers.length}</p>
              </div>

              {/* Classes */}
              <div>
                <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>Classes</h3>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Class Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Teacher</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(students.map(s => s.className))).map((className) => {
                        const teacher = teachers.find(t => t.className === className)
                        const studentCount = students.filter(s => s.className === className).length
                        return (
                          <tr key={className}>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{className}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{teacher?.username || '-'}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{studentCount}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Teachers */}
              {teachers.length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>Teachers</h3>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Username</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Display Name</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Password</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Class</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teachers.map((teacher, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{teacher.username}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{teacher.displayName}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{teacher.password}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{teacher.className}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Students */}
              {students.length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>Students (First 50)</h3>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Full Name</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Username</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Display Name</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Password</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Grade</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Class</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.slice(0, 50).map((student, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{student.fullName}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{student.username}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{student.displayName}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{student.password}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{student.grade}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{student.className}</td>
                            <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{student.phoneNumber}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {students.length > 50 && (
                    <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                      Showing first 50 of {students.length} students
                    </p>
                  )}
                </div>
              )}

              {isCreating && (
                <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <p style={{ marginBottom: '8px', fontWeight: '600', color: '#1e40af' }}>{progressMessage}</p>
                  <div style={{ width: '100%', height: '12px', backgroundColor: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: `${createProgress}%`, height: '100%', backgroundColor: '#3b82f6', transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b' }}>
                    <span>Progress: {createProgress}%</span>
                    <span>Total: {totalCount} users</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1, padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '500', color: '#166534' }}>Created Successfully</p>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#16a34a' }}>{createdUsers.length}</p>
                </div>
                <div style={{ flex: 1, padding: '20px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '500', color: '#991b1b' }}>Failed</p>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#dc2626' }}>{failedUsers.length}</p>
                </div>
              </div>

              {/* Success Data - Students */}
              {result && result.ListDataStudent && result.ListDataStudent.filter((s: any) => !result.ListUserError.find((e: any) => e.username === s.username)).length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600', color: '#059669' }}>✅ Students Created Successfully</h3>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', maxHeight: '350px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f0fdf4' }}>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #86efac' }}>Id</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #86efac' }}>Actual Username</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #86efac' }}>Password</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #86efac' }}>Actual Display Name</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #86efac' }}>Class</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #86efac' }}>Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ListDataStudent.filter((s: any) => !result.ListUserError.find((e: any) => e.username === s.username)).map((student: any, idx: number) => (
                          <tr key={`s-${idx}`}>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace' }}>{student.id || '-'}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>{student.actualUserName || student.username}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', color: '#059669' }}>{student.password}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{student.actualDisplayName || student.displayName}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{student.classses}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{student.phoneNumber || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    Total: {result.ListDataStudent.filter((s: any) => !result.ListUserError.find((e: any) => e.username === s.username)).length} students
                  </p>
                </div>
              )}

              {/* Success Data - Teachers */}
              {result && result.ListDataTeacher && result.ListDataTeacher.filter((t: any) => !result.ListUserError.find((e: any) => e.username === t.username)).length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600', color: '#dc2626' }}>👨‍🏫 Teachers Created Successfully</h3>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', maxHeight: '350px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fef9c3' }}>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #fbbf24' }}>Id</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #fbbf24' }}>Actual Username</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #fbbf24' }}>Password</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #fbbf24' }}>Actual Display Name</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #fbbf24' }}>Class</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ListDataTeacher.filter((t: any) => !result.ListUserError.find((e: any) => e.username === t.username)).map((teacher: any, idx: number) => (
                          <tr key={`t-${idx}`}>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace' }}>{teacher.id || '-'}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>{teacher.actualUserName || teacher.username}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', color: '#dc2626' }}>{teacher.password}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{teacher.actualDisplayName || teacher.displayName}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{teacher.classses}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    Total: {result.ListDataTeacher.filter((t: any) => !result.ListUserError.find((e: any) => e.username === t.username)).length} teachers
                  </p>
                </div>
              )}

              {/* Copy Success Data Button */}
              {result && createdUsers.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                  <button
                    onClick={copySuccessData}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    📋 Copy All Success Data (Students + Teachers)
                  </button>
                </div>
              )}

              {/* Error Data Table */}
              {result && result.ListUserError && result.ListUserError.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#dc2626' }}>Failed Users (Can Retry)</h3>
                    <button
                      onClick={copyErrorData}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      📋 Copy Error Data
                    </button>
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fee2e2' }}>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Username</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Display Name</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Password</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Class</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Phone</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Error Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ListUserError.map((failed: any, idx: number) => (
                          <tr key={idx}>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{failed.username}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{failed.displayName}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{failed.password}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{failed.classses}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{failed.phoneNumber || '-'}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', color: '#dc2626' }}>{failed.reason || 'Unknown error'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    💡 Copy error data, fix issues in Excel, and re-upload only failed users
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: activeTab === 'preview' ? 'space-between' : 'flex-end', gap: '12px' }}>
          {activeTab === 'upload' && (
            <>
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#333'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleProcessFile}
                disabled={isProcessing || !file || !schoolPrefix}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: isProcessing || !file || !schoolPrefix ? '#ccc' : '#007bff',
                  color: 'white',
                  cursor: isProcessing || !file || !schoolPrefix ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? 'Processing...' : 'Process File'}
              </button>
            </>
          )}
          {activeTab === 'preview' && (
            <>
              <button
                onClick={() => setActiveTab('upload')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#333'
                }}
              >
                Back
              </button>
              <button
                onClick={handleCreateUsers}
                disabled={isCreating || (students.length === 0 && teachers.length === 0)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: isCreating || (students.length === 0 && teachers.length === 0) ? '#ccc' : '#007bff',
                  color: 'white',
                  cursor: isCreating || (students.length === 0 && teachers.length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {isCreating ? 'Creating...' : 'Create Users'}
              </button>
            </>
          )}
          {activeTab === 'results' && (
            <button
              onClick={handleClose}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#007bff',
                color: 'white'
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  )
}
