// app/api/recordings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  console.log('Recordings API called')
  
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const date = searchParams.get('date')

    console.log(`Request params - clientId: ${clientId}, date: ${date}`)

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    console.log('Fetching client data from database...')

    // Get the client's fetch_recording_url and extension from database
    const clientResult = await pool.query(
      'SELECT fetch_recording_url, extension, client_name FROM clients WHERE client_id = $1',
      [clientId]
    )

    console.log(`Client query result: ${clientResult.rows.length} rows`)

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const client = clientResult.rows[0]
    console.log('Client data:', { 
      fetch_recording_url: client.fetch_recording_url,
      extension: client.extension,
      client_name: client.client_name 
    })
    
    if (!client.fetch_recording_url) {
      return NextResponse.json({ error: 'No recording URL configured for this client' }, { status: 400 })
    }

    if (!client.extension) {
      return NextResponse.json({ error: 'No extension configured for this client' }, { status: 400 })
    }

    // Format date from YYYY-MM-DD to YYYYMMDD
    const formattedDate = date.replace(/-/g, '')
    
    // Build the recording fetch URL with parameters
    const recordingUrl = `${client.fetch_recording_url}?date=${formattedDate}&extension=${client.extension}`
    
    console.log(`Fetching recordings from: ${recordingUrl}`)

    try {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      // Fetch recordings from the client's API
      const recordingResponse = await fetch(recordingUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'XDialNetworks-Dashboard/1.0'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log(`Recording API response status: ${recordingResponse.status}`)

      if (!recordingResponse.ok) {
        console.error(`Recording API returned status ${recordingResponse.status}: ${recordingResponse.statusText}`)
        return NextResponse.json({ 
          error: `Failed to fetch recordings: ${recordingResponse.status} ${recordingResponse.statusText}`,
          recordings: []
        }, { status: 500 })
      }

      const recordingData = await recordingResponse.text()
      console.log('Raw recording response length:', recordingData.length)
      console.log('Raw recording response (first 200 chars):', recordingData.substring(0, 200))
      
      // Parse the JSON response
      let recordings = {}
      try {
        recordings = JSON.parse(recordingData)
        console.log(`Parsed ${Object.keys(recordings).length} recordings from API`)
      } catch (parseError) {
        console.error('Failed to parse recording data:', parseError)
        console.error('Raw data:', recordingData)
        return NextResponse.json({ 
          error: 'Invalid JSON response from recording API',
          recordings: []
        }, { status: 500 })
      }

      // Transform the API response to our expected format
      const transformedRecordings = Object.entries(recordings).map(([key, rec]: [string, any]) => {
        // Create a timestamp from date and time
        const timestamp = formatTimestamp(rec.date, rec.time)
        
        return {
          id: key,
          unique_id: `${rec.date}-${rec.time}_${rec.number}`,
          timestamp: timestamp,
          duration: rec.duration || '00:00:00',
          phone_number: rec.number,
          response_category: 'UNKNOWN', // Default category
          speech_text: '',
          audio_url: rec.url,
          size: rec.size || '',
          filename: rec.name || ''
        }
      })

      console.log(`Transformed ${transformedRecordings.length} recordings`)

      // Try to match recordings with calls in our database (but don't let this block the response)
      let finalRecordings = transformedRecordings
      
      try {
        console.log('Attempting to match with database calls...')
        
        const callsResult = await pool.query(
          `SELECT call_id, phone_number, response_category, timestamp 
           FROM calls 
           WHERE client_id = $1 
           AND DATE(timestamp) = $2
           ORDER BY timestamp DESC`,
          [clientId, date]
        )

        console.log(`Found ${callsResult.rows.length} calls in database for matching`)

        if (callsResult.rows.length > 0) {
          finalRecordings = transformedRecordings.map(recording => {
            // Simple phone number match
            const matchingCall = callsResult.rows.find(call => 
              call.phone_number === recording.phone_number
            )

            return {
              ...recording,
              call_id: matchingCall?.call_id,
              database_category: matchingCall?.response_category,
              response_category: matchingCall?.response_category || recording.response_category
            }
          })
        }

      } catch (dbError) {
        console.error('Database error when matching calls (continuing without match):', dbError)
        // Continue with original recordings even if DB matching fails
      }

      console.log(`Returning ${finalRecordings.length} recordings`)

      return NextResponse.json({ 
        recordings: finalRecordings,
        total: finalRecordings.length,
        client_name: client.client_name,
        date: date,
        source: 'external_api'
      })

    } catch (fetchError) {
      console.error('Error fetching from recording API:', fetchError)
      
      // Check if it's a timeout/abort error
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({ 
          error: 'Request timeout - recording API took too long to respond',
          recordings: []
        }, { status: 504 })
      }
      
      return NextResponse.json({ 
        error: 'Failed to connect to recording API',
        details: fetchError.message,
        recordings: []
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in recordings API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message,
      recordings: []
    }, { status: 500 })
  }
}

function formatTimestamp(date: string, time: string): string {
  try {
    // Convert YYYYMMDD and HHMMSS to proper ISO timestamp
    const year = date.substring(0, 4)
    const month = date.substring(4, 6)
    const day = date.substring(6, 8)
    
    const hour = time.substring(0, 2)
    const minute = time.substring(2, 4)
    const second = time.substring(4, 6)
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  } catch (error) {
    console.error('Error formatting timestamp:', error, { date, time })
    return `${date} ${time}`
  }
}