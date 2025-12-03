/**
 * Value Object: ClassName
 * Encapsulates class name generation and formatting logic
 */

export class ClassName {
  private readonly value: string

  private constructor(value: string) {
    this.value = value
    this.validate()
  }

  static create(value: string): ClassName {
    return new ClassName(value)
  }

  static generate(schoolPrefix: string, grade: string, year: number): ClassName {
    const className = `${schoolPrefix.toUpperCase()}_${grade.toUpperCase()}_${year}`
    return new ClassName(className)
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Class name cannot be empty')
    }
  }

  getValue(): string {
    return this.value
  }

  equals(other: ClassName): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
