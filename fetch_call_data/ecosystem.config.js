module.exports = {
  apps: [{
    name: 'calls-api',
    script: 'server-production.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Monitoring and auto-restart settings
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto-restart on file changes (disable in production)
    watch: false,
    
    // Environment variables
    env_file: '.env'
  }]
};
