import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Hardcoded admin credentials
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Client ID and password are required' }, { status: 400 })
    }

    // Check if it's admin login
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      return NextResponse.json({
        success: true,
        userType: 'admin',
        user: {
          username: 'admin',
          role: 'administrator'
        },
        redirectTo: '/admin'
      })
    }

    // Check client credentials in database using client_id
    try {
      // Convert username to number for client_id lookup
      const clientId = parseInt(username)
      
      // If username is not a valid number, it's not a valid client ID
      if (isNaN(clientId)) {
        return NextResponse.json({ error: 'Invalid client ID format' }, { status: 401 })
      }

      const result = await pool.query(
        'SELECT client_id, client_name, extension FROM clients WHERE client_id = $1 AND password = $2',
        [clientId, password]
      )

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid client ID or password' }, { status: 401 })
      }

      const client = result.rows[0]
      return NextResponse.json({
        success: true,
        userType: 'client',
        user: {
          id: client.client_id,
          name: client.client_name,
          extension: client.extension
        },
        redirectTo: '/dashboard'
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
    }

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
