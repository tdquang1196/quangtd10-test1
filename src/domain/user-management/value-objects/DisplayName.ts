/**
 * Value Object: DisplayName
 * Encapsulates display name generation and validation logic
 */

export class DisplayName {
  private readonly value: string

  private constructor(value: string) {
    this.value = value
    this.validate()
  }

  static create(value: string): DisplayName {
    return new DisplayName(value)
  }

  static generate(fullName: string): DisplayName {
    const parts = fullName.trim().split(' ').filter(p => p.length > 0)

    if (parts.length === 0) {
      throw new Error('Invalid full name for display name generation')
    }

    // Take last 2 words (or all if less than 2)
    const displayParts = parts.slice(-2)
    let displayName = displayParts.join(' ')

    // Ensure max 20 characters
    if (displayName.length > 20) {
      displayName = displayName.substring(0, 20).trim()
    }

    return new DisplayName(displayName)
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Display name cannot be empty')
    }

    if (this.value.length > 20) {
      throw new Error('Display name must not exceed 20 characters')
    }
  }

  getValue(): string {
    return this.value
  }

  equals(other: DisplayName): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
