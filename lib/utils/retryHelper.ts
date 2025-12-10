/**
 * Retry helper with exponential backoff
 * 
 * Retries a function up to maxRetries times with exponential backoff delay:
 * - Attempt 1: immediate
 * - Attempt 2: after 500ms
 * - Attempt 3: after 1000ms
 * - Attempt 4: after 2000ms
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number
        initialDelayMs?: number
        backoffMultiplier?: number
        context?: string
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelayMs = 500,
        backoffMultiplier = 2,
        context = 'Operation'
    } = options

    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error: any) {
            lastError = error

            // Don't retry on last attempt
            if (attempt >= maxRetries) {
                throw error
            }

            // Calculate backoff delay
            const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1)
            console.log(`[Retry ${attempt}/${maxRetries}] ${context} failed: ${error.message}. Retrying in ${delay}ms...`)

            await sleep(delay)
        }
    }

    throw lastError
}

export { sleep }
