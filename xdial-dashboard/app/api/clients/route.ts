import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY client_name')
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { client_name, password, extension, call_data_url, fetch_recording_url } = body

    const result = await pool.query(
      `INSERT INTO clients (client_name, password, extension, call_data_url, fetch_recording_url) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [client_name, password, extension, call_data_url, fetch_recording_url]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
