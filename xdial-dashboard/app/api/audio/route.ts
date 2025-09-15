// app/api/audio/route.ts
import { NextRequest, NextResponse } from 'next/server'
import https from 'https'
import { URL } from 'url'

export async function GET(request: NextRequest) {
  console.log('🎵 Audio proxy API called')
  
  try {
    const { searchParams } = new URL(request.url)
    const audioUrl = searchParams.get('url')
    
    if (!audioUrl) {
      console.log('❌ Missing audio URL parameter')
      return NextResponse.json({ 
        error: 'Audio URL parameter is required' 
      }, { status: 400 })
    }

    // Validate that the URL is from the expected domain for security
    const urlObj = new URL(audioUrl)
    if (!urlObj.hostname.includes('xliteshared3.xdialnetworks.com')) {
      console.log('❌ Invalid audio URL domain:', urlObj.hostname)
      return NextResponse.json({ 
        error: 'Invalid audio URL domain' 
      }, { status: 400 })
    }

    console.log(`🌐 Proxying audio file: ${audioUrl}`)

    // Fetch the audio file from the external server
    const audioData = await new Promise<Buffer>((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
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
