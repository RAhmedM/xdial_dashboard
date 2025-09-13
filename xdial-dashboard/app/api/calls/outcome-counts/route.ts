// app/api/calls/outcome-counts/route.ts
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
    const listIdSearch = searchParams.get('list_id_search')

    console.log('Outcome counts filters:', { clientId, startDate, endDate, search, listIdSearch })

    // Build WHERE conditions
    const conditions: string[] = []
    const params: any[] = []
    let paramCount = 0

    if (clientId) {
      paramCount++
      conditions.push(`c.client_id = $${paramCount}`)
      params.push(clientId)
    }

    // Handle date filtering without timezone conversion - use as-is
    if (startDate) {
      paramCount++
      conditions.push(`c.timestamp >= $${paramCount}`)
      params.push(startDate)
      console.log('Outcome counts: Added start date filter:', startDate)
    }

    if (endDate) {
      paramCount++
      conditions.push(`c.timestamp <= $${paramCount}`)
      params.push(endDate)
      console.log('Outcome counts: Added end date filter:', endDate)
    }

    // General search (phone number or response category)
    if (search) {
      paramCount++
      conditions.push(`(c.phone_number ILIKE $${paramCount} OR c.response_category ILIKE $${paramCount})`)
      params.push(`%${search}%`)
    }

    // Separate List ID search
    if (listIdSearch) {
      paramCount++
      conditions.push(`c.list_id ILIKE $${paramCount}`)
      params.push(`%${listIdSearch}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get counts for each outcome category
    const query = `
      SELECT 
        response_category,
        COUNT(*) as count
      FROM calls c
      ${whereClause}
      GROUP BY response_category
      ORDER BY count DESC
    `

    console.log('Outcome counts query:', query)
    console.log('Outcome counts params:', params)

    const result = await pool.query(query, params)

    // Map database categories to filter categories
    const categoryMapping: { [key: string]: string } = {
      'Answering_Machine': 'answering-machine',
      'Interested': 'interested',
      'Not_Interested': 'not-interested',
      'DNC': 'do-not-call',
      'DNQ': 'do-not-qualify',
      'Unknown': 'unknown'
    }

    // Aggregate counts by filter category
    const outcomeCounts: { [key: string]: number } = {
      'answering-machine': 0,
      'interested': 0,
      'not-interested': 0,
      'do-not-call': 0,
      'do-not-qualify': 0,
      'unknown': 0,
      'user-silent': 0
    }

    result.rows.forEach(row => {
      const filterCategory = categoryMapping[row.response_category]
      if (filterCategory && outcomeCounts.hasOwnProperty(filterCategory)) {
        outcomeCounts[filterCategory] += parseInt(row.count)
      } else {
        // If category doesn't match our mapping, add to unknown
        console.log('Unmapped category found:', row.response_category)
        outcomeCounts['unknown'] += parseInt(row.count)
      }
    })

    console.log('Outcome counts result:', outcomeCounts)

    return NextResponse.json(outcomeCounts)
  } catch (error) {
    console.error('Error fetching outcome counts:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch outcome counts',
      details: error.message 
    }, { status: 500 })
  }
}