import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { client_name, password, extension, call_data_url, fetch_recording_url } = body
    const clientId = params.id

    const result = await pool.query(
      `UPDATE clients 
       SET client_name = $1, password = $2, extension = $3, call_data_url = $4, fetch_recording_url = $5 
       WHERE client_id = $6 RETURNING *`,
      [client_name, password, extension, call_data_url, fetch_recording_url, clientId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id
    
    const result = await pool.query('DELETE FROM clients WHERE client_id = $1 RETURNING *', [clientId])
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Client deleted successfully' })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}
