module.exports = {
  apps: [{
    name: 'xdial-backend',
    script: 'scripts/start.py',
    args: 'prod',
    cwd: '/home/doc/Projects/xdial_dashboard/fetch_call_data',
    interpreter: 'python3',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      ENVIRONMENT: 'production',
      PYTHONPATH: '/root/test_dashboard/xdial_dashboard/fetch_call_data'
    },
    error_file: '/root/test_dashboard/xdial_dashboard/fetch_call_data/logs/backend-error.log',
    out_file: '/root/test_dashboard/xdial_dashboard/fetch_call_data/logs/backend-out.log',
    log_file: '/root/test_dashboard/xdial_dashboard/fetch_call_data/logs/backend-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};