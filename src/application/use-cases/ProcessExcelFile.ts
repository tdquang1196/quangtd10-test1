/**
 * Use Case: Process Excel File
 * Handles reading and validating Excel file for user migration
 */

import { Result } from '../../domain/shared/Result'
import { Username } from '../../domain/user-management/value-objects/Username'
import { DisplayName } from '../../domain/user-management/value-objects/DisplayName'
import { Password } from '../../domain/user-management/value-objects/Password'
import { ClassName } from '../../domain/user-management/value-objects/ClassName'
import { ExcelRowDTO, ProcessExcelResultDTO, StudentDTO, TeacherDTO } from '../dtos/UserMigrationDTO'

export class ProcessExcelFile {
  execute(rows: ExcelRowDTO[], schoolPrefix: string): Result<ProcessExcelResultDTO> {
    try {
      const students: StudentDTO[] = []
      const teachers: Map<string, TeacherDTO> = new Map()
      const errors: Array<{ row: number; message: string }> = []
      const currentYear = new Date().getFullYear()

      rows.forEach((row, index) => {
        try {
          if (!row.fullName || !row.grade) {
            errors.push({
              row: index + 1,
              message: 'Missing required fields: fullName or grade'
            })
            return
          }

          // Generate username and display name
          const username = Username.generate(row.fullName, schoolPrefix)
          const displayName = DisplayName.generate(row.fullName)
          const password = Password.generateRandom()
          const className = ClassName.generate(schoolPrefix, row.grade, currentYear)

          // Create student
          students.push({
            fullName: row.fullName,
            username: username.getValue(),
            displayName: displayName.getValue(),
            password: password.getValue(),
            grade: row.grade,
            className: className.getValue(),
            phoneNumber: row.phoneNumber || ''
          })

          // Create teacher if not exists
          if (!teachers.has(className.getValue())) {
            const teacherUsername = Username.generateTeacher(row.grade, schoolPrefix)
            const teacherPassword = Password.generateRandom()

            teachers.set(className.getValue(), {
              username: teacherUsername.getValue(),
              displayName: teacherUsername.getValue(),
              password: teacherPassword.getValue(),
              className: className.getValue()
            })
          }
        } catch (error: any) {
          errors.push({
            row: index + 1,
            message: error.message
          })
        }
      })

      return Result.ok({
        students,
        teachers: Array.from(teachers.values()),
        errors
      })
    } catch (error: any) {
      return Result.fail(`Failed to process Excel file: ${error.message}`)
    }
  }
}
