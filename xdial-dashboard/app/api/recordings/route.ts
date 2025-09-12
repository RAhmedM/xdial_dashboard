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
      'SELECT fetch_recording_url, extension, name FROM clients WHERE client_id = $1',
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
    
    // Build the recording fetch URL
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
        timeout: 30000 // 30 second timeout
      })

      if (!recordingResponse.ok) {
        console.error(`Recording API returned status ${recordingResponse.status}`)
        return NextResponse.json({ 
          error: `Failed to fetch recordings: ${recordingResponse.status} ${recordingResponse.statusText}`,
          recordings: []
        }, { status: 500 })
      }

      const recordingData = await recordingResponse.text()
      console.log('Raw recording response:', recordingData.substring(0, 500) + '...')
      
      // Parse the response - handle different response formats
      let recordings = {}
      try {
        // First try to parse as JSON
        if (recordingData.trim().startsWith('{') || recordingData.trim().startsWith('[')) {
          recordings = JSON.parse(recordingData)
        } else {
          // Clean up the response if it contains HTML tags or other content
          const cleanedData = recordingData
            .replace(/<\/?[^>]+(>|$)/g, '') // Remove HTML tags
            .replace(/^\s*[^{]*({.*})[^}]*\s*$/s, '$1') // Extract JSON part
            .trim()
          
          if (cleanedData) {
            recordings = JSON.parse(cleanedData)
          } else {
            console.warn('No valid JSON found in response')
            recordings = {}
          }
        }
      } catch (parseError) {
        console.error('Failed to parse recording data:', parseError)
        console.error('Raw data:', recordingData)
        return NextResponse.json({ 
          error: 'Invalid response format from recording API',
          recordings: []
        }, { status: 500 })
      }

      // Transform recordings to our format
      const transformedRecordings = Object.entries(recordings).map(([key, rec]: [string, any]) => {
        // Handle different timestamp formats
        let timestamp = ''
        if (rec.date && rec.time) {
          timestamp = formatTimestamp(rec.date, rec.time)
        } else if (rec.timestamp) {
          timestamp = rec.timestamp
        }

        return {
          id: key,
          unique_id: rec.unique_id || `${rec.date || ''}-${rec.time || ''}_${rec.number || rec.phone_number || ''}`,
          timestamp: timestamp,
          duration: rec.duration || '0',
          phone_number: rec.number || rec.phone_number || 'Unknown',
          response_category: rec.response_category || rec.category || 'UNKNOWN',
          speech_text: rec.speech_text || rec.text || '',
          audio_url: rec.url || rec.audio_url || '',
          size: rec.size || '',
          external_data: rec // Keep original data for reference
        }
      })

      // Also try to match with calls in our database for additional context
      try {
        const dateForQuery = date // Already in YYYY-MM-DD format
        const callsResult = await pool.query(
          `SELECT call_id, phone_number, timestamp, response_category 
           FROM calls 
           WHERE client_id = $1 
           AND DATE(timestamp) = $2
           ORDER BY timestamp DESC`,
          [clientId, dateForQuery]
        )

        // Merge call data with recordings where possible
        const mergedData = transformedRecordings.map(recording => {
          const matchingCall = callsResult.rows.find(call => {
            // Try to match by phone number first
            if (call.phone_number === recording.phone_number) {
              return true
            }
            
            // Then try to match by timestamp (within 2 minutes)
            if (recording.timestamp) {
              try {
                const callTime = new Date(call.timestamp)
                const recTime = new Date(recording.timestamp)
                return Math.abs(callTime.getTime() - recTime.getTime()) < 120000 // Within 2 minutes
              } catch (e) {
                return false
              }
            }
            
            return false
          })

          return {
            ...recording,
            call_id: matchingCall?.call_id,
            database_category: matchingCall?.response_category,
            // Use database category if available, otherwise use external
            response_category: matchingCall?.response_category || recording.response_category
          }
        })

        console.log(`Successfully processed ${mergedData.length} recordings for client ${clientId}`)

        return NextResponse.json({ 
          recordings: mergedData,
          total: mergedData.length,
          client_name: client.name,
          date: date,
          source_url: recordingUrl.replace(/\?.*/, '') // Don't expose full URL with params
        })

      } catch (dbError) {
        console.error('Database error when matching calls:', dbError)
        // Return recordings even if DB matching fails
        return NextResponse.json({ 
          recordings: transformedRecordings,
          total: transformedRecordings.length,
          client_name: client.name,
          date: date,
          warning: 'Could not match with call database'
        })
      }

    } catch (fetchError) {
      console.error('Error fetching from recording API:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch recordings from external API',
        details: fetchError.message,
        url: recordingUrl.replace(/\?.*/, ''), // Don't expose full URL
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
    // Convert YYYYMMDD HHMMSS to YYYY-MM-DD HH:MM:SS
    let formattedDate = date
    let formattedTime = time

    // Handle date format
    if (date.length === 8) {
      const year = date.substring(0, 4)
      const month = date.substring(4, 6)
      const day = date.substring(6, 8)
      formattedDate = `${year}-${month}-${day}`
    }

    // Handle time format
    if (time.length === 6) {
      const hour = time.substring(0, 2)
      const minute = time.substring(2, 4)
      const second = time.substring(4, 6)
      formattedTime = `${hour}:${minute}:${second}`
    }

    return `${formattedDate} ${formattedTime}`
  } catch (error) {
    console.error('Error formatting timestamp:', error)
    return `${date} ${time}` // Fallback to original
  }
}
