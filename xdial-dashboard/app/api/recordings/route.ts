// app/api/recordings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import https from 'https'
import { URL } from 'url'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Simple in-memory cache for recordings data
interface CacheEntry {
  data: any[]
  timestamp: number
  clientId: string
  date: string
}

const recordingsCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

export async function GET(request: NextRequest) {
  console.log('🔥🔥🔥 RECORDINGS API CALLED - DATABASE VERSION 🔥🔥🔥')
  
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const date = searchParams.get('date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const sortField = searchParams.get('sortField') || 'timestamp'
    const sortDirection = searchParams.get('sortDirection') || 'desc'

    console.log(`📋 Request Parameters:`)
    console.log(`   - Client ID: ${clientId}`)
    console.log(`   - Date: ${date}`)
    console.log(`   - Page: ${page}`)
    console.log(`   - Limit: ${limit}`)
    console.log(`   - Search: ${search}`)
    console.log(`   - Sort Field: ${sortField}`)
    console.log(`   - Sort Direction: ${sortDirection}`)

    if (!clientId || !date) {
      console.log('❌ Missing required parameters')
      return NextResponse.json({ 
        error: !clientId ? 'Client ID required' : 'Date required',
        recordings: [],
        total: 0,
        page: 1,
        limit: limit,
        totalPages: 0
      }, { status: 400 })
    }

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 1000) {
      console.log('❌ Invalid pagination parameters')
      return NextResponse.json({ 
        error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-1000',
        recordings: [],
        total: 0,
        page: 1,
        limit: limit,
        totalPages: 0
      }, { status: 400 })
    }

    // Validate sorting parameters
    const validSortFields = ['timestamp', 'phone_number', 'duration', 'response_category', 'size']
    const validSortDirections = ['asc', 'desc']
    
    if (!validSortFields.includes(sortField) || !validSortDirections.includes(sortDirection)) {
      console.log('❌ Invalid sorting parameters')
      return NextResponse.json({ 
        error: `Invalid sorting parameters. sortField must be one of: ${validSortFields.join(', ')}, sortDirection must be asc or desc`,
        recordings: [],
        total: 0,
        page: 1,
        limit: limit,
        totalPages: 0
      }, { status: 400 })
    }

    // Fetch client details from database
    console.log('🔍 Fetching client details from database...')
    const clientResult = await pool.query(
      'SELECT client_id, client_name, extension, fetch_recording_url FROM clients WHERE client_id = $1',
      [parseInt(clientId)]
    )

    if (clientResult.rows.length === 0) {
      console.log('❌ Client not found in database')
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
    const { extension, fetch_recording_url, client_name } = client

    console.log(`✅ Client found: ${client_name}`)
    console.log(`   - Extension: ${extension}`)
    console.log(`   - Recording URL: ${fetch_recording_url}`)

    if (!extension || !fetch_recording_url) {
      console.log('❌ Missing extension or recording URL for client')
      return NextResponse.json({ 
        error: 'Client configuration incomplete - missing extension or recording URL',
        recordings: [],
        total: 0,
        page: page,
        limit: limit,
        totalPages: 0
      }, { status: 400 })
    }

    // Format date from YYYY-MM-DD to YYYYMMDD
    const formattedDate = date.replace(/-/g, '')
    
    // Create cache key
    const cacheKey = `${clientId}-${formattedDate}`
    
    // Check if we have cached data
    const cachedEntry = recordingsCache.get(cacheKey)
    const now = Date.now()
    const forceRefresh = searchParams.get('refresh') === 'true'
    
    let transformedRecordings: any[] = []
    
    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION && !forceRefresh) {
      console.log('📦 Using cached recordings data')
      transformedRecordings = cachedEntry.data
    } else {
      console.log('🌐 Fetching fresh recordings data from external API')
      
      // Remove expired cache entry
      if (cachedEntry) {
        recordingsCache.delete(cacheKey)
      }
      // Remove expired cache entry
      if (cachedEntry) {
        recordingsCache.delete(cacheKey)
      }
    
      // Construct the API URL using client's fetch_recording_url
      const apiUrl = `${fetch_recording_url}?extension=${extension}&date=${formattedDate}`
      
      console.log(`🌐 Dynamic API URL: ${apiUrl}`)
      console.log(`🚀 Making HTTPS request with SSL certificate bypass...`)

      // Use native Node.js HTTPS with SSL bypass (equivalent to curl -k)
      const urlObj = new URL(apiUrl)
      const responseData = await new Promise<string>((resolve, reject) => {
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
          // 🔓 This is the key: ignore SSL certificate errors (same as curl -k)
          rejectUnauthorized: false
        }

        console.log(`📞 Making request to: ${options.hostname}${options.path}`)
        
        const req = https.request(options, (res) => {
          console.log(`📡 Response received:`)
          console.log(`   - Status: ${res.statusCode}`)
          console.log(`   - Headers: ${JSON.stringify(res.headers)}`)
          
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          
          res.on('end', () => {
            console.log(`📦 Response completed - Length: ${data.length} bytes`)
            console.log(`📄 First 200 characters: ${data.substring(0, 200)}`)
            
            if (res.statusCode === 200) {
              resolve(data)
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
            }
          })
        })

        req.on('error', (error) => {
          console.error('🚨 HTTPS request error:', error)
          reject(error)
        })

        req.setTimeout(30000, () => {
          console.log('⏰ Request timeout after 30 seconds')
          req.destroy()
          reject(new Error('Request timeout'))
        })

        req.end()
      })

      // Parse JSON response
      console.log('🔍 Parsing JSON response...')
      let recordings = {}
      
      try {
        recordings = JSON.parse(responseData)
        console.log(`✅ Successfully parsed JSON - Found ${Object.keys(recordings).length} recordings`)
        
        // Log a sample recording for debugging
        if (Object.keys(recordings).length > 0) {
          const firstKey = Object.keys(recordings)[0]
          console.log(`📋 Sample recording (${firstKey}):`, recordings[firstKey])
        }
        
      } catch (parseError) {
        console.error('❌ JSON parsing failed:', parseError)
        console.log('🔍 Raw response analysis:')
        console.log(`   - Length: ${responseData.length}`)
        console.log(`   - Starts with: "${responseData.substring(0, 20)}"`)
        console.log(`   - Ends with: "${responseData.substring(responseData.length - 20)}"`)
        console.log(`   - Contains HTML: ${responseData.includes('<html>') || responseData.includes('<!DOCTYPE')? 'Yes' : 'No'}`)
        
        return NextResponse.json({ 
          error: 'Invalid JSON response from recording API',
          details: `Parse error: ${parseError.message}`,
          raw_preview: responseData.substring(0, 500),
          recordings: [],
          total: 0,
          page: page,
          limit: limit,
          totalPages: 0
        }, { status: 500 })
      }

      // Transform recordings to our format with proxy URLs
      console.log('🔄 Transforming recordings data...')
      transformedRecordings = Object.entries(recordings).map(([key, rec]: [string, any]) => {
        // Create proxy URL for the audio file
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
          audio_url: proxyUrl, // Use proxy URL instead of direct URL
          original_url: originalUrl, // Keep original URL for reference
          size: rec.size || '',
          filename: rec.name || ''
        }
      })

      // Cache the transformed data
      recordingsCache.set(cacheKey, {
        data: transformedRecordings,
        timestamp: now,
        clientId: clientId.toString(),
        date: formattedDate
      })
      
      console.log(`💾 Cached ${transformedRecordings.length} recordings for key: ${cacheKey}`)
    }

    // Apply search filter if provided
    let filteredRecordings = [...transformedRecordings]
    if (search) {
      console.log(`🔍 Applying search filter: "${search}"`)
      filteredRecordings = filteredRecordings.filter(rec => 
        rec.phone_number.includes(search) ||
        rec.response_category.toLowerCase().includes(search.toLowerCase()) ||
        rec.speech_text.toLowerCase().includes(search.toLowerCase()) ||
        rec.filename.toLowerCase().includes(search.toLowerCase())
      )
      console.log(`📊 ${filteredRecordings.length} recordings after search filter`)
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
          // Convert duration to seconds for proper sorting
          aValue = durationToSeconds(a.duration)
          bValue = durationToSeconds(b.duration)
          break
        case 'response_category':
          aValue = a.response_category
          bValue = b.response_category
          break
        case 'size':
          // Convert size to bytes for proper sorting
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

    console.log(`📊 Pagination applied:`)
    console.log(`   - Total records: ${totalRecordings}`)
    console.log(`   - Page ${page} of ${totalPages}`)
    console.log(`   - Showing records ${startIndex + 1}-${Math.min(endIndex, totalRecordings)}`)
    console.log(`   - Records in this page: ${paginatedRecordings.length}`)

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
      source: 'external_api',
      api_url: fetch_recording_url, // Return the base API URL
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
      page: page || 1,
      limit: limit || 50,
      totalPages: 0
    }, { status: 500 })
  }
}

// Helper functions for sorting
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
      console.warn(`⚠️ Missing date or time: date="${date}", time="${time}"`)
      return `${date || ''} ${time || ''}`
    }
    
    // Convert YYYYMMDD and HHMMSS to YYYY-MM-DD HH:MM:SS
    const year = date.substring(0, 4)
    const month = date.substring(4, 6)
    const day = date.substring(6, 8)
    const hour = time.substring(0, 2)
    const minute = time.substring(2, 4)
    const second = time.substring(4, 6)
    
    const formatted = `${year}-${month}-${day} ${hour}:${minute}:${second}`
    console.log(`📅 Formatted timestamp: ${date}/${time} -> ${formatted}`)
    
    return formatted
  } catch (error) {
    console.error('❌ Error formatting timestamp:', error, { date, time })
    return `${date} ${time}`
  }
}