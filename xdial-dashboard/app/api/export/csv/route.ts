import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Helper function to escape CSV values
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }
  
  const stringValue = String(value)
  
  // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  
  return stringValue
}

// Helper function to format timestamp for CSV
function formatTimestamp(timestamp: string): string {
  if (!timestamp) return ''
  
  try {
    const date = new Date(timestamp)
    return date.toISOString().replace('T', ' ').split('.')[0] // Format: YYYY-MM-DD HH:MM:SS
  } catch (error) {
    return timestamp
  }
}

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

    // Add response category filters
    if (responseCategories.length > 0) {
      const categoryPlaceholders = responseCategories.map(() => {
        paramCount++
        return `$${paramCount}`
      }).join(',')
      conditions.push(`c.response_category IN (${categoryPlaceholders})`)
      params.push(...responseCategories)
    }

    const whereClause = conditions.length > 0 ? 
      `WHERE ${conditions.join(' AND ')}` : ''

    // Build the main query to get all call data
    const dataQuery = `
      SELECT 
        c.call_id,
        c.client_id,
        COALESCE(cl.client_name, 'Unknown Client') as client_name,
        c.phone_number,
        c.list_id,
        c.response_category,
        c.timestamp,
        c.recording_url,
        c.recording_length
      FROM calls c 
      LEFT JOIN clients cl ON c.client_id = cl.client_id 
      ${whereClause}
      ORDER BY c.timestamp DESC
    `

    console.log('CSV Export Query:', dataQuery)
    console.log('CSV Export Params:', params)

    const result = await pool.query(dataQuery, params)

    // Generate CSV content
    const headers = [
      'Call ID',
      'Client ID',
      'Client Name',
      'Phone Number',
      'List ID',
      'Response Category',
      'Timestamp',
      'Recording URL',
      'Recording Length (seconds)'
    ]

    // Start building CSV content
    let csvContent = headers.map(header => escapeCsvValue(header)).join(',') + '\n'

    // Add data rows
    for (const row of result.rows) {
      const csvRow = [
        escapeCsvValue(row.call_id),
        escapeCsvValue(row.client_id),
        escapeCsvValue(row.client_name),
        escapeCsvValue(row.phone_number),
        escapeCsvValue(row.list_id),
        escapeCsvValue(row.response_category),
        escapeCsvValue(formatTimestamp(row.timestamp)),
        escapeCsvValue(row.recording_url),
        escapeCsvValue(row.recording_length)
      ].join(',')
      
      csvContent += csvRow + '\n'
    }

    console.log(`Generated CSV with ${result.rows.length} rows`)

    // Return CSV response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="call-data-export-${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error generating CSV export:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    })
    
    return NextResponse.json({ 
      error: 'Failed to generate CSV export',
      details: error.message 
    }, { status: 500 })
  }
}