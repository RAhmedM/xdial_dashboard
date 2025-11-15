// app/api/recordings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import https from 'https'
import { URL } from 'url'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

interface CacheEntry {
  data: any[]
  timestamp: number
  clientId: string
  date: string
}

const recordingsCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  console.log('🔥🔥🔥 RECORDINGS API CALLED - MULTI-URL VERSION 🔥🔥🔥')
  
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const date = searchParams.get('date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const sortField = searchParams.get('sortField') || 'timestamp'
    const sortDirection = searchParams.get('sortDirection') || 'desc'
    const forceRefresh = searchParams.get('refresh') === 'true'

    console.log(`📋 Request Parameters:`)
    console.log(`   - Client ID: ${clientId}`)
    console.log(`   - Date: ${date}`)
    console.log(`   - Page: ${page}, Limit: ${limit}`)
    console.log(`   - Search: ${search}`)
    console.log(`   - Sort: ${sortField} ${sortDirection}`)

    if (!clientId || !date) {
      return NextResponse.json({ 
        error: !clientId ? 'Client ID required' : 'Date required',
        recordings: [],
        total: 0,
        page: 1,
        limit: limit,
        totalPages: 0
      }, { status: 400 })
    }

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 1000) {
      return NextResponse.json({ 
        error: 'Invalid pagination parameters',
        recordings: [],
        total: 0,
        page: 1,
        limit: limit,
        totalPages: 0
      }, { status: 400 })
    }

    // Validate sorting
    const validSortFields = ['timestamp', 'phone_number', 'duration', 'response_category', 'size']
    const validSortDirections = ['asc', 'desc']
    
    if (!validSortFields.includes(sortField) || !validSortDirections.includes(sortDirection)) {
      return NextResponse.json({ 
        error: 'Invalid sorting parameters',
        recordings: [],
        total: 0,
        page: 1,
        limit: limit,
        totalPages: 0
      }, { status: 400 })
    }

    // Fetch client details and recording URLs
    console.log('🔍 Fetching client details and recording URLs...')
    const clientResult = await pool.query(`
      SELECT 
        c.client_id, 
        c.client_name, 
        c.extension,
        COALESCE(
          json_agg(
            json_build_object('id', cru.id, 'recording_url', cru.recording_url)
            ORDER BY cru.id
          ) FILTER (WHERE cru.id IS NOT NULL),
          '[]'
        ) as recording_urls
      FROM clients c
      LEFT JOIN client_recording_urls cru ON c.client_id = cru.client_id
      WHERE c.client_id = $1
      GROUP BY c.client_id
    `, [parseInt(clientId)])

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Client not found',
        recordings: [],
        total: 0,
        page: page,
        limit: limit,
        totalPages: 0
      }, { status: 404 })
    }

    const client = clientResult.rows[0]
    const { extension, client_name, recording_urls } = client

    console.log(`✅ Client found: ${client_name}`)
    console.log(`   - Extension: ${extension}`)
    console.log(`   - Number of recording URLs: ${recording_urls.length}`)

    if (!extension || !recording_urls || recording_urls.length === 0) {
      return NextResponse.json({ 
        error: 'Client configuration incomplete - missing extension or recording URLs',
        recordings: [],
        total: 0,
        page: page,
        limit: limit,
        totalPages: 0
      }, { status: 400 })
    }

    // Format date
    const formattedDate = date.replace(/-/g, '')
    const cacheKey = `${clientId}-${formattedDate}`
    
    // Check cache
    const cachedEntry = recordingsCache.get(cacheKey)
    const now = Date.now()
    
    let transformedRecordings: any[] = []
    
    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION && !forceRefresh) {
      console.log('📦 Using cached recordings data')
      transformedRecordings = cachedEntry.data
    } else {
      console.log('🌐 Fetching fresh recordings from all URLs')
      
      if (cachedEntry) {
        recordingsCache.delete(cacheKey)
      }

      // Fetch recordings from all URLs in parallel
      const allRecordings = new Map<string, any>() // Use Map to avoid duplicates
      
      for (const urlObj of recording_urls) {
        const fetchUrl = urlObj.recording_url
        console.log(`📡 Fetching from: ${fetchUrl}`)
        
        try {
          const apiUrl = `${fetchUrl}?extension=${extension}&date=${formattedDate}`
          console.log(`   Full URL: ${apiUrl}`)
          
          const responseData = await fetchFromUrl(apiUrl)
          const recordings = JSON.parse(responseData)
          
          console.log(`   ✅ Found ${Object.keys(recordings).length} recordings from this URL`)
          
          // Merge recordings (use unique_id to avoid duplicates)
          Object.entries(recordings).forEach(([key, rec]: [string, any]) => {
            const uniqueId = `${rec.date}-${rec.time}_${rec.number}`
            if (!allRecordings.has(uniqueId)) {
              allRecordings.set(uniqueId, { key, rec, sourceUrl: fetchUrl })
            }
          })
        } catch (error) {
          console.error(`   ❌ Error fetching from ${fetchUrl}:`, error.message)
          // Continue with other URLs even if one fails
        }
      }

      console.log(`📊 Total unique recordings across all URLs: ${allRecordings.size}`)

      // Transform all recordings
      transformedRecordings = Array.from(allRecordings.values()).map(({ key, rec, sourceUrl }) => {
        const originalUrl = rec.url || ''
        const proxyUrl = originalUrl ? `/api/audio?url=${encodeURIComponent(originalUrl)}&client_id=${clientId}` : ''
        
        return {
          id: key,
          unique_id: `${rec.date}-${rec.time}_${rec.number}`,
          timestamp: formatTimestamp(rec.date, rec.time),
          duration: rec.duration || '00:00:00',
          phone_number: rec.number || 'Unknown',
          response_category: 'EXTERNAL_RECORDING',
          speech_text: '',
          audio_url: proxyUrl,
          original_url: originalUrl,
          size: rec.size || '',
          filename: rec.name || '',
          source_url: sourceUrl // Track which URL this came from
        }
      })

      // Cache the data
      recordingsCache.set(cacheKey, {
        data: transformedRecordings,
        timestamp: now,
        clientId: clientId.toString(),
        date: formattedDate
      })
      
      console.log(`💾 Cached ${transformedRecordings.length} recordings`)
    }

    // Apply search filter
    let filteredRecordings = [...transformedRecordings]
    if (search) {
      console.log(`🔍 Applying search filter: "${search}"`)
      filteredRecordings = filteredRecordings.filter(rec => 
        rec.phone_number.includes(search) ||
        rec.response_category.toLowerCase().includes(search.toLowerCase()) ||
        rec.speech_text.toLowerCase().includes(search.toLowerCase()) ||
        rec.filename.toLowerCase().includes(search.toLowerCase())
      )
      console.log(`📊 ${filteredRecordings.length} recordings after search`)
    }

    // Apply sorting
    console.log(`🔄 Applying sort: ${sortField} ${sortDirection}`)
    filteredRecordings.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime()
          bValue = new Date(b.timestamp).getTime()
          break
        case 'phone_number':
          aValue = a.phone_number
          bValue = b.phone_number
          break
        case 'duration':
          aValue = durationToSeconds(a.duration)
          bValue = durationToSeconds(b.duration)
          break
        case 'response_category':
          aValue = a.response_category
          bValue = b.response_category
          break
        case 'size':
          aValue = sizeToBytes(a.size || '')
          bValue = sizeToBytes(b.size || '')
          break
        default:
          aValue = new Date(a.timestamp).getTime()
          bValue = new Date(b.timestamp).getTime()
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    const totalRecordings = filteredRecordings.length
    const totalPages = Math.ceil(totalRecordings / limit)
    
    // Apply pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedRecordings = filteredRecordings.slice(startIndex, endIndex)

    console.log(`📊 Final results:`)
    console.log(`   - Total: ${totalRecordings}`)
    console.log(`   - Page ${page} of ${totalPages}`)
    console.log(`   - Showing ${paginatedRecordings.length} records`)

    return NextResponse.json({ 
      recordings: paginatedRecordings,
      total: totalRecordings,
      page: page,
      limit: limit,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      client_id: clientId,
      client_name: client_name,
      extension: extension,
      date: date,
      search: search || undefined,
      sortField: sortField,
      sortDirection: sortDirection,
      cached: cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION && !forceRefresh,
      source: 'external_api_multi_url',
      source_urls_count: recording_urls.length,
      success: true
    })

  } catch (error) {
    console.error('💥 FATAL ERROR in recordings API:', error)
    console.error('Error stack:', error.stack)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message,
      recordings: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0
    }, { status: 500 })
  }
}

