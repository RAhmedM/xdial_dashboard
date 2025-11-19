// app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET() {
  try {
    console.log('🔍 GET /api/clients - Fetching all clients')
    
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
    
    console.log(`✅ Fetched ${result.rows.length} clients`)
    result.rows.forEach(client => {
      console.log(`  - Client ${client.client_id}: ${client.recording_urls.length} URLs`)
    })
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('❌ Error fetching clients:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect()
  
  try {
    const body = await request.json()
    const { client_name, password, extension, call_data_url, recording_urls } = body

    console.log('📝 POST /api/clients - Creating new client:', {
      client_name,
      extension,
      recording_urls_count: recording_urls?.length || 0
    })

    // Start transaction
    await client.query('BEGIN')
    console.log('🔄 Transaction started')

    // Insert client
    const clientResult = await client.query(
      `INSERT INTO clients (client_name, password, extension, call_data_url) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [client_name, password, extension, call_data_url]
    )

    const newClient = clientResult.rows[0]
    console.log('✅ Client created with ID:', newClient.client_id)

    // Insert recording URLs if provided
    if (recording_urls && Array.isArray(recording_urls) && recording_urls.length > 0) {
      let insertedCount = 0
      for (const url of recording_urls) {
        if (url && url.trim() !== '') {
          const insertResult = await client.query(
            `INSERT INTO client_recording_urls (client_id, recording_url) 
             VALUES ($1, $2) RETURNING *`,
            [newClient.client_id, url.trim()]
          )
          insertedCount++
          console.log(`  ✅ Inserted URL ${insertedCount}:`, insertResult.rows[0])
        }
      }
      console.log(`✅ Inserted ${insertedCount} recording URLs`)
    }

    // Commit transaction
    await client.query('COMMIT')
    console.log('✅ Transaction committed')

    // Use client connection to get committed data
    const completeResult = await client.query(`
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

    console.log('📊 Complete client data:', {
      client_id: completeResult.rows[0].client_id,
      client_name: completeResult.rows[0].client_name,
      recording_urls_count: completeResult.rows[0].recording_urls.length,
      recording_urls: completeResult.rows[0].recording_urls
    })

    return NextResponse.json(completeResult.rows[0], { status: 201 })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error creating client:', error)
    return NextResponse.json({ 
      error: 'Failed to create client',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  } finally {
    client.release()
  }
}