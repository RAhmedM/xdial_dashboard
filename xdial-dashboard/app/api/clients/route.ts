// app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET() {
  try {
    // Fetch clients with their recording URLs
    const result = await pool.query(`
      SELECT 
        c.*,
        COALESCE(
          json_agg(
            json_build_object('id', cru.id, 'recording_url', cru.recording_url)
            ORDER BY cru.id
          ) FILTER (WHERE cru.id IS NOT NULL),
          '[]'
        ) as recording_urls
      FROM clients c
      LEFT JOIN client_recording_urls cru ON c.client_id = cru.client_id
      GROUP BY c.client_id
      ORDER BY c.client_name
    `)
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect()
  
  try {
    const body = await request.json()
    const { client_name, password, extension, call_data_url, recording_urls } = body

    // Start transaction
    await client.query('BEGIN')

    // Insert client
    const clientResult = await client.query(
      `INSERT INTO clients (client_name, password, extension, call_data_url, fetch_recording_url) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [client_name, password, extension, call_data_url, recording_urls && recording_urls.length > 0 ? recording_urls[0] : null]
    )

    const newClient = clientResult.rows[0]

    // Insert recording URLs if provided
    if (recording_urls && Array.isArray(recording_urls) && recording_urls.length > 0) {
      for (const url of recording_urls) {
        if (url && url.trim() !== '') {
          await client.query(
            `INSERT INTO client_recording_urls (client_id, recording_url) VALUES ($1, $2)`,
            [newClient.client_id, url.trim()]
          )
        }
      }
    }

    // Commit transaction
    await client.query('COMMIT')

    // Fetch the complete client data with recording URLs
    const completeResult = await pool.query(`
      SELECT 
        c.*,
        COALESCE(
          json_agg(
            json_build_object('id', cru.id, 'recording_url', cru.recording_url)
            ORDER BY cru.id
          ) FILTER (WHERE cru.id IS NOT NULL),
          '[]'
        ) as recording_urls
      FROM clients c
      LEFT JOIN client_recording_urls cru ON c.client_id = cru.client_id
      WHERE c.client_id = $1
      GROUP BY c.client_id
    `, [newClient.client_id])

    return NextResponse.json(completeResult.rows[0], { status: 201 })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  } finally {
    client.release()
  }
}

// app/api/clients/[id]/route.ts
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = await pool.connect()
  
  try {
    const clientId = parseInt(params.id)
    const body = await request.json()
    const { client_name, password, extension, call_data_url, recording_urls } = body

    // Start transaction
    await client.query('BEGIN')

    // Update client
    await client.query(
      `UPDATE clients 
       SET client_name = $1, password = $2, extension = $3, call_data_url = $4, 
           fetch_recording_url = $5
       WHERE client_id = $6`,
      [client_name, password, extension, call_data_url, 
       recording_urls && recording_urls.length > 0 ? recording_urls[0] : null, 
       clientId]
    )

    // Delete existing recording URLs
    await client.query(
      `DELETE FROM client_recording_urls WHERE client_id = $1`,
      [clientId]
    )

    // Insert new recording URLs
    if (recording_urls && Array.isArray(recording_urls) && recording_urls.length > 0) {
      for (const url of recording_urls) {
        if (url && url.trim() !== '') {
          await client.query(
            `INSERT INTO client_recording_urls (client_id, recording_url) VALUES ($1, $2)`,
            [clientId, url.trim()]
          )
        }
      }
    }

    // Commit transaction
    await client.query('COMMIT')

    // Fetch updated client with recording URLs
    const result = await pool.query(`
      SELECT 
        c.*,
        COALESCE(
          json_agg(
            json_build_object('id', cru.id, 'recording_url', cru.recording_url)
            ORDER BY cru.id
          ) FILTER (WHERE cru.id IS NOT NULL),
          '[]'
        ) as recording_urls
      FROM clients c
      LEFT JOIN client_recording_urls cru ON c.client_id = cru.client_id
      WHERE c.client_id = $1
      GROUP BY c.client_id
    `, [clientId])

    return NextResponse.json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating client:', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = parseInt(params.id)
    
    // The CASCADE on the foreign key will automatically delete recording URLs
    await pool.query('DELETE FROM clients WHERE client_id = $1', [clientId])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}