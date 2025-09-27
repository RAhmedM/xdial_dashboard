#!/bin/bash

# XDial Dashboard Production Deployment Script
set -e

echo "🚀 Starting XDial Dashboard Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Create directories
print_status "Creating directory structure..."
mkdir -p /root/xdial_dashboard/fetch_call_data/logs
mkdir -p /root/xdial_dashboard/xdial-dashboard/logs

# Copy backend files
print_status "Setting up backend (FastAPI)..."
cp -r fetch_call_data /root/xdial_dashboard/
cd /root/xdial_dashboard/fetch_call_data

# Install Python dependencies
print_status "Installing Python dependencies..."
pip3 install -r requirements.txt

# Copy frontend files
print_status "Setting up frontend (Next.js)..."
cp -r xdial-dashboard /root/xdial_dashboard/
cd /root/xdial_dashboard/xdial-dashboard

# Install Node.js dependencies
print_status "Installing Node.js dependencies..."
npm install

# Build the frontend
print_status "Building frontend..."
npm run build

# Install PM2 if not already installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    npm install -g pm2
fi

# Start backend with PM2
print_status "Starting backend service..."
cd /root/xdial_dashboard/fetch_call_data
pm2 start ecosystem.production.config.js

# Start frontend with PM2
print_status "Starting frontend service..."
cd /root/xdial_dashboard/xdial-dashboard
pm2 start ecosystem.production.config.js

# Save PM2 configuration
print_status "Saving PM2 configuration..."
pm2 save
pm2 startup

# Set up nginx
print_status "Setting up nginx..."
cp nginx.conf /etc/nginx/sites-available/xdial-dashboard
ln -sf /etc/nginx/sites-available/xdial-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
print_status "Testing nginx configuration..."
nginx -t

# Reload nginx
print_status "Reloading nginx..."
systemctl reload nginx

print_status "✅ Deployment completed successfully!"
echo ""
echo "📋 Services status:"
pm2 status
echo ""
echo "🔗 Your application should be available at:"
echo "   Frontend: http://test.dashboard.xlite.xdialnetworks.com"
echo "   Backend API: http://test.fetchapi.dashboard.xdialnetworks.com"
echo ""
echo "📝 Useful commands:"
echo "  - View logs: pm2 logs"
echo "  - Restart services: pm2 restart all"
echo "  - Stop services: pm2 stop all"
echo "  - Monitor: pm2 monit"
echo ""
print_warning "Don't forget to:"
echo "  1. Set up your database and update DATABASE_URL in environment files"
echo "  2. Configure SSL certificates for production"
echo "  3. Set up proper firewall rules"
echo "  4. Update environment variables with your actual values"