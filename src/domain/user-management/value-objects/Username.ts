/**
 * Value Object: Username
 * Encapsulates username generation and validation logic
 */

export class Username {
  private readonly value: string

  private constructor(value: string) {
    this.value = value
    this.validate()
  }

  static create(value: string): Username {
    return new Username(value)
  }

  static generate(fullName: string, schoolPrefix: string): Username {
    const normalized = this.normalizeVietnamese(fullName)
    const parts = normalized.split(' ').filter(p => p.length > 0)

    if (parts.length === 0) {
      throw new Error('Invalid full name for username generation')
    }

    const lastName = parts[parts.length - 1].toLowerCase()
    const firstLetters = parts.slice(0, -1).map(p => p[0].toLowerCase()).join('')

    let username = `${schoolPrefix}${lastName}${firstLetters}`

    // Ensure length is within bounds (6-20 characters)
    if (username.length < 6) {
      username = username.padEnd(6, '0')
    } else if (username.length > 20) {
      username = username.substring(0, 20)
    }

    return new Username(username)
  }

  static generateTeacher(grade: string, schoolPrefix: string): Username {
    const username = `${schoolPrefix}gv${grade.toLowerCase()}`
    return new Username(username)
  }

  private static normalizeVietnamese(text: string): string {
    // Remove Vietnamese diacritics
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
  }

  private validate(): void {
    if (!this.value || this.value.length < 6) {
      throw new Error('Username must be at least 6 characters')
    }

    if (this.value.length > 20) {
      throw new Error('Username must not exceed 20 characters')
    }

    if (!/^[a-z0-9]+$/.test(this.value)) {
      throw new Error('Username must contain only lowercase letters and numbers')
    }
  }

  getValue(): string {
    return this.value
  }

  equals(other: Username): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
