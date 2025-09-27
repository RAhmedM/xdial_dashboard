# XDial Dashboard Production Deployment Guide

## Overview
This project consists of two separate services:
1. **Frontend**: Next.js application (`xdial-dashboard`) - serves the web interface
2. **Backend**: FastAPI application (`fetch_call_data`) - handles call data processing

## Domain Configuration
- **Frontend**: `test.dashboard.xlite.xdialnetworks.com`
- **Backend API**: `test.fetchapi.dashboard.xdialnetworks.com`

## Prerequisites
- Node.js 18+ and npm
- Python 3.8+ and pip
- PM2 process manager
- Nginx web server
- PostgreSQL database

## Deployment Steps

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3.8+
sudo apt install python3 python3-pip python3-venv

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib
```

### 2. Directory Structure
```bash
/root/xdial_dashboard/
├── fetch_call_data/          # Backend API
│   ├── logs/
│   └── ecosystem.production.config.js
├── xdial-dashboard/          # Frontend
│   ├── logs/
│   └── ecosystem.production.config.js
└── nginx.conf
```

### 3. Backend Deployment (FastAPI)

#### Copy and setup backend:
```bash
sudo mkdir -p /root/xdial_dashboard
sudo cp -r fetch_call_data /root/xdial_dashboard/
cd /root/xdial_dashboard/fetch_call_data

# Install Python dependencies
sudo pip3 install -r requirements.txt

# Create logs directory
sudo mkdir -p logs
```

#### Environment Variables for Backend:
Create `/root/xdial_dashboard/fetch_call_data/.env`:
```env
ENVIRONMENT=production
DATABASE_URL=postgresql://username:password@localhost:5432/xdial_dashboard
PYTHONPATH=/root/xdial_dashboard/fetch_call_data
```

### 4. Frontend Deployment (Next.js)

#### Copy and setup frontend:
```bash
sudo cp -r xdial-dashboard /root/xdial_dashboard/
cd /root/xdial_dashboard/xdial-dashboard

# Install dependencies
sudo npm install

# Build the application
sudo npm run build

# Create logs directory
sudo mkdir -p logs
```

#### Environment Variables for Frontend:
Create `/root/xdial_dashboard/xdial-dashboard/.env.local`:
```env
NODE_ENV=production
DATABASE_URL=postgresql://username:password@localhost:5432/xdial_dashboard
NEXTAUTH_URL=http://test.dashboard.xlite.xdialnetworks.com
NEXTAUTH_SECRET=your-secret-key-here
```

### 5. Database Setup
```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE xdial_dashboard;
CREATE USER xdial_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE xdial_dashboard TO xdial_user;
\q
```

### 6. PM2 Configuration

#### Start Backend:
```bash
cd /root/xdial_dashboard/fetch_call_data
sudo pm2 start ecosystem.production.config.js
```

#### Start Frontend:
```bash
cd /root/xdial_dashboard/xdial-dashboard
sudo pm2 start ecosystem.production.config.js
```

#### Save PM2 configuration:
```bash
sudo pm2 save
sudo pm2 startup
```

### 7. Nginx Configuration

#### Copy nginx config:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/xdial-dashboard
sudo ln -sf /etc/nginx/sites-available/xdial-dashboard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

#### Test and reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 8. SSL Certificate (Optional but Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d test.dashboard.xlite.xdialnetworks.com -d test.fetchapi.dashboard.xdialnetworks.com
```

## Service Management

### PM2 Commands:
```bash
# View status
sudo pm2 status

# View logs
sudo pm2 logs

# Restart services
sudo pm2 restart all

# Stop services
sudo pm2 stop all

# Monitor resources
sudo pm2 monit
```

### Nginx Commands:
```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Monitoring and Logs

### Application Logs:
- Backend: `/root/xdial_dashboard/fetch_call_data/logs/`
- Frontend: `/root/xdial_dashboard/xdial-dashboard/logs/`

### Nginx Logs:
- Access: `/var/log/nginx/access.log`
- Error: `/var/log/nginx/error.log`

### PM2 Logs:
```bash
sudo pm2 logs xdial-backend
sudo pm2 logs xdial-frontend
```

## Troubleshooting

### Common Issues:

1. **Port conflicts**: Ensure ports 3000 and 8000 are available
2. **Database connection**: Verify DATABASE_URL in environment files
3. **Permission issues**: Ensure proper file permissions for logs directories
4. **Nginx configuration**: Always test with `sudo nginx -t` before reloading

### Health Checks:
- Frontend: `http://test.dashboard.xlite.xdialnetworks.com`
- Backend: `http://test.fetchapi.dashboard.xdialnetworks.com/docs`

## Security Considerations

1. **Firewall**: Configure UFW to allow only necessary ports
2. **Database**: Use strong passwords and limit access
3. **SSL**: Enable HTTPS for production
4. **Environment Variables**: Never commit sensitive data to version control
5. **File Permissions**: Restrict access to configuration files

## Backup Strategy

1. **Database**: Regular PostgreSQL backups
2. **Application**: Version control and deployment scripts
3. **Configuration**: Backup nginx and PM2 configurations
