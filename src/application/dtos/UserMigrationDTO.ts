/**
 * Data Transfer Objects for User Migration
 */

export interface ExcelRowDTO {
  fullName: string
  grade: string
  phoneNumber: string
}

export interface StudentDTO {
  fullName: string
  username: string
  displayName: string
  password: string
  grade: string
  className: string
  phoneNumber: string
}

export interface TeacherDTO {
  username: string
  displayName: string
  password: string
  className: string
}

export interface MigrationRequestDTO {
  ListDataStudent: Array<{
    username: string
    displayName: string
    password: string
    classses: string
    phoneNumber: string
  }>
  ListDataTeacher: Array<{
    username: string
    displayName: string
    password: string
    classses: string
    phoneNumber: string
  }>
  ListDataClasses: Array<{
    username: string
    displayName: string
    password: string
    classses: string
    phoneNumber: string
  }>
}

export interface MigrationResultDTO {
  ListDataStudent: Array<{
    id?: string
    username: string
    actualUserName?: string
    displayName: string
    password: string
    classses: string
    phoneNumber?: string
  }>
  ListDataTeacher: Array<{
    id?: string
    username: string
    actualUserName?: string
    displayName: string
    password: string
    classses: string
  }>
  ListDataClasses: any[]
  ListUserError: Array<{
    username: string
    displayName: string
    password: string
    classses: string
    phoneNumber?: string
    reason: string
  }>
  ListClassError?: any[]
}

export interface ProcessExcelResultDTO {
  students: StudentDTO[]
  teachers: TeacherDTO[]
  errors: Array<{ row: number; message: string }>
}
