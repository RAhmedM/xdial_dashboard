// app/api/calls/category-changes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const interval = parseInt(searchParams.get('interval') || '5', 10)
    const clientId = searchParams.get('client_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const search = searchParams.get('search')
    const listIdSearch = searchParams.get('list_id_search')

    // Calculate the interval timestamp (e.g., 5 or 10 minutes ago)
    const intervalDate = new Date()
    intervalDate.setMinutes(intervalDate.getMinutes() - interval)
    const intervalTimestamp = intervalDate.toISOString()

    // Build conditions for filtering
    const conditions: string[] = []
    const params: any[] = []
    const recentConditions: string[] = []
    const recentParams: any[] = []

    // Add client filter if provided
    if (clientId) {
      conditions.push(`client_id = $${params.length + 1}`)
      params.push(clientId)
      recentConditions.push(`client_id = $${recentParams.length + 1}`)
      recentParams.push(clientId)
    }

    // Add date filters if provided
    if (startDate) {
      conditions.push(`timestamp >= $${params.length + 1}`)
      params.push(startDate)
      recentConditions.push(`timestamp >= $${recentParams.length + 1}`)
      recentParams.push(startDate)
    }

    if (endDate) {
      conditions.push(`timestamp <= $${params.length + 1}`)
      params.push(endDate)
      recentConditions.push(`timestamp <= $${recentParams.length + 1}`)
      recentParams.push(endDate)
    }

    // Add search filters
    if (search) {
      conditions.push(`(phone_number ILIKE $${params.length + 1} OR response_category ILIKE $${params.length + 2})`)
      params.push(`%${search}%`, `%${search}%`)
      recentConditions.push(`(phone_number ILIKE $${recentParams.length + 1} OR response_category ILIKE $${recentParams.length + 2})`)
      recentParams.push(`%${search}%`, `%${search}%`)
    }

    if (listIdSearch) {
      conditions.push(`list_id::text ILIKE $${params.length + 1}`)
      params.push(`%${listIdSearch}%`)
      recentConditions.push(`list_id::text ILIKE $${recentParams.length + 1}`)
      recentParams.push(`%${listIdSearch}%`)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    
    // Add timestamp filter for recent data
    recentConditions.push(`timestamp >= $${recentParams.length + 1}`)
    recentParams.push(intervalTimestamp)
    const recentWhereClause = `WHERE ${recentConditions.join(' AND ')}`

    // Query to get overall percentages (baseline)
    const overallQuery = `
      SELECT 
        response_category,
        COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0) AS percentage
      FROM calls
      ${whereClause}
      GROUP BY response_category
    `

    // Query to get recent percentages (last X minutes)
    const recentQuery = `
      SELECT 
        response_category,
        COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0) AS percentage
      FROM calls
      ${recentWhereClause}
      GROUP BY response_category
    `

    console.log('Overall Category Query:', overallQuery)
    console.log('Overall Params:', params)
    console.log('Recent Category Query:', recentQuery)
    console.log('Recent Params:', recentParams)

    // Execute both queries
    const [overallResult, recentResult] = await Promise.all([
      pool.query(overallQuery, params),
      pool.query(recentQuery, recentParams)
    ])

    // Build maps for quick lookup
    const overallPercentages: { [key: string]: number } = {}
    overallResult.rows.forEach(row => {
      overallPercentages[row.response_category || 'Unknown'] = parseFloat(row.percentage || 0)
    })

    const recentPercentages: { [key: string]: number } = {}
    recentResult.rows.forEach(row => {
      recentPercentages[row.response_category || 'Unknown'] = parseFloat(row.percentage || 0)
    })

    // Calculate percentage change for each category
    const percentageChanges: { [key: string]: string } = {}
    
    // Get all unique categories from both queries
    const allCategories = new Set([
      ...Object.keys(overallPercentages),
      ...Object.keys(recentPercentages)
    ])

    allCategories.forEach(category => {
      const overall = overallPercentages[category] || 0
      const recent = recentPercentages[category] || 0
      
      // Calculate percentage point change (not percentage of percentage)
      // e.g., if overall is 20% and recent is 25%, change is +5 (not +25%)
      const change = recent - overall
      
      // Format with % sign and + for positive values
      const formattedChange = change > 0 
        ? `+${change.toFixed(2)}%` 
        : `${change.toFixed(2)}%`
      
      percentageChanges[category] = formattedChange
    })

    console.log('Overall Percentages:', overallPercentages)
    console.log('Recent Percentages:', recentPercentages)
    console.log('Percentage Changes:', percentageChanges)

    return NextResponse.json(percentageChanges)
  } catch (error: any) {
    console.error('Error fetching category percentage changes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category percentage changes', details: error.message },
      { status: 500 }
    )
  }
}