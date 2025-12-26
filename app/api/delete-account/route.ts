import { NextRequest, NextResponse } from 'next/server'
import { DeleteAccountService, DeleteAccountData } from '@/lib/deleteAccountService'

export async function POST(req: NextRequest) {
    try {
        const { accounts, baseUrl } = await req.json()

        if (!accounts || !Array.isArray(accounts)) {
            return NextResponse.json(
                { error: 'Invalid request: accounts array is required' },
                { status: 400 }
            )
        }

        if (!baseUrl) {
            return NextResponse.json(
                { error: 'Invalid request: baseUrl is required' },
                { status: 400 }
            )
        }

        const service = new DeleteAccountService(baseUrl)
        const result = await service.deleteAccounts(accounts)

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Delete account API error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
