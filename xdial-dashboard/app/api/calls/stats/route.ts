// app/api/calls/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const search = searchParams.get('search')

    console.log('Stats API filters:', { clientId, startDate, endDate, search })

    // Build WHERE clause for client and date/time filtering
    const conditions: string[] = []
    const params: any[] = []
    
    if (clientId) {
      conditions.push(`client_id = $${params.length + 1}`)
      params.push(clientId)
    }

    // Handle date filtering with proper timezone handling
    if (startDate) {
      // Convert ISO string to PostgreSQL timestamp
      const startDateObj = new Date(startDate)
      conditions.push(`timestamp >= $${params.length + 1}`)
      params.push(startDateObj.toISOString())
      console.log('Stats: Added start date filter:', startDateObj.toISOString())
    }

    if (endDate) {
      // Convert ISO string to PostgreSQL timestamp
      const endDateObj = new Date(endDate)
      conditions.push(`timestamp <= $${params.length + 1}`)
      params.push(endDateObj.toISOString())
      console.log('Stats: Added end date filter:', endDateObj.toISOString())
    }

    if (search) {
      conditions.push(`phone_number ILIKE $${params.length + 1}`)
      params.push(`%${search}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const statsQuery = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN response_category LIKE '%Interested%' OR response_category LIKE '%INTERESTED%' THEN 1 END) as calls_forwarded,
        COUNT(CASE WHEN response_category NOT LIKE '%Interested%' AND response_category NOT LIKE '%INTERESTED%' THEN 1 END) as calls_dropped,
        response_category,
        COUNT(*) as category_count
      FROM calls 
      ${whereClause}
      GROUP BY ROLLUP(response_category)
      ORDER BY category_count DESC NULLS FIRST
    `
    
    console.log('Stats Query:', statsQuery)
    console.log('Stats Params:', params)
    
    const result = await pool.query(statsQuery, params)
    
    const totalRow = result.rows.find(row => row.response_category === null)
    const categories = result.rows.filter(row => row.response_category !== null)
    
    const statsResult = {
      totalCalls: parseInt(totalRow?.total_calls || '0'),
      callsForwarded: parseInt(totalRow?.calls_forwarded || '0'),
      callsDropped: parseInt(totalRow?.calls_dropped || '0'),
      categories: categories.map(cat => ({
        name: cat.response_category,
        count: parseInt(cat.category_count)
      }))
    }

    console.log('Stats result:', statsResult)
    
    return NextResponse.json(statsResult)
  } catch (error) {
    console.error('Error fetching call stats:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json({ 
      error: 'Failed to fetch call stats',
      details: error.message 
    }, { status: 500 })
  }
}