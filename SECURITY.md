# Security Guide for JinieBotInterface

This document outlines the security measures implemented in JinieBotInterface and best practices for deployment.

## Table of Contents
1. [Security Features](#security-features)
2. [Environment Setup](#environment-setup)
3. [SSL/TLS Configuration](#ssltls-configuration)
4. [Production Deployment Checklist](#production-deployment-checklist)
5. [Security Best Practices](#security-best-practices)
6. [Incident Response](#incident-response)

## Security Features

### 1. HTTP Security Headers (Helmet.js)
- **Content Security Policy (CSP)**: Prevents XSS attacks by controlling resource loading
- **HTTP Strict Transport Security (HSTS)**: Forces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer Policy**: Controls referrer information

### 2. Rate Limiting
Protection against brute force and DDoS attacks:
- **Auth Routes**: 5 attempts per 15 minutes
- **API Routes**: 100 requests per 15 minutes
- **Strict Operations**: 3 attempts per hour

### 3. Session Security
- **Secure Cookies**: HTTPS-only in production
- **HttpOnly**: Prevents XSS cookie theft
- **SameSite**: CSRF protection
- **Session Regeneration**: New session ID after login
- **Session Destruction**: Complete cleanup on logout
- **MongoDB Session Store**: Persistent, secure storage

### 4. Input Validation & Sanitization
- **Express Validator**: Schema-based input validation
- **MongoDB Sanitization**: Prevents NoSQL injection attacks
- **HPP Protection**: Prevents HTTP parameter pollution
- **Body Size Limits**: 10KB limit to prevent DoS

### 5. Authentication & Authorization
- **OAuth 2.0**: Discord OAuth integration
- **Role-Based Access Control**: Owner/authorized user checks
- **Scope Validation**: Guild and service-level isolation
- **Session Scoping**: All requests scoped to user context

### 6. CORS Protection
- **Whitelist-based**: Only allowed origins can access API
- **Credentials Support**: Secure cookie transmission
- **Pre-flight Handling**: Proper OPTIONS request handling

## Environment Setup

### Development Environment

```bash
NODE_ENV=development
PORT=3000
SESSION_SECRET=dev_secret_change_in_production
DISCORD_CALLBACK_URL=http://localhost:3000/auth/callback
ALLOWED_ORIGINS=http://localhost:3000
```

### Production Environment

1. **Generate Secure Secrets**
```bash
# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate SESSION_CRYPTO_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

2. **Update .env file**
```bash
NODE_ENV=production
PORT=443
SESSION_SECRET=<generated_64_char_hex_string>
SESSION_CRYPTO_SECRET=<another_generated_64_char_hex_string>
DISCORD_CALLBACK_URL=https://yourdomain.com/auth/callback
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
COOKIE_DOMAIN=.yourdomain.com
```

3. **Discord OAuth Configuration**
   - Update Discord application settings
   - Add production callback URL
   - Ensure OAuth2 redirect URIs match exactly

## SSL/TLS Configuration

### Option 1: Reverse Proxy (Recommended)

Use nginx or Apache as a reverse proxy with Let's Encrypt SSL:

#### Nginx Configuration Example
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

#### Setup Let's Encrypt (Certbot)
```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (check)
sudo certbot renew --dry-run
```

### Option 2: Node.js HTTPS Server

For direct HTTPS handling:

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem'),
  ca: fs.readFileSync('/path/to/chain.pem') // Optional
};

https.createServer(options, app).listen(443, () => {
  console.log('🔒 HTTPS Server running on port 443');
});
```

## Production Deployment Checklist

### Pre-Deployment
- [ ] All environment variables properly configured
- [ ] Secure random strings generated for sessions
- [ ] Discord OAuth callback URL updated
- [ ] SSL/TLS certificates installed and valid
- [ ] Database connection secured (IP whitelist, authentication)
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] NODE_ENV set to "production"
- [ ] ALLOWED_ORIGINS configured with production domains

### Security Configuration
- [ ] Helmet middleware enabled
- [ ] Rate limiting configured
- [ ] CORS whitelist active
- [ ] Session cookies set to secure/httpOnly
- [ ] Input validation on all routes
- [ ] MongoDB sanitization active
- [ ] Security logging enabled

### Monitoring
- [ ] Error logging configured
- [ ] Security event monitoring
- [ ] Failed login attempt tracking
- [ ] Rate limit breach alerts
- [ ] SSL certificate expiration monitoring

### Backup & Recovery
- [ ] Database backup automated
- [ ] Session store backup plan
- [ ] Disaster recovery procedure documented
- [ ] Rollback plan prepared

## Security Best Practices

### 1. Keep Dependencies Updated
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Update all packages
npm update
```

### 2. Environment Variables
- Never commit `.env` file to version control
- Use different secrets for development/production
- Rotate secrets periodically (every 90 days)
- Store production secrets in secure vault (AWS Secrets Manager, etc.)

### 3. Database Security
- Use strong MongoDB passwords
- Enable IP whitelist
- Use connection string encryption
- Enable MongoDB authentication
- Regular backups with encryption

### 4. Session Management
- Set reasonable session timeouts (24 hours default)
- Implement "Remember Me" carefully
- Destroy sessions on logout
- Regenerate session IDs after authentication
- Monitor active sessions

### 5. Logging & Monitoring
Monitor these events:
- Failed authentication attempts
- Rate limit breaches
- Validation errors
- Suspicious patterns (SQL injection attempts, etc.)
- Unusual API access patterns

### 6. Regular Security Audits
- Review access logs weekly
- Check for unauthorized access attempts
- Audit user permissions quarterly
- Update security dependencies monthly
- Penetration testing annually

## Incident Response

### If You Suspect a Breach

1. **Immediate Actions**
   - Disconnect compromised systems
   - Change all passwords and secrets
   - Review access logs
   - Identify scope of breach

2. **Investigation**
   - Check MongoDB access logs
   - Review authentication logs
   - Identify affected users
   - Document timeline

3. **Recovery**
   - Rotate all secrets (SESSION_SECRET, etc.)
   - Update Discord OAuth credentials
   - Force logout all users (clear sessions)
   - Apply security patches
   - Restore from clean backup if needed

4. **Post-Incident**
   - Document incident details
   - Update security procedures
   - Notify affected users if required
   - Implement additional safeguards

## Common Security Scenarios

### Handling Rate Limit Bypass Attempts
The app logs rate limit violations. Monitor for:
- Multiple IPs from same origin
- Distributed attacks
- Pattern-based attacks

### SQL/NoSQL Injection Attempts
Automatic detection and logging of:
- `$where`, `$ne`, `$gt` operators in input
- Script tags in input
- JavaScript protocols in input

### Session Hijacking Prevention
- Secure, httpOnly cookies
- SameSite=strict in production
- Session regeneration on login
- IP address validation (optional, add if needed)

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)

## Support

For security issues, contact the development team immediately. Do not disclose vulnerabilities publicly.

---

**Last Updated**: November 21, 2025
**Version**: 1.0
