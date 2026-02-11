import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Forward to backend API
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
            return NextResponse.json(data, { status: response.status })
        }

        // Backend response format: { success, data: { token, user } }
        const token = data.data?.token || data.token
        const user = data.data?.user || data.user

        // Create response with flattened structure for frontend
        const responseData = {
            success: true,
            token,
            user
        }

        const res = NextResponse.json(responseData)
        
        if (token) {
            res.cookies.set('token', token, {
                httpOnly: false, // Allow JS to read for client-side logic
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 86400, // 24 hours
                path: '/',
            })
        }

        return res
    } catch (error) {
        console.error('Auth API error:', error)
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        )
    }
}
