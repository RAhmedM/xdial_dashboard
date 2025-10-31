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
    const listIds = searchParams.getAll('list_ids')

    console.log('Outcome counts filters:', { clientId, startDate, endDate, search, listIdSearch, listIds })

    // Build WHERE conditions (same as calls API but without outcome filtering)
    const conditions: string[] = []
    const params: any[] = []

    if (clientId) {
      conditions.push(`c.client_id = $${params.length + 1}`)
      params.push(clientId)
    }

    // Handle date filtering - use as-is (no timezone conversion)
    if (startDate) {
      conditions.push(`c.timestamp >= $${params.length + 1}`)
      params.push(startDate)
      console.log('Outcome counts: Added start date filter:', startDate)
    }

    if (endDate) {
      conditions.push(`c.timestamp <= $${params.length + 1}`)
      params.push(endDate)
      console.log('Outcome counts: Added end date filter:', endDate)
    }

    if (search) {
      conditions.push(`(c.phone_number ILIKE $${params.length + 1} OR c.response_category ILIKE $${params.length + 1})`)
      params.push(`%${search}%`)
    }

    if (listIdSearch) {
      conditions.push(`c.list_id ILIKE $${params.length + 1}`)
      params.push(`%${listIdSearch}%`)
    }

    // Add list_id filters (when specific list IDs are selected)
    if (listIds.length > 0) {
      const listIdPlaceholders = listIds.map(() => {
        return `$${params.length + 1}`
      }).join(',')
      conditions.push(`c.list_id IN (${listIdPlaceholders})`)
      params.push(...listIds)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get counts for each outcome category
    // Normalize case variations by converting to a standard case for grouping
    const query = `
      SELECT 
        CASE 
          WHEN LOWER(REPLACE(response_category, '-', '_')) = 'answering_machine' THEN 'Answering_Machine'
          WHEN LOWER(response_category) = 'interested' THEN 'Interested'
          WHEN LOWER(REPLACE(response_category, '-', '_')) = 'not_interested' THEN 'Not_Interested'
          WHEN UPPER(response_category) = 'DNC' OR LOWER(REPLACE(response_category, '-', '_')) = 'do_not_call' THEN 'DNC'
          WHEN UPPER(response_category) = 'DNQ' OR LOWER(REPLACE(response_category, '-', '_')) = 'do_not_qualify' THEN 'DNQ'
          WHEN LOWER(response_category) = 'unknown' THEN 'Unknown'
          WHEN LOWER(REPLACE(response_category, '-', '_')) = 'user_silent' THEN 'User_Silent'
          WHEN LOWER(response_category) = 'honeypot' THEN 'Honeypot'
          WHEN LOWER(response_category) = 'inaudible' THEN 'INAUDIBLE'
          WHEN LOWER(response_category) = 'neutral' THEN 'neutral'
          WHEN UPPER(response_category) = 'NA' THEN 'NA'
          WHEN LOWER(REPLACE(response_category, '-', '_')) = 'user_hungup' THEN 'USER-HUNGUP'
          ELSE response_category
        END as normalized_category,
        COUNT(*) as count
      FROM calls c
      ${whereClause}
      GROUP BY normalized_category
      ORDER BY count DESC
    `

    console.log('Outcome counts query:', query)
    console.log('Outcome counts params:', params)

    const result = await pool.query(query, params)

    // Map database categories to filter categories (keys used by the frontend)
    // Note: Frontend uses these exact IDs - must match callOutcomes array in page.tsx
    const categoryMapping: { [key: string]: string } = {
      'Answering_Machine': 'answering-machine',
      'Interested': 'interested',
      'Not_Interested': 'not-interested',
      'DNC': 'do-not-call',
      'DNQ': 'do-not-qualify',
      'Unknown': 'unknown',
      // New categories - map to frontend IDs exactly as they appear in callOutcomes array
      // Note: SQL query normalizes these, so we should receive standard case
      'Honeypot': 'Honeypot',
      'User_Silent': 'User_Silent',
      'INAUDIBLE': 'INAUDIBLE',
      'neutral': 'neutral',
      'NA': 'NA',
      'USER-HUNGUP': 'USER-HUNGUP',
    }

    // Aggregate counts by filter category
    // Keys must exactly match the 'id' values in callOutcomes array in page.tsx
    const outcomeCounts: { [key: string]: number } = {
      'answering-machine': 0,
      'interested': 0,
      'not-interested': 0,
      'do-not-call': 0,
      'do-not-qualify': 0,
      'unknown': 0,
      // New categories (keys match frontend `id` values exactly)
      'Honeypot': 0,
      'User_Silent': 0,
      'INAUDIBLE': 0,
      'neutral': 0,
      'NA': 0,
      'USER-HUNGUP': 0,
    }

    result.rows.forEach((row: { normalized_category: string; count: string }) => {
      const dbCategory = row.normalized_category
      const filterCategory = categoryMapping[dbCategory]
      
      if (filterCategory && Object.prototype.hasOwnProperty.call(outcomeCounts, filterCategory)) {
        outcomeCounts[filterCategory] += parseInt(row.count)
      } else {
        // If category doesn't match our mapping, log it and add to unknown
        console.log('Unmapped category found:', dbCategory, 'count:', row.count)
        outcomeCounts['unknown'] += parseInt(row.count)
      }
    })

    console.log('Outcome counts result:', outcomeCounts)

    return NextResponse.json(outcomeCounts)
  } catch (error: any) {
    console.error('Error fetching outcome counts:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch outcome counts',
      details: error.message 
    }, { status: 500 })
  }
}