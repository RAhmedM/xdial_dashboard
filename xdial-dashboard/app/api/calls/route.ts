import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const responseCategory = searchParams.get('response_category')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = (page - 1) * limit

    // Get multiple response categories from the URL
    const responseCategories = searchParams.getAll('response_categories')

    console.log('API Filters received:', {
      clientId,
      startDate,
      endDate,
      search,
      responseCategories,
      page,
      limit
    })

    // Build WHERE conditions
    const conditions: string[] = []
    const params: any[] = []

    // Add conditions dynamically
    if (clientId) {
      conditions.push(`c.client_id = $${params.length + 1}`)
      params.push(clientId)
    }

    if (responseCategory) {
      conditions.push(`c.response_category = $${params.length + 1}`)
      params.push(responseCategory)
    }

    // Handle multiple response categories (from outcomes filter)
    if (responseCategories.length > 0) {
      // Map filter IDs to actual database values
      const categoryMapping: { [key: string]: string[] } = {
        'answering-machine': ['ANSWER_MACHINE_hello', 'ANSWER MACHINE_hello'],
        'interested': ['INTERESTED_hello', 'INTERESTED hello'],
        'not-interested': ['Not_Responding_hello', 'NOT_INTERESTED_hello'],
        'do-not-call': ['DO_NOT_CALL_hello'],
        'do-not-qualify': ['DO_NOT_QUALIFY_hello'],
        'unknown': ['UNKNOWN_hello', 'UNKNOWN_greeting', 'UNKNOWN hello'],
        'user-silent': ['USER_SILENT_hello', 'User Silent_hello']
      }

      const dbCategories: string[] = []
      responseCategories.forEach(category => {
        if (categoryMapping[category]) {
          dbCategories.push(...categoryMapping[category])
        }
      })

      if (dbCategories.length > 0) {
        const placeholders = dbCategories.map((_, index) => `$${params.length + index + 1}`).join(', ')
        conditions.push(`c.response_category IN (${placeholders})`)
        params.push(...dbCategories)
      }
    }

    // Handle date filtering properly
    if (startDate) {
      conditions.push(`c.timestamp >= $${params.length + 1}::timestamp`)
      params.push(startDate)
      console.log('Added start date filter:', startDate)
    }

    if (endDate) {
      conditions.push(`c.timestamp <= $${params.length + 1}::timestamp`)
      params.push(endDate)
      console.log('Added end date filter:', endDate)
    }

    if (search) {
      conditions.push(`c.phone_number ILIKE $${params.length + 1}`)
      params.push(`%${search}%`)
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

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

    // Then get the actual data with pagination
    const dataQuery = `
      SELECT 
        c.call_id,
        c.client_id,
        c.phone_number,
        c.response_category,
        c.timestamp,
        c.recording_url,
        c.recording_length,
        COALESCE(cl.client_name, 'Unknown Client') as client_name
      FROM calls c 
      LEFT JOIN clients cl ON c.client_id = cl.client_id 
      ${whereClause}
      ORDER BY c.timestamp DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    const dataParams = [...params, limit, offset]
    
    console.log('Data Query:', dataQuery)
    console.log('Data Params:', dataParams)

    const result = await pool.query(dataQuery, dataParams)

    console.log('Query results:', {
      totalRows: total,
      returnedRows: result.rows.length,
      filters: { startDate, endDate, clientId, responseCategories }
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
    const { client_id, phone_number, response_category, recording_url, recording_length } = body

    const result = await pool.query(
      `INSERT INTO calls (client_id, phone_number, response_category, recording_url, recording_length) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [client_id, phone_number, response_category, recording_url, recording_length]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating call:', error)
    return NextResponse.json({ error: 'Failed to create call' }, { status: 500 })
  }
}