// Helper function to fetch from URL with SSL bypass
async function fetchFromUrl(apiUrl: string): Promise<string> {
  const urlObj = new URL(apiUrl)
  
  return new Promise<string>((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'XDialNetworks-Dashboard/1.0',
        'Cache-Control': 'no-cache'
      },
      rejectUnauthorized: false // Bypass SSL verification
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.end()
  })
}

// Helper functions
function durationToSeconds(duration: string): number {
  if (!duration) return 0
  if (duration.includes(':')) {
    const parts = duration.split(':').map(p => parseInt(p) || 0)
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
  }
  return parseInt(duration) || 0
}

function sizeToBytes(size: string): number {
  if (!size) return 0
  const match = size.match(/^([\d.]+)\s*([KMGT]?B)$/i)
  if (match) {
    const value = parseFloat(match[1])
    const unit = match[2].toUpperCase()
    switch (unit) {
      case 'KB': return value * 1024
      case 'MB': return value * 1024 * 1024
      case 'GB': return value * 1024 * 1024 * 1024
      case 'TB': return value * 1024 * 1024 * 1024 * 1024
      default: return value
    }
  }
  return 0
}

function formatTimestamp(date: string, time: string): string {
  try {
    if (!date || !time) {
      return `${date || ''} ${time || ''}`
    }
    
    const year = date.substring(0, 4)
    const month = date.substring(4, 6)
    const day = date.substring(6, 8)
    const hour = time.substring(0, 2)
    const minute = time.substring(2, 4)
    const second = time.substring(4, 6)
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  } catch (error) {
    console.error('❌ Error formatting timestamp:', error, { date, time })
    return `${date} ${time}`
  }
}