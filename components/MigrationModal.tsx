'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import axios from 'axios'

interface MigrationModalProps {
  isOpen: boolean
  onClose: () => void
}

interface UserData {
  username: string
  displayName: string
  password: string
  classses: string
  phoneNumber: string
}

export default function MigrationModal({ isOpen, onClose }: MigrationModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [schoolPrefix, setSchoolPrefix] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const processExcelFile = async (): Promise<{ students: UserData[], teachers: UserData[], classes: UserData[] }> => {
    if (!file) throw new Error('No file selected')

    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
            header: ['fullName', 'grade', 'phoneNumber']
          })

          const excelRows = jsonData
            .map((row: any) => ({
              fullName: row.fullName?.toString().trim() || '',
              grade: row.grade?.toString().trim() || '',
              phoneNumber: row.phoneNumber?.toString().trim() || ''
            }))
            .filter(row => row.fullName && row.grade)

          // Process data similar to BulkUserRegistrationModal
          const students: UserData[] = []
          const teachers: UserData[] = []
          const classesSet = new Set<string>()

          excelRows.forEach((row) => {
            const gradeMatch = row.grade.match(/^(\d+)([A-Za-z]+)$/)
            if (!gradeMatch) return

            const gradeNum = gradeMatch[1]
            const className = row.grade.toLowerCase()
            classesSet.add(className)

            // Generate username from full name
            const nameParts = row.fullName.toLowerCase().split(' ')
            const lastName = nameParts[nameParts.length - 1]
            const firstName = nameParts.slice(0, -1).join('')
            const username = `${schoolPrefix}${lastName}${firstName}`

            students.push({
              username: username,
              displayName: row.fullName,
              password: '123456', // Default password
              classses: className,
              phoneNumber: row.phoneNumber
            })

            // Create teacher (one per class)
            const teacherUsername = `${schoolPrefix}gv${className}`
            if (!teachers.find(t => t.username === teacherUsername)) {
              teachers.push({
                username: teacherUsername,
                displayName: `Teacher ${className.toUpperCase()}`,
                password: '123456',
                classses: className,
                phoneNumber: ''
              })
            }
          })

          const classes: UserData[] = Array.from(classesSet).map(className => ({
            username: className,
            displayName: '',
            password: '',
            classses: className,
            phoneNumber: ''
          }))

          resolve({ students, teachers, classes })
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  const handleSubmit = async () => {
    if (!file || !schoolPrefix) {
      alert('Please select a file and enter school prefix')
      return
    }

    setIsProcessing(true)
    setResult(null)

    try {
      const { students, teachers, classes } = await processExcelFile()

      // Call API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await axios.post(`${apiUrl}/api/migrate`, {
        ListDataStudent: students,
        ListDataTeacher: teachers,
        ListDataClasses: classes
      })

      setResult(response.data)
      alert('Migration completed!')
    } catch (error) {
      console.error('Migration error:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setSchoolPrefix('')
    setResult(null)
    onClose()
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
        padding: '24px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 'bold' }}>
          Bulk User Migration
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            School Prefix
          </label>
          <input
            type="text"
            value={schoolPrefix}
            onChange={(e) => setSchoolPrefix(e.target.value)}
            placeholder="e.g., hytkltt"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Excel File
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
          <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            Excel format: Column 1: Full name, Column 2: Grade (e.g., 1A, 2B), Column 3: Phone number
          </p>
        </div>

        {result && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
            <h3 style={{ fontWeight: '500', marginBottom: '8px' }}>Results:</h3>
            <p>Students created: {result.ListDataStudent?.length || 0}</p>
            <p>Teachers created: {result.ListDataTeacher?.length || 0}</p>
            <p>Classes created: {result.ListDataClasses?.length || 0}</p>
            <p style={{ color: '#dc2626' }}>Failed users: {result.ListUserError?.length || 0}</p>
            <p style={{ color: '#dc2626' }}>Failed classes: {result.ListClassError?.length || 0}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white',
              color: '#333'
            }}
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !file || !schoolPrefix}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: isProcessing ? '#ccc' : '#007bff',
              color: 'white'
            }}
          >
            {isProcessing ? 'Processing...' : 'Start Migration'}
          </button>
        </div>
      </div>
    </div>
  )
}
