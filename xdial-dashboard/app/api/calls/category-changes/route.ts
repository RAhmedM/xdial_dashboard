// app/api/calls/category-changes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Normalize category names to match frontend expectations
function normalizeCategory(category: string): string {
  if (!category) return 'unknown'
  
  const normalized = category.toLowerCase()
    .replace(/\s+/g, '-')  // "Not Interested" → "not-interested"
    .replace(/_/g, '-')     // "User_Silent" → "user-silent"
  
  // Map specific cases
  const categoryMap: { [key: string]: string } = {
    'interested': 'interested',
    'not-interested': 'not-interested',
    'answering-machine': 'answering-machine',
    'do-not-call': 'do-not-call',
    'do-not-qualify': 'do-not-qualify',
    'unknown': 'unknown',
    'honeypot': 'Honeypot',
    'user-silent': 'User_Silent',
    'inaudible': 'INAUDIBLE',
    'neutral': 'neutral',
    'na': 'NA',
    'user-hungup': 'USER-HUNGUP',
  }
  
  return categoryMap[normalized] || normalized
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const interval = parseInt(searchParams.get('interval') || '5', 10)
    const clientId = searchParams.get('client_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const search = searchParams.get('search')
    const listIdSearch = searchParams.get('list_id_search')

    const now = new Date()
    
    // FIXED: Compare two equal time windows
    // Current period: now - interval minutes to now
    const currentPeriodStart = new Date(now.getTime() - interval * 60000)
    
    // Previous period: (now - 2*interval) to (now - interval)
    const previousPeriodStart = new Date(now.getTime() - 2 * interval * 60000)
    const previousPeriodEnd = currentPeriodStart

    console.log('📊 Time Periods:', {
      interval: `${interval} minutes`,
      current: { start: currentPeriodStart.toISOString(), end: now.toISOString() },
      previous: { start: previousPeriodStart.toISOString(), end: previousPeriodEnd.toISOString() }
    })

    // Build base conditions for filtering (applies to both periods)
    const buildConditions = (paramOffset: number = 0) => {
      const conditions: string[] = []
      const params: any[] = []

      if (clientId) {
        conditions.push(`client_id = $${params.length + paramOffset + 1}`)
        params.push(clientId)
      }

      if (startDate) {
        conditions.push(`timestamp >= $${params.length + paramOffset + 1}`)
        params.push(startDate)
      }

      if (endDate) {
        conditions.push(`timestamp <= $${params.length + paramOffset + 1}`)
        params.push(endDate)
      }

      if (search) {
        conditions.push(`(phone_number ILIKE $${params.length + paramOffset + 1} OR response_category ILIKE $${params.length + paramOffset + 2})`)
        params.push(`%${search}%`, `%${search}%`)
      }

      if (listIdSearch) {
        conditions.push(`list_id::text ILIKE $${params.length + paramOffset + 1}`)
        params.push(`%${listIdSearch}%`)
      }

      return { conditions, params }
    }

    const baseConditions = buildConditions()

    // Query for CURRENT period
    const currentParams = [...baseConditions.params]
    const currentConditions = [...baseConditions.conditions]
    currentConditions.push(`timestamp >= $${currentParams.length + 1}`)
    currentConditions.push(`timestamp <= $${currentParams.length + 2}`)
    currentParams.push(currentPeriodStart.toISOString(), now.toISOString())

    const currentQuery = `
      SELECT 
        response_category,
        COUNT(*) as count,
        COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0) AS percentage
      FROM calls
      WHERE ${currentConditions.join(' AND ')}
      GROUP BY response_category
    `

    // Query for PREVIOUS period
    const previousParams = [...baseConditions.params]
    const previousConditions = [...baseConditions.conditions]
    previousConditions.push(`timestamp >= $${previousParams.length + 1}`)
    previousConditions.push(`timestamp <= $${previousParams.length + 2}`)
    previousParams.push(previousPeriodStart.toISOString(), previousPeriodEnd.toISOString())

    const previousQuery = `
      SELECT 
        response_category,
        COUNT(*) as count,
        COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0) AS percentage
      FROM calls
      WHERE ${previousConditions.join(' AND ')}
      GROUP BY response_category
    `

    console.log('📈 Current Query:', currentQuery)
    console.log('📈 Current Params:', currentParams)
    console.log('📉 Previous Query:', previousQuery)
    console.log('📉 Previous Params:', previousParams)

    // Execute both queries
    const [currentResult, previousResult] = await Promise.all([
      pool.query(currentQuery, currentParams),
      pool.query(previousQuery, previousParams)
    ])

    console.log('📊 Current Results:', currentResult.rows)
    console.log('📊 Previous Results:', previousResult.rows)

    // Build maps with normalized category names
    const currentPercentages: { [key: string]: { percentage: number; count: number } } = {}
    currentResult.rows.forEach(row => {
      const normalizedCategory = normalizeCategory(row.response_category)
      currentPercentages[normalizedCategory] = {
        percentage: parseFloat(row.percentage || 0),
        count: parseInt(row.count || 0)
      }
    })

    const previousPercentages: { [key: string]: { percentage: number; count: number } } = {}
    previousResult.rows.forEach(row => {
      const normalizedCategory = normalizeCategory(row.response_category)
      previousPercentages[normalizedCategory] = {
        percentage: parseFloat(row.percentage || 0),
        count: parseInt(row.count || 0)
      }
    })

    // Calculate total calls for context
    const currentTotalCalls = Object.values(currentPercentages).reduce((sum, v) => sum + v.count, 0)
    const previousTotalCalls = Object.values(previousPercentages).reduce((sum, v) => sum + v.count, 0)

    console.log('📊 Total Calls:', { current: currentTotalCalls, previous: previousTotalCalls })

    // Calculate percentage point changes
    const percentageChanges: { [key: string]: string | number } = {}
    
    // Get all unique categories from both periods
    const allCategories = new Set([
      ...Object.keys(currentPercentages),
      ...Object.keys(previousPercentages)
    ])

    allCategories.forEach(category => {
      const current = currentPercentages[category]?.percentage || 0
      const previous = previousPercentages[category]?.percentage || 0
      
      // Calculate percentage POINT change (not relative change)
      // e.g., 25% - 20% = +5 percentage points
      const change = current - previous
      
      // Only include categories with meaningful changes (> 0.1% change)
      // This filters out noise from rounding
      if (Math.abs(change) < 0.1) {
        percentageChanges[category] = 0
      } else {
        // Format with + for positive values
        percentageChanges[category] = change > 0 
          ? `+${change.toFixed(1)}` 
          : change.toFixed(1)
      }
    })

    console.log('✅ Current Percentages:', currentPercentages)
    console.log('✅ Previous Percentages:', previousPercentages)
    console.log('✅ Percentage Changes:', percentageChanges)

    // Include metadata for debugging
    const response = {
      changes: percentageChanges,
      metadata: {
        interval: interval,
        currentPeriod: {
          start: currentPeriodStart.toISOString(),
          end: now.toISOString(),
          totalCalls: currentTotalCalls
        },
        previousPeriod: {
          start: previousPeriodStart.toISOString(),
          end: previousPeriodEnd.toISOString(),
          totalCalls: previousTotalCalls
        }
      }
    }

    // Return just the changes for production, include metadata in development
    return NextResponse.json(
      process.env.NODE_ENV === 'development' ? response : percentageChanges
    )
  } catch (error: any) {
    console.error('❌ Error fetching category changes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category changes', details: error.message },
      { status: 500 }
    )
  }
}