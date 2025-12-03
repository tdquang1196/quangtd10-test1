/**
 * Domain Entity: Class
 * Represents a class/group in the system
 */

export interface ClassProps {
  id?: string
  name: string
  teacherId?: string
  studentIds: string[]
  grade: string
  year: number
  startDate?: Date
  endDate?: Date
}

export class Class {
  private constructor(private props: ClassProps) {
    this.validate()
  }

  static create(props: ClassProps): Class {
    return new Class(props)
  }

  private validate(): void {
    if (!this.props.name) {
      throw new Error('Class name is required')
    }

    if (!this.props.grade) {
      throw new Error('Grade is required')
    }

    if (!this.props.year || this.props.year < 2000) {
      throw new Error('Valid year is required')
    }
  }

  // Getters
  get id(): string | undefined {
    return this.props.id
  }

  get name(): string {
    return this.props.name
  }

  get teacherId(): string | undefined {
    return this.props.teacherId
  }

  get studentIds(): string[] {
    return [...this.props.studentIds]
  }

  get grade(): string {
    return this.props.grade
  }

  get year(): number {
    return this.props.year
  }

  // Business methods
  assignTeacher(teacherId: string): void {
    this.props.teacherId = teacherId
  }

  addStudent(studentId: string): void {
    if (!this.props.studentIds.includes(studentId)) {
      this.props.studentIds.push(studentId)
    }
  }

  removeStudent(studentId: string): void {
    this.props.studentIds = this.props.studentIds.filter(id => id !== studentId)
  }

  get studentCount(): number {
    return this.props.studentIds.length
  }

  toJSON(): ClassProps {
    return { ...this.props }
  }
}
