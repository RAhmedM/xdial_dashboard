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
    const responseCategories = searchParams.getAll('response_categories')

    // Build WHERE conditions
    const conditions = []
    const params: any[] = []
    let paramCount = 0

    // Add client filter if provided
    if (clientId) {
      paramCount++
      conditions.push(`client_id = $${paramCount}`)
      params.push(parseInt(clientId))
    }

    // Add date filters
    if (startDate) {
      paramCount++
      conditions.push(`timestamp >= $${paramCount}`)
      params.push(startDate)
    }

    if (endDate) {
      paramCount++
      conditions.push(`timestamp <= $${paramCount}`)
      params.push(endDate)
    }

    // Add response category filters (disposition filters)
    if (responseCategories.length > 0) {
      const categoryPlaceholders = responseCategories.map(() => {
        paramCount++
        return `$${paramCount}`
      }).join(',')
      conditions.push(`response_category IN (${categoryPlaceholders})`)
      params.push(...responseCategories)
    }

    // Only include records with non-null list_id
    conditions.push('list_id IS NOT NULL')
    conditions.push("list_id != ''")

    const whereClause = conditions.length > 0 ? 
      `WHERE ${conditions.join(' AND ')}` : ''

    const query = `
      SELECT 
        list_id,
        COUNT(*) as count
      FROM calls 
      ${whereClause}
      GROUP BY list_id
      HAVING COUNT(*) > 0
      ORDER BY count DESC, list_id ASC
    `

    console.log('List IDs Query:', query)
    console.log('List IDs Params:', params)

    const result = await pool.query(query, params)

    const listIds = result.rows.map(row => ({
      list_id: row.list_id,
      count: parseInt(row.count)
    }))

    return NextResponse.json({
      listIds,
      total: listIds.length
    })
  } catch (error) {
    console.error('Error fetching list IDs:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch list IDs',
      details: error.message 
    }, { status: 500 })
  }
}