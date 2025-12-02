import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const apiUrl = process.env.NEXT_PUBLIC_API_URL

    if (!apiUrl) {
      return NextResponse.json(
        { error: 'API URL not configured' },
        { status: 500 }
      )
    }

    // Call the C# backend API
    const response = await axios.post(
      `${apiUrl}/api/users/migration`,
      body,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes timeout for large migrations
      }
    )

    return NextResponse.json(response.data)
  } catch (error) {
    console.error('Migration API error:', error)

    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: 'Migration failed',
          message: error.response?.data?.message || error.message
        },
        { status: error.response?.status || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Unknown error occurred' },
      { status: 500 }
    )
  }
}
