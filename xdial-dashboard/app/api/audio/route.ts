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
    
    console.log(`📥 Audio URL: ${audioUrl}`)
    console.log(`📥 Client ID: ${clientId}`)
    
    if (!audioUrl || !clientId) {
      console.log('❌ Missing required parameters')
      return NextResponse.json({ 
        error: 'Audio URL and Client ID parameters are required' 
      }, { status: 400 })
    }

    // Validate client and get recording URLs
    console.log(`🔍 Validating client ${clientId}...`)
    const clientResult = await pool.query(`
      SELECT cru.recording_url 
      FROM client_recording_urls cru
      WHERE cru.client_id = $1
    `, [parseInt(clientId)])

    if (clientResult.rows.length === 0) {
      console.log('❌ No recording URLs configured')
      return NextResponse.json({ 
        error: 'Client recording URLs not configured' 
      }, { status: 400 })
    }

    // Extract valid domains
    const validDomains = clientResult.rows
      .map(row => {
        try {
          return new URL(row.recording_url).hostname
        } catch (e) {
          return null
        }
      })
      .filter(Boolean)

    if (validDomains.length === 0) {
      console.log('❌ No valid domains')
      return NextResponse.json({ 
        error: 'No valid recording URLs configured' 
      }, { status: 400 })
    }

    // Validate audio URL domain
    const audioUrlObj = new URL(audioUrl)
    
    if (!validDomains.includes(audioUrlObj.hostname)) {
      console.log(`❌ Invalid domain: ${audioUrlObj.hostname}`)
      return NextResponse.json({ 
        error: 'Invalid audio URL domain for this client' 
      }, { status: 403 })
    }

    console.log(`✅ Domain validated: ${audioUrlObj.hostname}`)
    console.log(`🌐 Proxying: ${audioUrl}`)

    // Fetch audio with proper binary handling
    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const options = {
        hostname: audioUrlObj.hostname,
        port: audioUrlObj.port || 443,
        path: audioUrlObj.pathname + audioUrlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': '*/*',
        },
        rejectUnauthorized: false
      }

      const req = https.request(options, (res) => {
        console.log(`📡 Status: ${res.statusCode}`)
        console.log(`📡 Content-Type: ${res.headers['content-type']}`)
        console.log(`📡 Content-Length: ${res.headers['content-length']}`)

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }

        const chunks: Buffer[] = []
        
        res.on('data', (chunk) => {
          chunks.push(Buffer.from(chunk))
        })
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks)
          console.log(`✅ Received ${buffer.length} bytes`)
          
          // Verify it's audio data (WAV starts with RIFF)
          const header = buffer.slice(0, 4).toString('ascii')
          console.log(`🔍 File header: ${header}`)
          
          resolve(buffer)
        })
      })

      req.on('error', (error) => {
        console.error('🚨 Request error:', error)
        reject(error)
      })

      req.setTimeout(60000, () => {
        req.destroy()
        reject(new Error('Timeout'))
      })

      req.end()
    })

    // Determine content type from URL extension
    let contentType = 'audio/wav'
    const ext = audioUrl.toLowerCase().split('.').pop()
    
    switch (ext) {
      case 'mp3':
        contentType = 'audio/mpeg'
        break
      case 'wav':
        contentType = 'audio/wav'
        break
      case 'm4a':
        contentType = 'audio/mp4'
        break
      case 'ogg':
        contentType = 'audio/ogg'
        break
    }

    console.log(`📤 Returning ${audioBuffer.length} bytes as ${contentType}`)

    // Return with minimal headers
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioBuffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    })

  } catch (error) {
    console.error('💥 Error:', error.message)
    
    return NextResponse.json({ 
      error: 'Failed to fetch audio',
      details: error.message
    }, { status: 500 })
  }
}