# Security Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate secure secrets
npm run security:generate

# 3. Configure .env file
# Edit .env with your MongoDB URI, Discord credentials, etc.

# 4. Validate configuration
npm run security:validate

# 5. Run development server
npm run dev
```

## 🔒 Security Features Implemented

### ✅ HTTP Security Headers (Helmet.js)
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME sniffing prevention)

### ✅ Rate Limiting
- Auth routes: 5 attempts / 15 min
- API routes: 100 requests / 15 min
- Strict ops: 3 attempts / 60 min

### ✅ Input Validation & Sanitization
- Express-validator for schema validation
- MongoDB query sanitization
- HTTP parameter pollution protection
- 10KB body size limit

### ✅ Session Security
- Secure & httpOnly cookies
- SameSite=strict (production)
- Session regeneration on login
- Session destruction on logout
- Encrypted MongoDB session store

### ✅ Authentication & Authorization
- Discord OAuth 2.0
- Role-based access control
- Guild/service scope isolation
- Security logging

### ✅ CORS Protection
- Whitelist-based origins
- Credentials support
- Production-ready configuration

## 🛠️ NPM Scripts

```bash
npm start              # Start production server
npm run dev            # Start development server
npm run prod           # Start with NODE_ENV=production

npm run security:generate   # Generate secure secrets
npm run security:validate   # Validate .env file
npm run security:checklist  # Show deployment checklist

npm audit              # Check for vulnerabilities
npm audit fix          # Fix vulnerabilities automatically
```

## ⚙️ Environment Variables

### Required for Production
```bash
NODE_ENV=production
SESSION_SECRET=<64-char-hex-string>
SESSION_CRYPTO_SECRET=<64-char-hex-string>
DISCORD_CLIENT_ID=<your-client-id>
DISCORD_CLIENT_SECRET=<your-client-secret>
DISCORD_CALLBACK_URL=https://yourdomain.com/auth/callback
MONGO_URI=<mongodb-connection-string>
ALLOWED_ORIGINS=https://yourdomain.com
```

## 🔐 Generate Secure Secrets

### Method 1: Use our script
```bash
npm run security:generate
```

### Method 2: Node.js command
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Method 3: OpenSSL
```bash
openssl rand -hex 64
```

## 🌐 SSL/TLS Setup (nginx example)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

## 📋 Pre-Deployment Checklist

### Security
- [ ] `npm run security:validate` passes
- [ ] Secrets are 64+ characters
- [ ] NODE_ENV=production
- [ ] ALLOWED_ORIGINS configured
- [ ] SSL/TLS certificate installed

### Configuration
- [ ] Discord OAuth callback updated
- [ ] MongoDB IP whitelist configured
- [ ] Firewall rules applied (80, 443 only)
- [ ] .env file not in version control

### Testing
- [ ] Authentication flow works
- [ ] Rate limiting functional
- [ ] CORS configured correctly
- [ ] Session persistence working

## 🚨 Common Issues & Solutions

### Authentication Fails
```bash
# Check Discord OAuth settings
- Verify callback URL matches exactly
- Ensure scopes include "identify" and "guilds"
- Check user has access to authorized guild
```

### Rate Limiting Triggered
```bash
# Adjust limits in config/security.js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,  // Increase if needed
});
```

### CORS Error
```bash
# Add origin to .env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Session Not Persisting
```bash
# Check MongoDB connection
# Verify SESSION_SECRET is set
# Clear browser cookies
# Check cookie settings (secure flag in production)
```

## 🔍 Monitoring & Logs

### Security Events Logged
- Failed authentication attempts
- Rate limit violations
- Suspicious input patterns (injection attempts)
- Validation errors

### Log Locations
```bash
# Console output (default)
console.log("✅ Success", "⚠️ Warning", "❌ Error", "🚨 Security")

# To enable file logging, set in .env:
LOG_FILE_PATH=/var/log/jiniebot/app.log
```

## 📚 Additional Resources

- Full Documentation: `SECURITY.md`
- Configuration Template: `.env.production.template`
- Project README: `README.md`

## 🆘 Security Incident Response

1. **Immediate**: Disconnect compromised systems
2. **Rotate**: All secrets and passwords
3. **Review**: Access logs and session store
4. **Force**: User logouts (clear sessions)
5. **Document**: Incident timeline
6. **Update**: Security procedures

## 📞 Support

- General Issues: Open GitHub issue
- Security Issues: Email security contact (do not open public issue)

---

**Remember**: Security is an ongoing process, not a one-time setup. Keep dependencies updated and monitor logs regularly.
