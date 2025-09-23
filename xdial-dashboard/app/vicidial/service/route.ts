// app/api/vicidial/services/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

const WORKING_DIR = '/root/vicidial_bot'
const CONFIG_FILE = path.join(WORKING_DIR, 'services_config.json')
const SERVICES_DIR = '/etc/systemd/system'
const VENV_PYTHON = path.join(WORKING_DIR, 'venv', 'bin', 'python')

// Helper function to load config
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return {}
  }
}

// Helper function to save config
async function saveConfig(config: any) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}

// Helper function to get service status
async function getServiceStatus(serviceName: string) {
  try {
    const { stdout } = await execAsync(`systemctl is-active ${serviceName}`)
    return stdout.trim()
  } catch {
    return 'inactive'
  }
}

// GET - List all services
export async function GET() {
  try {
    const config = await loadConfig()
    const services = []

    for (const [serviceName, serviceConfig] of Object.entries(config)) {
      const status = await getServiceStatus(serviceName)
      services.push({
        name: serviceName,
        status,
        config: serviceConfig
      })
    }

    return NextResponse.json({ services })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    )
  }
}

// POST - Create new service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      serviceName,
      baseUrl,
      username,
      password,
      targetSessionId,
      timeThreshold,
      checkInterval,
      description
    } = body

    // Validate required fields
    if (!serviceName || !baseUrl || !username || !password || !targetSessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const config = await loadConfig()

    // Check if service already exists
    if (config[serviceName]) {
      return NextResponse.json(
        { error: 'Service already exists' },
        { status: 409 }
      )
    }

    // Create Python script
    const scriptPath = path.join(WORKING_DIR, `${serviceName}.py`)
    const pythonScript = getPythonTemplate({
      baseUrl,
      username,
      password,
      targetSessionId,
      timeThreshold: timeThreshold || 90,
      checkInterval: checkInterval || 5
    })

    await fs.writeFile(scriptPath, pythonScript)
    await fs.chmod(scriptPath, 0o755)

    // Create systemd service file
    const serviceFilePath = path.join(SERVICES_DIR, `${serviceName}.service`)
    const serviceContent = getServiceTemplate({
      description: description || `ViciDial Auto-Logout Service - ${serviceName}`,
      workingDir: WORKING_DIR,
      venvPython: VENV_PYTHON,
      scriptPath
    })

    await fs.writeFile(serviceFilePath, serviceContent)

    // Reload systemd and enable service
    await execAsync('systemctl daemon-reload')
    await execAsync(`systemctl enable ${serviceName}`)

    // Save configuration
    config[serviceName] = {
      base_url: baseUrl,
      username,
      password,
      target_sessionid: targetSessionId,
      time_threshold: timeThreshold || 90,
      check_interval: checkInterval || 5,
      description: description || `ViciDial Auto-Logout Service - ${serviceName}`,
      script_path: scriptPath,
      service_path: serviceFilePath
    }
    await saveConfig(config)

    return NextResponse.json({
      message: 'Service created successfully',
      service: serviceName
    })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: 'Failed to create service', details: error.message },
      { status: 500 }
    )
  }
}

