// app/api/vicidial/services/[name]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

const WORKING_DIR = '/root/vicidial_bot'
const CONFIG_FILE = path.join(WORKING_DIR, 'services_config.json')

async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return {}
  }
}

async function saveConfig(config: any) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}

// DELETE - Remove a service
export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const serviceName = params.name
    const config = await loadConfig()

    if (!config[serviceName]) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    const serviceConfig = config[serviceName]

    // Stop and disable service
    await execAsync(`systemctl stop ${serviceName}`).catch(() => {})
    await execAsync(`systemctl disable ${serviceName}`).catch(() => {})

    // Remove files
    if (serviceConfig.script_path) {
      await fs.unlink(serviceConfig.script_path).catch(() => {})
    }
    if (serviceConfig.service_path) {
      await fs.unlink(serviceConfig.service_path).catch(() => {})
    }

    // Reload systemd
    await execAsync('systemctl daemon-reload')

    // Remove from config
    delete config[serviceName]
    await saveConfig(config)

    return NextResponse.json({
      message: 'Service removed successfully'
    })
  } catch (error) {
    console.error('Error removing service:', error)
    return NextResponse.json(
      { error: 'Failed to remove service', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update a service
export async function PUT(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const serviceName = params.name
    const body = await request.json()
    const config = await loadConfig()

    if (!config[serviceName]) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    // Update configuration
    const updatedConfig = { ...config[serviceName], ...body }
    config[serviceName] = updatedConfig

    // Recreate Python script with updated config
    const scriptPath = config[serviceName].script_path
    const pythonScript = getPythonTemplate(updatedConfig)
    await fs.writeFile(scriptPath, pythonScript)

    // Save config
    await saveConfig(config)

    // Restart service to apply changes
    await execAsync(`systemctl restart ${serviceName}`).catch(() => {})

    return NextResponse.json({
      message: 'Service updated successfully',
      service: serviceName
    })
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json(
      { error: 'Failed to update service', details: error.message },
      { status: 500 }
    )
  }
}

// Python template helper (same as in main route)
function getPythonTemplate(config: any) {
  // Same Python template as in the main route.ts file
  return `# Auto-generated ViciDial service script
import requests
from bs4 import BeautifulSoup
import pandas as pd
from requests.auth import HTTPBasicAuth
import re
import time
from datetime import datetime
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "${config.base_url || config.baseUrl}"
USERNAME = "${config.username}"
PASSWORD = "${config.password}"
TARGET_SESSIONID = "${config.target_sessionid || config.targetSessionId}"
TIME_THRESHOLD = ${config.time_threshold || config.timeThreshold || 90}
CHECK_INTERVAL = ${config.check_interval || config.checkInterval || 5}

# ... (rest of the Python script template)
`
}

// app/api/vicidial/services/[name]/action/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const serviceName = params.name
    const { action } = await request.json()

    let command = ''
    switch (action) {
      case 'start':
        command = `systemctl start ${serviceName}`
        break
      case 'stop':
        command = `systemctl stop ${serviceName}`
        break
      case 'restart':
        command = `systemctl restart ${serviceName}`
        break
      case 'status':
        const { stdout } = await execAsync(`systemctl is-active ${serviceName}`).catch(err => ({ stdout: 'inactive' }))
        return NextResponse.json({ status: stdout.trim() })
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    await execAsync(command)
    
    // Get new status
    const { stdout } = await execAsync(`systemctl is-active ${serviceName}`).catch(err => ({ stdout: 'inactive' }))
    
    return NextResponse.json({
      message: `Service ${action} successful`,
      status: stdout.trim()
    })
  } catch (error) {
    console.error('Error performing service action:', error)
    return NextResponse.json(
      { error: 'Failed to perform action', details: error.message },
      { status: 500 }
    )
  }
}

// app/api/vicidial/services/[name]/logs/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const serviceName = params.name
    const { searchParams } = new URL(request.url)
    const lines = searchParams.get('lines') || '50'
    const live = searchParams.get('live') === 'true'

    let command = `journalctl -u ${serviceName} --no-pager -n ${lines}`
    
    if (live) {
      // For live logs, we'll use a different approach
      // Return a streaming response
      command = `journalctl -u ${serviceName} -f --no-pager -n ${lines}`
    }

    const { stdout, stderr } = await execAsync(command)
    
    if (stderr && !stdout) {
      return NextResponse.json(
        { error: 'Failed to fetch logs', details: stderr },
        { status: 500 }
      )
    }

    return NextResponse.json({
      logs: stdout,
      service: serviceName,
      lines: lines
    })
  } catch (error) {
    console.error('Error fetching logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch logs', details: error.message },
      { status: 500 }
    )
  }
}