// app/api/recordings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import https from 'https'
import { URL } from 'url'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  console.log('🔥🔥🔥 RECORDINGS API CALLED - NEW VERSION 🔥🔥🔥')
  
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const date = searchParams.get('date')

    console.log(`📋 Request Parameters:`)
    console.log(`   - Client ID: ${clientId}`)
    console.log(`   - Date: ${date}`)

    if (!clientId || !date) {
      console.log('❌ Missing required parameters')
      return NextResponse.json({ 
        error: !clientId ? 'Client ID required' : 'Date required',
        recordings: [] 
      }, { status: 400 })
    }

    console.log('🏢 Fetching client info from database...')
    
    const clientResult = await pool.query(
      'SELECT fetch_recording_url, extension, client_name FROM clients WHERE client_id = $1',
      [clientId]
    )

    console.log(`📊 Database query completed: ${clientResult.rows.length} rows found`)

    if (clientResult.rows.length === 0) {
      console.log('❌ Client not found in database')
      return NextResponse.json({ error: 'Client not found', recordings: [] }, { status: 404 })
    }

    const client = clientResult.rows[0]
    console.log(`✅ Client found:`)
    console.log(`   - Name: ${client.client_name}`)
    console.log(`   - Recording URL: ${client.fetch_recording_url}`)
    console.log(`   - Extension: ${client.extension}`)

    if (!client.fetch_recording_url || !client.extension) {
      console.log('❌ Client missing recording URL or extension configuration')
      return NextResponse.json({ 
        error: 'Client missing recording URL or extension configuration',
        recordings: [] 
      }, { status: 400 })
    }

    // Format date from YYYY-MM-DD to YYYYMMDD
    const formattedDate = date.replace(/-/g, '')
    const apiUrl = `${client.fetch_recording_url}?date=${formattedDate}&extension=${client.extension}`
    
    console.log(`🌐 External API URL: ${apiUrl}`)
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
        // 🔑 This is the key: ignore SSL certificate errors (same as curl -k)
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
        recordings: []
      }, { status: 500 })
    }

    // Transform recordings to our format
    console.log('🔄 Transforming recordings data...')
    const transformedRecordings = Object.entries(recordings).map(([key, rec]: [string, any]) => {
      const transformed = {
        id: key,
        unique_id: `${rec.date}-${rec.time}_${rec.number}`,
        timestamp: formatTimestamp(rec.date, rec.time),
        duration: rec.duration || '00:00:00',
        phone_number: rec.number || 'Unknown',
        response_category: 'EXTERNAL_RECORDING',
        speech_text: '',
        audio_url: rec.url || '',
        size: rec.size || '',
        filename: rec.name || ''
      }
      
      console.log(`   Transformed recording ${key}: ${rec.number} at ${rec.date} ${rec.time}`)
      return transformed
    })

    console.log(`🎯 Returning ${transformedRecordings.length} transformed recordings`)

    return NextResponse.json({ 
      recordings: transformedRecordings,
      total: transformedRecordings.length,
      extension: extension,
      date: date,
      source: 'external_api',
      api_url: apiUrl.split('?')[0], // Don't expose parameters
      success: true
    })

  } catch (error) {
    console.error('💥 FATAL ERROR in recordings API:', error)
    console.error('Error stack:', error.stack)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message,
      recordings: []
    }, { status: 500 })
  }
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