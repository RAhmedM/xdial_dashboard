module.exports = {
  apps: [{
    name: 'xdial-frontend',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/xdial-dashboard/xdial_dashboard/xdial-dashboard',
    interpreter: 'none',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/www/xdial-dashboard/xdial_dashboard/xdial-dashboard/logs/frontend-error.log',
    out_file: '/var/www/xdial-dashboard/xdial_dashboard/xdial-dashboard/logs/frontend-out.log',
    log_file: '/var/www/xdial-dashboard/xdial_dashboard/xdial-dashboard/logs/frontend-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
