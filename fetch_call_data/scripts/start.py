#!/usr/bin/env python3
"""
Startup script for the Calls API.
"""

import os
import sys
import subprocess
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def install_dependencies():
    """Install required dependencies."""
    print("Installing dependencies...")
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], check=True)

def run_development():
    """Run in development mode."""
    print("Starting development server...")
    os.environ.setdefault("ENVIRONMENT", "development")
    subprocess.run([sys.executable, "trunk.py"], check=True)

def run_production():
    """Run in production mode with Gunicorn."""
    print("Starting production server with Gunicorn...")
    os.environ.setdefault("ENVIRONMENT", "production")
    
    # Use gunicorn from virtual environment if it exists
    gunicorn_path = ".venv/bin/gunicorn"
    if not os.path.exists(gunicorn_path):
        gunicorn_path = "gunicorn"  # Fallback to system gunicorn
    
    subprocess.run([
        gunicorn_path, "trunk:app",
        "--bind", "0.0.0.0:8000",
        "--workers", "4",
        "--worker-class", "uvicorn.workers.UvicornWorker",
        "--worker-connections", "1000",
        "--timeout", "30",
        "--keep-alive", "2",
        "--max-requests", "1000",
        "--max-requests-jitter", "50",
        "--preload",
        "--access-logfile", "/var/www/xdial-dashboard/xdial_dashboard/fetch_call_data/logs/access.log",
        "--error-logfile", "/var/www/xdial-dashboard/xdial_dashboard/fetch_call_data/logs/error.log",
        "--log-level", "info"
    ], check=True)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "install":
            install_dependencies()
        elif command == "dev":
            run_development()
        elif command == "prod":
            run_production()
        else:
            print(f"Unknown command: {command}")
            print("Available commands: install, dev, prod")
    else:
        print("Usage: python scripts/start.py [install|dev|prod]")