// Python script template function
function getPythonTemplate(config: any) {
  return `import requests
from bs4 import BeautifulSoup
import pandas as pd
from requests.auth import HTTPBasicAuth
import re
import time
from datetime import datetime
import urllib3

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configuration
BASE_URL = "${config.baseUrl}"
USERNAME = "${config.username}"
PASSWORD = "${config.password}"
TARGET_SESSIONID = "${config.targetSessionId}"
TIME_THRESHOLD = ${config.timeThreshold}
CHECK_INTERVAL = ${config.checkInterval}

# Initialize session
session = requests.Session()
auth = HTTPBasicAuth(USERNAME, PASSWORD)
session.verify = False

def time_to_seconds(time_str):
    """Convert time string to seconds"""
    try:
        time_str = time_str.strip()
        parts = time_str.split(':')
        
        if len(parts) == 2:
            minutes = int(parts[0])
            seconds = int(parts[1])
            return minutes * 60 + seconds
        elif len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = int(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        else:
            return 0
    except:
        return 0

def get_agents_data():
    """Fetch real-time agent data from ViciDial"""
    try:
        main_url = f"{BASE_URL}/realtime_report.php"
        auth_response = session.get(main_url, auth=auth, timeout=30)
        
        if auth_response.status_code != 200:
            print(f"Authentication failed with status {auth_response.status_code}")
            return None
        
        ajax_url = f"{BASE_URL}/AST_timeonVDADall.php"
        
        post_data = {
            'RTajax': '1',
            'DB': '0',
            'groups[]': 'ALL-ACTIVE',
            'user_group_filter[]': 'ALL-GROUPS',
            'ingroup_filter[]': 'ALL-INGROUPS',
            'adastats': '1',
            'usergroup': '',
            'UGdisplay': '0',
            'UidORname': '1',
            'orderby': 'timeup',
            'SERVdisplay': '0',
            'CALLSdisplay': '1',
            'PHONEdisplay': '0',
            'CUSTPHONEdisplay': '0',
            'CUSTINFOdisplay': '0',
            'with_inbound': 'Y',
            'report_display_type': 'TEXT'
        }
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0'
        }
        
        response = session.post(ajax_url, data=post_data, headers=headers, auth=auth, timeout=30)
        
        if response.status_code == 200:
            return response.text
        else:
            print(f"AJAX request failed with status {response.status_code}")
            return None
        
    except Exception as e:
        print(f"Error fetching agent data: {e}")
        return None

def parse_agents(html_content):
    """Parse HTML to find agents matching criteria"""
    if not html_content:
        return []
    
    soup = BeautifulSoup(html_content, 'html.parser')
    pre_tag = soup.find('pre')
    
    if not pre_tag:
        return []
    
    agents_to_logout = []
    lines = str(pre_tag).split('\\n')
    
    for line in lines:
        if TARGET_SESSIONID in line and '|' in line:
            clean_line = re.sub(r'<[^>]+>', '', line)
            parts = [part.strip() for part in clean_line.split('|')]
            
            if len(parts) >= 8:
                try:
                    station = parts[1].strip()
                    user_field = parts[2].strip()
                    user_match = re.match(r'(\\w+)', user_field)
                    user_id = user_match.group(1) if user_match else user_field.split()[0]
                    
                    sessionid = parts[3].strip()
                    status = parts[4].strip()
                    time_str = parts[5].strip()
                    
                    if sessionid == TARGET_SESSIONID and (status == 'READY' or status == 'INCALL' or status.startswith('INCALL')):
                        time_in_seconds = time_to_seconds(time_str)
                        
                        if time_in_seconds > TIME_THRESHOLD:
                            agents_to_logout.append({
                                'user_id': user_id,
                                'station': station,
                                'time': time_str,
                                'time_seconds': time_in_seconds,
                                'status': status
                            })
                except Exception as e:
                    print(f"Error parsing line: {e}")
                    continue
    
    return agents_to_logout

def emergency_logout_agent(user_id):
    """Perform emergency logout for a specific agent"""
    try:
        user_status_url = f"{BASE_URL}/user_status.php"
        response = session.get(user_status_url, params={'user': user_id}, auth=auth, timeout=30)
        
        if response.status_code != 200:
            print(f"Failed to access user status page: {response.status_code}")
            return False
        
        logout_data = {
            'DB': '0',
            'user': user_id,
            'stage': 'log_agent_out',
            'submit': 'EMERGENCY LOG AGENT OUT'
        }
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': f"{user_status_url}?user={user_id}"
        }
        
        logout_response = session.post(user_status_url, data=logout_data, headers=headers, auth=auth, timeout=30)
        
        if logout_response.status_code == 200:
            print(f"✓ Successfully logged out agent {user_id}")
            return True
        else:
            print(f"✗ Failed to logout agent {user_id} - Status: {logout_response.status_code}")
            return False
            
    except Exception as e:
        print(f"✗ Error logging out agent {user_id}: {e}")
        return False

def run_continuous(check_interval=5):
    """Run the logout process continuously"""
    print(f"Starting auto-logout monitor...")
    print(f"Base URL: {BASE_URL}")
    print(f"Target Session ID: {TARGET_SESSIONID}")
    print(f"Time Threshold: {TIME_THRESHOLD} seconds")
    print(f"Check Interval: {check_interval} seconds")
    print("-" * 50)
    
    try:
        while True:
            print(f"\\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Checking agents...")
            
            html_content = get_agents_data()
            
            if html_content:
                agents_to_logout = parse_agents(html_content)
                
                if agents_to_logout:
                    print(f"Found {len(agents_to_logout)} agents to logout:")
                    
                    df = pd.DataFrame(agents_to_logout)
                    print(df[['user_id', 'station', 'time', 'status']].to_string(index=False))
                    print()
                    
                    for agent in agents_to_logout:
                        print(f"Logging out {agent['user_id']} (waited {agent['time']})...")
                        emergency_logout_agent(agent['user_id'])
                        time.sleep(1)
                else:
                    print("No agents found matching criteria.")
            else:
                print("Failed to fetch agent data.")
            
            print(f"\\nWaiting {check_interval} seconds before next check...")
            time.sleep(check_interval)
            
    except KeyboardInterrupt:
        print("\\n\\nAuto-logout monitor stopped by user.")
    except Exception as e:
        print(f"\\nError in continuous run: {e}")
        print("Restarting in 10 seconds...")
        time.sleep(10)
        run_continuous(check_interval)

if __name__ == "__main__":
    run_continuous(check_interval=CHECK_INTERVAL)
`
}

// Service template function
function getServiceTemplate(config: any) {
  return `[Unit]
Description=${config.description}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${config.workingDir}
ExecStart=${config.venvPython} ${config.scriptPath}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target`
}