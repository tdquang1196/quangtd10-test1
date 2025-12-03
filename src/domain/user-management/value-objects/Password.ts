/**
 * Value Object: Password
 * Encapsulates password generation and validation logic
 */

export class Password {
  private readonly value: string

  private constructor(value: string) {
    this.value = value
    this.validate()
  }

  static create(value: string): Password {
    return new Password(value)
  }

  static generateRandom(): Password {
    const min = 1000
    const max = 9999
    const randomPassword = Math.floor(Math.random() * (max - min + 1) + min).toString()
    return new Password(randomPassword)
  }

  private validate(): void {
    if (!this.value || this.value.length < 4) {
      throw new Error('Password must be at least 4 characters')
    }
  }

  getValue(): string {
    return this.value
  }

  equals(other: Password): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
