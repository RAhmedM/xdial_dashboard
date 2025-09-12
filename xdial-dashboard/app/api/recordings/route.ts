// app/api/recordings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import https from 'https'
import { URL } from 'url'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  console.log('🔥 RECORDINGS API ROUTE CALLED 🔥')
  
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const date = searchParams.get('date')

    console.log(`📋 Parameters: clientId=${clientId}, date=${date}`)

    if (!clientId || !date) {
      console.log('❌ Missing required parameters')
      return NextResponse.json({ 
        error: !clientId ? 'Client ID required' : 'Date required',
        recordings: [] 
      }, { status: 400 })
    }

    console.log('📞 Fetching client from database...')
    
    const clientResult = await pool.query(
      'SELECT fetch_recording_url, extension, client_name FROM clients WHERE client_id = $1',
      [clientId]
    )

    console.log(`📊 Database result: ${clientResult.rows.length} rows`)

    if (clientResult.rows.length === 0) {
      console.log('❌ Client not found')
      return NextResponse.json({ error: 'Client not found', recordings: [] }, { status: 404 })
    }

    const client = clientResult.rows[0]
    console.log(`🏢 Client: ${client.client_name}`)
    console.log(`🔗 URL: ${client.fetch_recording_url}`)
    console.log(`📞 Extension: ${client.extension}`)

    if (!client.fetch_recording_url || !client.extension) {
      console.log('❌ Missing client configuration')
      return NextResponse.json({ 
        error: 'Client missing recording URL or extension',
        recordings: [] 
      }, { status: 400 })
    }

    const formattedDate = date.replace(/-/g, '')
    const recordingUrl = `${client.fetch_recording_url}?date=${formattedDate}&extension=${client.extension}`
    
    console.log(`🌐 Fetching: ${recordingUrl}`)

    // Use native Node.js HTTPS to handle SSL certificate issues
    const urlObj = new URL(recordingUrl)
    const responseData = await new Promise<string>((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'XDialNetworks-Dashboard/1.0'
        },
        // This is the key: ignore SSL certificate errors
        rejectUnauthorized: false
      }

      console.log('🚀 Making HTTPS request with SSL bypass...')
      
      const req = https.request(options, (res) => {
        console.log(`📡 Response status: ${res.statusCode}`)
        
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          console.log(`📄 Response length: ${data.length} chars`)
          if (res.statusCode === 200) {
            resolve(data)
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          }
        })
      })

      req.on('error', (error) => {
        console.error('🚨 HTTPS Request error:', error)
        reject(error)
      })

      // Set timeout
      req.setTimeout(30000, () => {
        console.log('⏰ Request timeout')
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.end()
    })

    console.log(`📄 First 100 chars: ${responseData.substring(0, 100)}`)

    let recordings = {}
    try {
      recordings = JSON.parse(responseData)
      console.log(`✅ Parsed ${Object.keys(recordings).length} recordings`)
    } catch (e) {
      console.log(`❌ JSON parse error: ${e.message}`)
      console.log(`Raw data: ${responseData.substring(0, 200)}`)
      return NextResponse.json({ 
        error: 'Invalid JSON response',
        recordings: [] 
      }, { status: 500 })
    }

    // Transform recordings
    const transformedRecordings = Object.entries(recordings).map(([key, rec]: [string, any]) => ({
      id: key,
      unique_id: `${rec.date}-${rec.time}_${rec.number}`,
      timestamp: formatTimestamp(rec.date, rec.time),
      duration: rec.duration || '00:00:00',
      phone_number: rec.number || 'Unknown',
      response_category: 'UNKNOWN',
      speech_text: '',
      audio_url: rec.url || '',
      size: rec.size || '',
      filename: rec.name || ''
    }))

    console.log(`🎯 Returning ${transformedRecordings.length} recordings`)

    return NextResponse.json({ 
      recordings: transformedRecordings,
      total: transformedRecordings.length,
      client_name: client.client_name,
      date: date,
      source: 'external_api'
    })

  } catch (error) {
    console.error('💥 FATAL ERROR:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message,
      recordings: []
    }, { status: 500 })
  }
}

function formatTimestamp(date: string, time: string): string {
  try {
    if (!date || !time) return `${date || ''} ${time || ''}`
    
    const year = date.substring(0, 4)
    const month = date.substring(4, 6)
    const day = date.substring(6, 8)
    const hour = time.substring(0, 2)
    const minute = time.substring(2, 4)
    const second = time.substring(4, 6)
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  } catch (error) {
    return `${date} ${time}`
  }
}