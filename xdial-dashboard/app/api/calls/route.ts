import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''
    const clientId = searchParams.get('client_id') || ''
    const responseCategories = searchParams.getAll('response_categories')
    const sortField = searchParams.get('sort_field') || 'timestamp'
    const sortDirection = searchParams.get('sort_direction') || 'desc'

    const offset = (page - 1) * limit

    // Build dynamic WHERE conditions
    const conditions = []
    const params: any[] = []
    let paramCount = 0

    // Search filter (phone number, response category, or list_id)
    if (search) {
      paramCount++
      conditions.push(`(c.phone_number ILIKE $${paramCount} OR c.response_category ILIKE $${paramCount} OR c.list_id ILIKE $${paramCount})`)
      params.push(`%${search}%`)
    }

    // Date range filters
    if (startDate) {
      paramCount++
      conditions.push(`c.timestamp >= $${paramCount}`)
      params.push(startDate)
    }

    if (endDate) {
      paramCount++
      conditions.push(`c.timestamp <= $${paramCount}`)
      params.push(endDate)
    }

    // Client ID filter
    if (clientId) {
      paramCount++
      conditions.push(`c.client_id = $${paramCount}`)
      params.push(parseInt(clientId))
    }

    // Response categories filter
    if (responseCategories.length > 0) {
      // Handle case sensitivity and specific mappings
      const dbCategories = responseCategories.map(category => {
        switch (category) {
          case 'unknown':
            return 'Unknown'
          case 'user-silent':
            return 'User_Silent'
          default:
            return category // Most categories match exactly
        }
      })
      
      const categoryPlaceholders = dbCategories.map(() => {
        paramCount++
        return `$${paramCount}`
      }).join(',')
      conditions.push(`c.response_category IN (${categoryPlaceholders})`)
      params.push(...dbCategories)
    }

    const whereClause = conditions.length > 0 ? 
        `WHERE ${conditions.join(' AND ')}` : ''

    // Validate and map sort field to database column
    const validSortFields: { [key: string]: string } = {
      'call_id': 'c.call_id',
      'phone_number': 'c.phone_number',
      'list_id': 'c.list_id',
      'response_category': 'c.response_category',
      'timestamp': 'c.timestamp',
      'client_name': 'cl.client_name'
    }

    const validSortDirections = ['asc', 'desc']
    const sortColumn = validSortFields[sortField] || validSortFields['timestamp']
    const sortDir = validSortDirections.includes(sortDirection.toLowerCase()) 
      ? sortDirection.toUpperCase() 
      : 'DESC'

    // First, get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM calls c 
      LEFT JOIN clients cl ON c.client_id = cl.client_id 
      ${whereClause}
    `
    
    console.log('Count Query:', countQuery)
    console.log('Count Params:', params)
    
    const countResult = await pool.query(countQuery, params)
    const total = parseInt(countResult.rows[0].total)

    // Then get the actual data with pagination - Updated to include list_id and final_transcription
    const dataQuery = `
      SELECT 
        c.call_id,
        c.client_id,
        c.phone_number,
        c.response_category,
        c.timestamp,
        c.recording_url,
        c.recording_length,
        c.list_id,
        c.final_transcription,
        COALESCE(cl.client_name, 'Unknown Client') as client_name
      FROM calls c 
      LEFT JOIN clients cl ON c.client_id = cl.client_id 
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    const dataParams = [...params, limit, offset]
    
    console.log('Data Query:', dataQuery)
    console.log('Data Params:', dataParams)

    const result = await pool.query(dataQuery, dataParams)

    console.log('Query results:', {
      totalRows: total,
      returnedRows: result.rows.length,
      filters: { startDate, endDate, clientId, responseCategories },
      sampleTimestamps: result.rows.slice(0, 3).map(row => row.timestamp)
    })

    return NextResponse.json({
      calls: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching calls:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json({ 
      error: 'Failed to fetch calls',
      details: error.message 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Updated to include list_id
    const { client_id, phone_number, response_category, recording_url, recording_length, list_id } = body

    // Updated INSERT query to include list_id
    const result = await pool.query(
      `INSERT INTO calls (client_id, phone_number, response_category, recording_url, recording_length, list_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [client_id, phone_number, response_category, recording_url, recording_length, list_id]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating call:', error)
    return NextResponse.json({ error: 'Failed to create call' }, { status: 500 })
  }
}