import axios, { AxiosInstance } from 'axios'

export interface DeleteAccountData {
    username: string
    password: string
    status?: 'pending' | 'logging-in' | 'deleting' | 'success' | 'error'
    error?: string
    accessToken?: string
}

export interface DeleteAccountResult {
    successful: DeleteAccountData[]
    failed: DeleteAccountData[]
}

export type DeleteStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled'

export interface DeleteProgress {
    status: DeleteStatus
    currentIndex: number
    totalAccounts: number
    successful: DeleteAccountData[]
    failed: DeleteAccountData[]
}

export class DeleteAccountService {
    private baseUrl: string
    private _status: DeleteStatus = 'idle'
    private onProgress?: (progress: DeleteProgress) => void
    private shouldPause = false
    private shouldCancel = false

    // Progress tracking
    private currentIndex = 0
    private successful: DeleteAccountData[] = []
    private failed: DeleteAccountData[] = []

    constructor(baseUrl: string, onProgress?: (progress: DeleteProgress) => void) {
        this.baseUrl = baseUrl
        this.onProgress = onProgress
    }

    get status(): DeleteStatus {
        return this._status
    }

    pause(): void {
        if (this._status === 'running') {
            this.shouldPause = true
            console.log('[DeleteAccountService] Pause requested')
        }
    }

    resume(): void {
        if (this._status === 'paused') {
            this.shouldPause = false
            this._status = 'running'
            console.log('[DeleteAccountService] Resumed')
            this.emitProgress()
        }
    }

    cancel(): void {
        this.shouldCancel = true
        this._status = 'cancelled'
        console.log('[DeleteAccountService] Cancelled')
        this.emitProgress()
    }

    private emitProgress(): void {
        if (this.onProgress) {
            this.onProgress({
                status: this._status,
                currentIndex: this.currentIndex,
                totalAccounts: this.successful.length + this.failed.length + (this.currentIndex < this.successful.length + this.failed.length ? 1 : 0),
                successful: [...this.successful],
                failed: [...this.failed]
            })
        }
    }

    private async loginAndDelete(account: DeleteAccountData): Promise<void> {
        let client: AxiosInstance | null = null

        try {
            // Step 1: Login
            account.status = 'logging-in'
            this.emitProgress()

            const loginResponse = await axios.post(`${this.baseUrl}/auth/login`, {
                username: account.username,
                password: account.password
            })

            if (!loginResponse.data?.accessToken) {
                throw new Error('Login failed: No access token received')
            }

            const accessToken = loginResponse.data.accessToken
            account.accessToken = accessToken

            // Create authenticated client
            client = axios.create({
                baseURL: this.baseUrl,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            })

            // Step 2: Delete account
            account.status = 'deleting'
            this.emitProgress()

            const deleteResponse = await client.post('/account/users/delete', {
                password: account.password
            })

            // API returns boolean: true = success, false = failed
            if (deleteResponse.data === true) {
                // Success
                account.status = 'success'
                this.successful.push(account)
                console.log(`✅ Successfully deleted account: ${account.username}`)
            } else {
                // API returned false
                throw new Error('Delete API returned false - deletion failed')
            }


        } catch (error: any) {
            account.status = 'error'
            account.error = error.response?.data?.message || error.message || 'Unknown error'
            this.failed.push(account)
            console.error(`❌ Failed to delete account ${account.username}:`, account.error)
        }
    }

    async deleteAccounts(accounts: DeleteAccountData[]): Promise<DeleteAccountResult> {
        this._status = 'running'
        this.shouldPause = false
        this.shouldCancel = false
        this.currentIndex = 0
        this.successful = []
        this.failed = []

        console.log(`[DeleteAccountService] Starting deletion of ${accounts.length} accounts`)

        for (let i = 0; i < accounts.length; i++) {
            // Check for cancellation
            if (this.shouldCancel) {
                console.log('[DeleteAccountService] Cancelled by user')
                break
            }

            // Check for pause
            while (this.shouldPause && !this.shouldCancel) {
                this._status = 'paused'
                this.emitProgress()
                await new Promise(resolve => setTimeout(resolve, 500))
            }

            if (this.shouldCancel) break

            this._status = 'running'
            this.currentIndex = i

            const account = accounts[i]
            console.log(`[${i + 1}/${accounts.length}] Processing account: ${account.username}`)

            await this.loginAndDelete(account)
            this.emitProgress()

            // Small delay between accounts to avoid rate limiting
            if (i < accounts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        this._status = this.shouldCancel ? 'cancelled' : 'completed'
        this.emitProgress()

        console.log(`[DeleteAccountService] Completed. Success: ${this.successful.length}, Failed: ${this.failed.length}`)

        return {
            successful: this.successful,
            failed: this.failed
        }
    }
}
