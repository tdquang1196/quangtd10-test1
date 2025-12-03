/**
 * Repository Interface: Class Repository
 * Defines contract for class data access
 */

import { Class } from '../entities/Class'
import { Result } from '../../shared/Result'

export interface IClassRepository {
  /**
   * Create a new class
   */
  create(classEntity: Class, studentIds: string[], teacherIds: string[]): Promise<Result<Class>>

  /**
   * Find class by name
   */
  findByName(name: string): Promise<Result<Class | null>>

  /**
   * Assign teacher to class
   */
  assignTeacher(classId: string, teacherId: string): Promise<Result<void>>

  /**
   * Add student to class
   */
  addStudent(classId: string, studentId: string): Promise<Result<void>>

  /**
   * Get all classes
   */
  findAll(): Promise<Result<Class[]>>
}
