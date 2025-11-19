// app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const client = await pool.connect()
  
  try {
    // Handle both Promise and direct params (for Next.js version compatibility)
    const params = 'then' in context.params ? await context.params : context.params
    const clientId = parseInt(params.id)
    const body = await request.json()
    const { client_name, password, extension, call_data_url, recording_urls } = body

    console.log('📝 PUT /api/clients/' + clientId + ' - Updating client:', {
      client_name,
      extension,
      recording_urls_count: recording_urls?.length || 0,
      recording_urls_data: recording_urls
    })

    // Start transaction
    await client.query('BEGIN')
    console.log('🔄 Transaction started')

    // Update client
    await client.query(
      `UPDATE clients 
       SET client_name = $1, password = $2, extension = $3, call_data_url = $4
       WHERE client_id = $5`,
      [client_name, password, extension, call_data_url, clientId]
    )
    console.log('✅ Client updated')

    // Delete existing recording URLs
    const deleteResult = await client.query(
      `DELETE FROM client_recording_urls WHERE client_id = $1`,
      [clientId]
    )
    console.log(`🗑️ Deleted ${deleteResult.rowCount} existing URLs`)

    // Insert new recording URLs
    if (recording_urls && Array.isArray(recording_urls) && recording_urls.length > 0) {
      let insertedCount = 0
      for (const url of recording_urls) {
        if (url && url.trim() !== '') {
          const insertResult = await client.query(
            `INSERT INTO client_recording_urls (client_id, recording_url) 
             VALUES ($1, $2) RETURNING *`,
            [clientId, url.trim()]
          )
          insertedCount++
          console.log(`  ✅ Inserted URL ${insertedCount}:`, insertResult.rows[0])
        }
      }
      console.log(`✅ Inserted ${insertedCount} new recording URLs`)
    }

    // Commit transaction
    await client.query('COMMIT')
    console.log('✅ Transaction committed')

    // Use client connection to get committed data
    const result = await client.query(`
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

    console.log('📊 Updated client data BEFORE RETURN:', {
      client_id: result.rows[0].client_id,
      client_name: result.rows[0].client_name,
      recording_urls_count: result.rows[0].recording_urls.length,
      recording_urls_data: result.rows[0].recording_urls,
      full_object: result.rows[0]
    })

    return NextResponse.json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error updating client:', error)
    return NextResponse.json({ 
      error: 'Failed to update client',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js version compatibility)
    const params = 'then' in context.params ? await context.params : context.params
    const clientId = parseInt(params.id)
    
    console.log('🗑️ DELETE /api/clients/' + clientId)
    
    // The CASCADE on the foreign key will automatically delete recording URLs
    await pool.query('DELETE FROM clients WHERE client_id = $1', [clientId])
    
    console.log('✅ Client deleted successfully')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Error deleting client:', error)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}