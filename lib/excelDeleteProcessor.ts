import * as XLSX from 'xlsx'
import { DeleteAccountData } from '@/lib/deleteAccountService'

export interface ExcelProcessResult {
    accounts: DeleteAccountData[]
    errors: string[]
}

export function processDeleteAccountExcel(file: File): Promise<ExcelProcessResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
            try {
                const data = e.target?.result
                const workbook = XLSX.read(data, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

                const accounts: DeleteAccountData[] = []
                const errors: string[] = []

                // Skip header row if exists
                const startRow = 1

                for (let i = startRow; i < jsonData.length; i++) {
                    const row = jsonData[i]
                    const rowNumber = i + 1

                    // Skip empty rows
                    if (!row || row.length === 0 || !row[0]) {
                        continue
                    }

                    const username = row[0]?.toString().trim()
                    const password = row[1]?.toString().trim()

                    // Validate required fields
                    if (!username) {
                        errors.push(`Row ${rowNumber}: Missing username`)
                        continue
                    }

                    if (!password) {
                        errors.push(`Row ${rowNumber}: Missing password`)
                        continue
                    }

                    accounts.push({
                        username,
                        password,
                        status: 'pending'
                    })
                }

                if (accounts.length === 0 && errors.length === 0) {
                    errors.push('No valid data found in Excel file')
                }

                resolve({ accounts, errors })
            } catch (error: any) {
                reject(new Error(`Failed to process Excel file: ${error.message}`))
            }
        }

        reader.onerror = () => {
            reject(new Error('Failed to read file'))
        }

        reader.readAsBinaryString(file)
    })
}
