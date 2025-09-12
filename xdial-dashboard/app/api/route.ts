// app/api/recordings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const date = searchParams.get('date')

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    // Get the client's fetch_recording_url and extension from database
    const clientResult = await pool.query(
      'SELECT fetch_recording_url, extension, client_name FROM clients WHERE client_id = $1',
      [clientId]
    )

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const client = clientResult.rows[0]
    
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
      // Fetch recordings from the client's API
      const recordingResponse = await fetch(recordingUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'XDialNetworks-Dashboard/1.0'
        },
        // Add timeout
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (!recordingResponse.ok) {
        console.error(`Recording API returned status ${recordingResponse.status}: ${recordingResponse.statusText}`)
        return NextResponse.json({ 
          error: `Failed to fetch recordings: ${recordingResponse.status} ${recordingResponse.statusText}`,
          recordings: []
        }, { status: 500 })
      }

      const recordingData = await recordingResponse.text()
      console.log('Raw recording response (first 500 chars):', recordingData.substring(0, 500))
      
      // Parse the JSON response
      let recordings = {}
      try {
        // Clean up any potential HTML or whitespace and parse JSON
        const cleanedData = recordingData
          .replace(/<\/?[^>]+(>|$)/g, '') // Remove HTML tags if any
          .trim()
        
        recordings = JSON.parse(cleanedData)
      } catch (parseError) {
        console.error('Failed to parse recording data:', parseError)
        console.error('Raw data:', recordingData)
        return NextResponse.json({ 
          error: 'Invalid response format from recording API',
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
          response_category: 'UNKNOWN', // Will try to match with database calls
          speech_text: '',
          audio_url: rec.url,
          size: rec.size || '',
          filename: rec.name || ''
        }
      })

      console.log(`Transformed ${transformedRecordings.length} recordings from API`)

      // Try to match recordings with calls in our database to get response categories
      try {
        const callsResult = await pool.query(
          `SELECT call_id, phone_number, response_category, timestamp 
           FROM calls 
           WHERE client_id = $1 
           AND DATE(timestamp) = $2
           ORDER BY timestamp DESC`,
          [clientId, date]
        )

        const callsData = callsResult.rows

        // Merge recordings with call data
        const mergedData = transformedRecordings.map(recording => {
          // Try to find matching call by phone number and similar timestamp
          const matchingCall = callsData.find(call => {
            // First try exact phone number match
            if (call.phone_number === recording.phone_number) {
              return true
            }
            
            // Then try to match by timestamp (within 2 minutes)
            try {
              const callTime = new Date(call.timestamp)
              const recTime = new Date(recording.timestamp)
              const timeDiff = Math.abs(callTime.getTime() - recTime.getTime())
              return timeDiff < 120000 // Within 2 minutes
            } catch (e) {
              return false
            }
          })

          return {
            ...recording,
            call_id: matchingCall?.call_id,
            database_category: matchingCall?.response_category,
            // Use database category if available, otherwise keep UNKNOWN
            response_category: matchingCall?.response_category || recording.response_category
          }
        })

        console.log(`Successfully processed ${mergedData.length} recordings for client ${clientId}`)

        return NextResponse.json({ 
          recordings: mergedData,
          total: mergedData.length,
          client_name: client.client_name,
          date: date,
          source: 'external_api'
        })

      } catch (dbError) {
        console.error('Database error when matching calls:', dbError)
        // Return recordings even if DB matching fails
        return NextResponse.json({ 
          recordings: transformedRecordings,
          total: transformedRecordings.length,
          client_name: client.client_name,
          date: date,
          warning: 'Could not match with call database',
          source: 'external_api'
        })
      }

    } catch (fetchError) {
      console.error('Error fetching from recording API:', fetchError)
      
      // Check if it's a timeout error
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({ 
          error: 'Request timeout - recording API took too long to respond',
          recordings: []
        }, { status: 504 })
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch recordings from external API',
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