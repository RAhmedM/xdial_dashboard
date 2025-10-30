import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { FILTER_TO_DB_MAPPING } from '@/lib/response-categories'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Extract filters
    const clientId = searchParams.get('client_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const listIds = searchParams.getAll('list_ids')
    const responseCategories = searchParams.getAll('response_categories')
    const exportType = searchParams.get('export_type') || 'all'

    // Build WHERE conditions
    const conditions = []
    const params: any[] = []
    let paramCount = 0

    // Add client filter if provided
    if (clientId) {
      paramCount++
      conditions.push(`c.client_id = $${paramCount}`)
      params.push(parseInt(clientId))
    }

    // Add date filters
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

    // Add list ID filters
    if (listIds.length > 0) {
      const listIdPlaceholders = listIds.map(() => {
        paramCount++
        return `$${paramCount}`
      }).join(',')
      conditions.push(`c.list_id IN (${listIdPlaceholders})`)
      params.push(...listIds)
    }

    // Add response category filters - convert frontend filter values to database values
    if (responseCategories.length > 0) {
      // Convert filter categories to database values
      const dbCategories: string[] = []
      responseCategories.forEach(filterCategory => {
        const dbValues = FILTER_TO_DB_MAPPING[filterCategory as keyof typeof FILTER_TO_DB_MAPPING]
        if (dbValues) {
          dbCategories.push(...dbValues)
        } else {
          console.warn(`Unknown filter category: ${filterCategory}`)
        }
      })
      
      if (dbCategories.length > 0) {
        const categoryPlaceholders = dbCategories.map(() => {
          paramCount++
          return `$${paramCount}`
        }).join(',')
        conditions.push(`c.response_category IN (${categoryPlaceholders})`)
        params.push(...dbCategories)
      }
    }

    const whereClause = conditions.length > 0 ? 
      `WHERE ${conditions.join(' AND ')}` : ''

    // Get count of records that would be exported
    const countQuery = `
      SELECT COUNT(*) as total
      FROM calls c 
      LEFT JOIN clients cl ON c.client_id = cl.client_id 
      ${whereClause}
    `

    console.log('Export Preview Query:', countQuery)
    console.log('Export Preview Params:', params)

    const result = await pool.query(countQuery, params)
    const count = parseInt(result.rows[0].total)

    // Calculate estimated file size (rough estimate)
    // Average CSV row size: ~150 bytes (accounting for all columns)
    // Add header size: ~100 bytes
    const estimatedBytes = (count * 150) + 100
    let estimatedSize = ''

    if (estimatedBytes < 1024) {
      estimatedSize = `${estimatedBytes} B`
    } else if (estimatedBytes < 1024 * 1024) {
      estimatedSize = `${(estimatedBytes / 1024).toFixed(1)} KB`
    } else if (estimatedBytes < 1024 * 1024 * 1024) {
      estimatedSize = `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`
    } else {
      estimatedSize = `${(estimatedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }

    return NextResponse.json({
      count,
      estimatedSize,
      exportType,
      filters: {
        clientId,
        startDate,
        endDate,
        listIds,
        responseCategories
      }
    })
  } catch (error) {
    console.error('Error getting export preview:', error)
    return NextResponse.json({ 
      error: 'Failed to get export preview',
      details: error.message 
    }, { status: 500 })
  }
}