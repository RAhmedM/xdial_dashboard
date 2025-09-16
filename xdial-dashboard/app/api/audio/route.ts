// app/api/audio/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import https from 'https'
import { URL } from 'url'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  console.log('🎵 Audio proxy API called')
  
  try {
    const { searchParams } = new URL(request.url)
    const audioUrl = searchParams.get('url')
    const clientId = searchParams.get('client_id')
    
    if (!audioUrl || !clientId) {
      console.log('❌ Missing required parameters')
      return NextResponse.json({ 
        error: 'Audio URL and Client ID parameters are required' 
      }, { status: 400 })
    }

    // Fetch client's fetch_recording_url from database for security validation
    console.log(`🔍 Validating client ${clientId} for audio access...`)
    const clientResult = await pool.query(
      'SELECT fetch_recording_url FROM clients WHERE client_id = $1',
      [parseInt(clientId)]
    )

    if (clientResult.rows.length === 0) {
      console.log('❌ Client not found in database')
      return NextResponse.json({ 
        error: 'Invalid client' 
      }, { status: 404 })
    }

    const client = clientResult.rows[0]
    const clientRecordingUrl = client.fetch_recording_url

    if (!clientRecordingUrl) {
      console.log('❌ Client has no recording URL configured')
      return NextResponse.json({ 
        error: 'Client recording URL not configured' 
      }, { status: 400 })
    }

    // Validate that the audio URL is from the same domain as the client's recording API
    const audioUrlObj = new URL(audioUrl)
    const clientUrlObj = new URL(clientRecordingUrl)

    if (audioUrlObj.hostname !== clientUrlObj.hostname) {
      console.log(`❌ Invalid audio URL domain: ${audioUrlObj.hostname}, expected: ${clientUrlObj.hostname}`)
      return NextResponse.json({ 
        error: 'Invalid audio URL domain for this client' 
      }, { status: 403 })
    }

    console.log(`🌐 Proxying audio file from ${audioUrlObj.hostname}: ${audioUrl}`)

    // Fetch the audio file from the external server
    const audioData = await new Promise<Buffer>((resolve, reject) => {
      const options = {
        hostname: audioUrlObj.hostname,
        port: audioUrlObj.port || 443,
        path: audioUrlObj.pathname + audioUrlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'XDialNetworks-Dashboard/1.0',
          'Accept': 'audio/*,*/*',
        },
        // Bypass SSL certificate validation
        rejectUnauthorized: false
      }

      const req = https.request(options, (res) => {
        console.log(`📡 Audio response status: ${res.statusCode}`)
        console.log(`📡 Audio response headers:`, res.headers)

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }

        const chunks: Buffer[] = []
        
        res.on('data', (chunk) => {
          chunks.push(chunk)
        })
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks)
          console.log(`✅ Audio file received: ${buffer.length} bytes`)
          resolve(buffer)
        })
      })

      req.on('error', (error) => {
        console.error('🚨 HTTPS request error:', error)
        reject(error)
      })

      req.setTimeout(60000, () => {
        console.log('⏰ Audio request timeout after 60 seconds')
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.end()
    })

    // Determine content type based on file extension
    let contentType = 'audio/wav'
    if (audioUrl.toLowerCase().endsWith('.mp3')) {
      contentType = 'audio/mpeg'
    } else if (audioUrl.toLowerCase().endsWith('.m4a')) {
      contentType = 'audio/m4a'
    } else if (audioUrl.toLowerCase().endsWith('.ogg')) {
      contentType = 'audio/ogg'
    }

    // Return the audio file with proper headers
    const response = new NextResponse(audioData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioData.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
      },
    })

    console.log(`🎵 Successfully proxied audio file: ${audioData.length} bytes`)
    return response

  } catch (error) {
    console.error('💥 Error in audio proxy:', error)
    
    return NextResponse.json({ 
      error: 'Failed to fetch audio file',
      details: error.message
    }, { status: 500 })
  }
}