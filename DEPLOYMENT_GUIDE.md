# Production Deployment Guide

This guide walks you through deploying JinieBotInterface to production with all security features enabled.

## Prerequisites

- [ ] Linux server (Ubuntu 20.04+ recommended)
- [ ] Domain name pointing to your server
- [ ] MongoDB Atlas account or MongoDB instance
- [ ] Discord application configured
- [ ] Basic knowledge of Linux command line

## Step-by-Step Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+ (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install git
sudo apt install -y git

# Install nginx
sudo apt install -y nginx

# Configure firewall
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 2. Clone and Setup Application

```bash
# Create application directory
sudo mkdir -p /var/www/jiniebot
sudo chown $USER:$USER /var/www/jiniebot

# Clone repository
cd /var/www/jiniebot
git clone <your-repository-url> .

# Install dependencies
npm install

# Verify no vulnerabilities
npm audit
```

### 3. Configure Environment

```bash
# Copy production template
cp .env.production.template .env

# Generate secure secrets
npm run security:generate

# Edit .env file with your values
nano .env
```

Required values:
```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=<your-generated-secret>
SESSION_CRYPTO_SECRET=<your-generated-secret>
DISCORD_CLIENT_ID=<your-discord-client-id>
DISCORD_CLIENT_SECRET=<your-discord-client-secret>
DISCORD_CALLBACK_URL=https://yourdomain.com/auth/callback
MONGO_URI=<your-mongodb-connection-string>
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
COOKIE_DOMAIN=.yourdomain.com
```

Save and exit (Ctrl+X, Y, Enter)

```bash
# Validate configuration
npm run security:validate

# Review security checklist
npm run security:checklist
```

### 4. Setup SSL/TLS with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Stop nginx temporarily
sudo systemctl stop nginx

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Verify certificate files
sudo ls -la /etc/letsencrypt/live/yourdomain.com/
# Should see: fullchain.pem, privkey.pem, cert.pem, chain.pem
```

### 5. Configure nginx as Reverse Proxy

```bash
# Create nginx configuration
sudo nano /etc/nginx/sites-available/jiniebot
```

Paste this configuration:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers (additional to Helmet.js)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/jiniebot_access.log;
    error_log /var/log/nginx/jiniebot_error.log;

    # Client body size limit
    client_max_body_size 10M;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # WebSocket support (if needed in future)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        
        proxy_cache_bypass $http_upgrade;
    }

    # Static files (if serving directly, not through Node)
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|webp)$ {
        proxy_pass http://localhost:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Replace `yourdomain.com` with your actual domain.

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/jiniebot /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# If OK, restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 6. Setup PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application with PM2
cd /var/www/jiniebot
pm2 start server.js --name jiniebot

# Configure PM2 startup script
pm2 startup
# Run the command that PM2 outputs

# Save PM2 configuration
pm2 save

# Check status
pm2 status
pm2 logs jiniebot
```

### 7. Configure MongoDB

If using MongoDB Atlas:

1. Go to MongoDB Atlas dashboard
2. Network Access → Add IP Address → Add your server's IP
3. Database Access → Ensure user has proper permissions
4. Get connection string and add to `.env`

Security settings:
- Enable authentication
- Use strong passwords (20+ characters)
- IP whitelist only your server
- Enable encryption at rest
- Regular backups enabled

### 8. Update Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. OAuth2 → Redirects → Add: `https://yourdomain.com/auth/callback`
4. Save changes

### 9. Test Deployment

```bash
# Check if application is running
pm2 status

# Check logs
pm2 logs jiniebot --lines 50

# Test locally
curl http://localhost:3000

# Test externally
curl https://yourdomain.com

# Test SSL
curl -I https://yourdomain.com
```

Visit `https://yourdomain.com` in browser:
- [ ] Site loads with HTTPS (green lock icon)
- [ ] Login redirects to Discord
- [ ] Authentication succeeds
- [ ] Dashboard loads correctly
- [ ] Map renders properly

### 10. Setup SSL Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically creates renewal cron job
# Verify it exists
sudo systemctl list-timers | grep certbot
```

### 11. Setup Monitoring and Logging

```bash
# Create log directory
sudo mkdir -p /var/log/jiniebot
sudo chown $USER:$USER /var/log/jiniebot

# Configure PM2 logging
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

Optional: Setup monitoring with PM2 Plus
```bash
pm2 link <secret_key> <public_key>
# Get keys from https://app.pm2.io/
```

### 12. Setup Backups

