const { Pool } = require('pg')
const { readFileSync } = require('fs')
const { resolve } = require('path')

// Load .env file manually if dotenv is not available
try {
  require('dotenv').config()
} catch (e) {
  // Try to manually parse .env file
  try {
    const envPath = resolve(__dirname, '../.env')
    const envFile = readFileSync(envPath, 'utf-8')
    envFile.split('\n').forEach(line => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const match = trimmedLine.match(/^([^=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          let value = match[2].trim()
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }
          // Always set it (override existing env vars from .env file)
          process.env[key] = value
        }
      }
    })
  } catch (err) {
    // Ignore if .env file doesn't exist
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function testConnection() {
  console.log('Testing database connection...')
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'NOT SET'}`)
  if (process.env.DATABASE_URL) {
    // Mask password for security
    const maskedUrl = process.env.DATABASE_URL.replace(/:(.*)@/, ':****@')
    console.log(`Connection string: ${maskedUrl}`)
  }
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set')
    console.error('Please set DATABASE_URL in your .env file or environment')
    process.exit(1)
  }

  try {
    // Test basic connection
    console.log('\n1. Testing basic connection...')
    const client = await pool.connect()
    console.log('✅ Successfully connected to database')
    
    // Test query to check if clients table exists
    console.log('\n2. Testing query to clients table...')
    const result = await client.query('SELECT COUNT(*) FROM clients')
    console.log(`✅ Successfully queried clients table. Found ${result.rows[0].count} clients`)
    
    // Test a simple query
    console.log('\n3. Testing SELECT query...')
    const clientsResult = await client.query('SELECT * FROM clients ORDER BY client_name LIMIT 5')
    console.log(`✅ Successfully fetched ${clientsResult.rows.length} clients`)
    
    if (clientsResult.rows.length > 0) {
      console.log('\nSample clients:')
      clientsResult.rows.forEach(client => {
        console.log(`  - ID: ${client.client_id}, Name: ${client.client_name}, Extension: ${client.extension}`)
      })
    }
    
    client.release()
    console.log('\n✅ All database connection tests passed!')
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Database connection failed:')
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    console.error('\nFull error:', error)
    await pool.end()
    process.exit(1)
  }
}

testConnection()

