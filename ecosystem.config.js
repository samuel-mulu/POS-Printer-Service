module.exports = {
  apps: [
    {
      name: 'pos-printer-service',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