```bash
# Create backup script
nano /home/$USER/backup-jiniebot.sh
```

Paste:
```bash
#!/bin/bash
BACKUP_DIR="/home/$USER/backups/jiniebot"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup .env file
cp /var/www/jiniebot/.env $BACKUP_DIR/.env.$DATE

# Backup nginx config
sudo cp /etc/nginx/sites-available/jiniebot $BACKUP_DIR/nginx.$DATE

# Keep only last 7 backups
ls -t $BACKUP_DIR/.env.* | tail -n +8 | xargs -r rm
ls -t $BACKUP_DIR/nginx.* | tail -n +8 | xargs -r rm

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /home/$USER/backup-jiniebot.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/$USER/backup-jiniebot.sh >> /var/log/backup.log 2>&1
```

### 13. Final Security Checks

```bash
# Run security checklist
cd /var/www/jiniebot
npm run security:checklist

# Check firewall
sudo ufw status

# Check nginx
sudo nginx -t
sudo systemctl status nginx

# Check application
pm2 status
pm2 logs jiniebot --lines 20

# Test rate limiting
# Try to authenticate 6 times rapidly - should be blocked after 5

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

## Post-Deployment

### Regular Maintenance Tasks

**Daily**
- Check PM2 logs: `pm2 logs jiniebot --lines 50`
- Monitor disk space: `df -h`

**Weekly**
- Review security logs in application
- Check nginx error logs: `sudo tail -100 /var/log/nginx/jiniebot_error.log`
- Review failed authentication attempts

**Monthly**
- Update dependencies: `npm update && npm audit fix`
- Review and rotate logs
- Check SSL certificate expiry: `sudo certbot certificates`

**Quarterly**
- Rotate SESSION_SECRET and SESSION_CRYPTO_SECRET
- Review user access and permissions
- Update system packages: `sudo apt update && sudo apt upgrade`

### Useful PM2 Commands

```bash
pm2 list              # List all processes
pm2 logs jiniebot     # View logs (Ctrl+C to exit)
pm2 restart jiniebot  # Restart application
pm2 stop jiniebot     # Stop application
pm2 delete jiniebot   # Remove from PM2
pm2 monit             # Monitor resources
pm2 describe jiniebot # Show detailed info
```

### Updating the Application

```bash
# Navigate to directory
cd /var/www/jiniebot

# Pull latest changes
git pull

# Install any new dependencies
npm install

# Run security validation
npm run security:validate
npm audit fix

# Restart application
pm2 restart jiniebot

# Check logs
pm2 logs jiniebot --lines 50
```

### Troubleshooting

**Application won't start**
```bash
# Check logs
pm2 logs jiniebot --lines 100

# Check environment
npm run security:validate

# Check port availability
sudo netstat -tlnp | grep 3000
```

**SSL issues**
```bash
# Check certificate
sudo certbot certificates

# Test nginx config
sudo nginx -t

# Renew manually if needed
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

**Authentication fails**
```bash
# Verify Discord callback URL matches exactly
# Check .env file DISCORD_CALLBACK_URL
# Check Discord Developer Portal redirect URIs
# Check browser console for CORS errors
```

**Database connection issues**
```bash
# Test MongoDB connection
mongosh "<your-connection-string>"

# Check IP whitelist in MongoDB Atlas
# Verify connection string in .env
```

## Security Incident Response

If you suspect a security breach:

1. **Immediate Actions**
   ```bash
   # Stop application
   pm2 stop jiniebot
   
   # Change all secrets
   npm run security:generate
   # Update .env with new secrets
   
   # Clear all sessions
   # (Connect to MongoDB and clear sessions collection)
   ```

2. **Investigation**
   ```bash
   # Check access logs
   sudo tail -1000 /var/log/nginx/jiniebot_access.log
   
   # Check application logs
   pm2 logs jiniebot --lines 1000
   
   # Check system logs
   sudo journalctl -u nginx -n 1000
   ```

3. **Recovery**
   ```bash
   # Update Discord OAuth credentials
   # Rotate MongoDB password
   # Restart application
   pm2 restart jiniebot
   ```

## Support

For issues during deployment:
- Review logs: `pm2 logs jiniebot`
- Check nginx logs: `sudo tail -100 /var/log/nginx/jiniebot_error.log`
- Verify configuration: `npm run security:validate`
- Review security documentation: `SECURITY.md`

---

**Deployment Date**: ___________  
**Deployed By**: ___________  
**Server IP**: ___________  
**Domain**: ___________  
**PM2 Process ID**: ___________  
