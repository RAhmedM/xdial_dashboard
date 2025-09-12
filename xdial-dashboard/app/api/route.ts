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
    const callId = searchParams.get('call_id')

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    // First, get the client's fetch_recording_url
    const clientResult = await pool.query(
      'SELECT fetch_recording_url, extension FROM clients WHERE client_id = $1',
      [clientId]
    )

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const client = clientResult.rows[0]
    
    if (!client.fetch_recording_url) {
      return NextResponse.json({ error: 'No recording URL configured for this client' }, { status: 400 })
    }

    // If a specific call is requested, get its details
    if (callId) {
      const callResult = await pool.query(
        'SELECT * FROM calls WHERE call_id = $1 AND client_id = $2',
        [callId, clientId]
      )

      if (callResult.rows.length === 0) {
        return NextResponse.json({ error: 'Call not found' }, { status: 404 })
      }

      const call = callResult.rows[0]
      
      // Format the date from the call timestamp for the API
      const callDate = new Date(call.timestamp)
      const formattedDate = callDate.toISOString().split('T')[0].replace(/-/g, '')

      // Fetch recording from the client's API
      const recordingUrl = `${client.fetch_recording_url}?date=${formattedDate}&extension=${client.extension}`
      
      try {
        const recordingResponse = await fetch(recordingUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        })

        if (!recordingResponse.ok) {
          throw new Error(`Recording API returned status ${recordingResponse.status}`)
        }

        const recordingData = await recordingResponse.text()
        
        // Parse the response (handling the format from your old system)
        let recordings = {}
        try {
          // Clean up the response if needed (remove HTML tags, etc.)
          const cleanedData = recordingData.replace(/<\/?[^>]+(>|$)/g, '').trim()
          recordings = JSON.parse(cleanedData)
        } catch (e) {
          console.error('Failed to parse recording data:', e)
          recordings = {}
        }

        // Find the recording that matches this call
        const matchingRecording = Object.values(recordings).find((rec: any) => {
          // Match based on timestamp or phone number
          const recTimestamp = `${rec.date} ${rec.time}`
          const callTimestamp = callDate.toISOString().replace(/[-:T]/g, '').substring(0, 14)
          return recTimestamp.includes(callTimestamp) || rec.number === call.phone_number
        })

        if (matchingRecording) {
          return NextResponse.json({
            recording: {
              call_id: call.call_id,
              url: (matchingRecording as any).url,
              duration: (matchingRecording as any).duration,
              timestamp: call.timestamp,
              phone_number: call.phone_number,
              response_category: call.response_category
            }
          })
        } else {
          return NextResponse.json({ error: 'Recording not found for this call' }, { status: 404 })
        }

      } catch (fetchError) {
        console.error('Error fetching from recording API:', fetchError)
        return NextResponse.json({ 
          error: 'Failed to fetch recording from external API',
          details: fetchError.message 
        }, { status: 500 })
      }
    }

    // If no specific call, fetch all recordings for the date
    const formattedDate = date ? date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '')
    const recordingUrl = `${client.fetch_recording_url}?date=${formattedDate}&extension=${client.extension}`

    try {
      const recordingResponse = await fetch(recordingUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      })

      if (!recordingResponse.ok) {
        throw new Error(`Recording API returned status ${recordingResponse.status}`)
      }

      const recordingData = await recordingResponse.text()
      
      // Parse and clean the response
      let recordings = {}
      try {
        const cleanedData = recordingData.replace(/<\/?[^>]+(>|$)/g, '').trim()
        recordings = JSON.parse(cleanedData)
      } catch (e) {
        console.error('Failed to parse recording data:', e)
        return NextResponse.json({ recordings: [] })
      }

      // Transform recordings to match our format
      const transformedRecordings = Object.entries(recordings).map(([key, rec]: [string, any]) => ({
        id: key,
        unique_id: `${rec.date}-${rec.time}_${rec.number}`,
        timestamp: formatTimestamp(rec.date, rec.time),
        duration: rec.duration,
        phone_number: rec.number,
        response_category: rec.response_category || 'UNKNOWN',
        speech_text: rec.speech_text || '',
        audio_url: rec.url,
        size: rec.size || ''
      }))

      // Also fetch matching calls from database to merge data
      const dateForQuery = date || new Date().toISOString().split('T')[0]
      const callsResult = await pool.query(
        `SELECT * FROM calls 
         WHERE client_id = $1 
         AND DATE(timestamp) = $2
         ORDER BY timestamp DESC`,
        [clientId, dateForQuery]
      )

      // Merge call data with recordings
      const mergedData = transformedRecordings.map(recording => {
        const matchingCall = callsResult.rows.find(call => {
          const callTime = new Date(call.timestamp)
          const recTime = new Date(recording.timestamp)
          return Math.abs(callTime.getTime() - recTime.getTime()) < 60000 // Within 1 minute
        })

        return {
          ...recording,
          call_id: matchingCall?.call_id,
          database_category: matchingCall?.response_category
        }
      })

      return NextResponse.json({ 
        recordings: mergedData,
        total: mergedData.length
      })

    } catch (fetchError) {
      console.error('Error fetching recordings:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch recordings',
        details: fetchError.message 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in recordings API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

function formatTimestamp(date: string, time: string): string {
  // Convert YYYYMMDD HHMMSS to YYYY-MM-DD HH:MM:SS
  const year = date.substring(0, 4)
  const month = date.substring(4, 6)
  const day = date.substring(6, 8)
  
  const hour = time.substring(0, 2)
  const minute = time.substring(2, 4)
  const second = time.substring(4, 6)
  
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}