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
    """Run in production mode."""
    print("Starting production server...")
    os.environ.setdefault("ENVIRONMENT", "production")
    subprocess.run([
        "uvicorn", "trunk:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--workers", "4"
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
