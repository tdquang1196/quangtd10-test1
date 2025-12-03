/**
 * Result pattern for error handling
 * Replaces throwing exceptions with explicit success/failure handling
 */

export class Result<T> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: string
  ) {}

  static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, value)
  }

  static fail<U>(error: string): Result<U> {
    return new Result<U>(false, undefined, error)
  }

  get isSuccess(): boolean {
    return this._isSuccess
  }

  get isFailure(): boolean {
    return !this._isSuccess
  }

  get value(): T {
    if (this.isFailure) {
      throw new Error('Cannot get value from failed result')
    }
    return this._value as T
  }

  get error(): string {
    if (this.isSuccess) {
      throw new Error('Cannot get error from successful result')
    }
    return this._error as string
  }

  match<U>(onSuccess: (value: T) => U, onFailure: (error: string) => U): U {
    return this.isSuccess ? onSuccess(this.value) : onFailure(this.error)
  }
}
