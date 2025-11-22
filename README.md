# JinieBotInterface

Web-based dashboard for DayZ server management via Discord bot integration.

## Features

- 🗺️ Interactive map interface with Leaflet.js
- 🔐 Secure Discord OAuth authentication
- 🎯 Real-time player tracking and base monitoring
- 🛡️ Multi-guild and multi-service support
- 📊 Monitor zones and active object visualization
- 🔒 Enterprise-grade security implementation

## Security Features

This application implements industry-standard security practices:

- **HTTP Security Headers** (Helmet.js) - XSS, clickjacking, and MIME-sniffing protection
- **Rate Limiting** - Brute force and DDoS attack prevention
- **CORS Protection** - Whitelist-based origin control
- **Input Validation** - Express-validator schema validation
- **NoSQL Injection Prevention** - MongoDB query sanitization
- **Session Security** - Secure cookies, httpOnly, SameSite, session regeneration
- **Authentication** - OAuth 2.0 with Discord, role-based access control
- **Security Logging** - Suspicious activity detection and monitoring

For detailed security information, see [SECURITY.md](SECURITY.md).

## Prerequisites

- Node.js 14+ and npm
- MongoDB database (MongoDB Atlas recommended)
- Discord application with OAuth2 configured

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd JinieBotInterface
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy template to .env
   cp "template ENV" .env
   
   # Generate secure secrets
   npm run security:generate
   ```

4. **Update .env with your values**
   - Add your MongoDB connection string
   - Add Discord OAuth credentials
   - Configure other environment-specific settings

5. **Verify security configuration**
   ```bash
   npm run security:validate
   ```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment (development/production) | Yes | development |
| `PORT` | Server port | Yes | 3000 |
| `SESSION_SECRET` | Session encryption secret (64+ chars) | Yes | - |
| `SESSION_CRYPTO_SECRET` | Additional encryption key | Yes | - |
| `DISCORD_CLIENT_ID` | Discord OAuth client ID | Yes | - |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret | Yes | - |
| `DISCORD_CALLBACK_URL` | OAuth callback URL | Yes | - |
| `MONGO_URI` | MongoDB connection string | Yes | - |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | Production | localhost |
| `COOKIE_DOMAIN` | Cookie domain for subdomains | Optional | - |

### Discord OAuth Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to OAuth2 settings
4. Add redirect URI: `http://localhost:3000/auth/callback` (development)
5. Copy Client ID and Client Secret to `.env`

### MongoDB Setup

1. Create a MongoDB Atlas account or use your own MongoDB instance
2. Create a database user with appropriate permissions
3. Whitelist your application server IP
4. Copy connection string to `MONGO_URI` in `.env`

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
# Ensure environment is configured for production
NODE_ENV=production npm start
```

### Security Commands
```bash
# Generate new secure secrets
npm run security:generate

# Validate environment configuration
npm run security:validate

# Show security checklist
npm run security:checklist

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

## Production Deployment

### Pre-Deployment Checklist

1. **Security Configuration**
   - [ ] Run `npm run security:checklist`
   - [ ] Generate production secrets (64+ characters)
   - [ ] Update Discord OAuth callback URL
   - [ ] Configure ALLOWED_ORIGINS
   - [ ] Set NODE_ENV=production

2. **SSL/TLS Setup**
   - [ ] Install SSL certificate (Let's Encrypt recommended)
   - [ ] Configure reverse proxy (nginx/Apache)
   - [ ] Enable HTTPS redirects
   - [ ] Test SSL configuration

3. **Database Security**
   - [ ] Enable MongoDB authentication
   - [ ] Configure IP whitelist
   - [ ] Use strong passwords
   - [ ] Enable encryption at rest

4. **Server Hardening**
   - [ ] Configure firewall (ports 80, 443 only)
   - [ ] Set up automated backups
   - [ ] Configure logging
   - [ ] Enable monitoring

### Deployment with nginx (Recommended)

See [SECURITY.md](SECURITY.md) for complete nginx configuration example.

### Environment-Specific Configuration

```bash
# Development
cp .env.development.template .env

# Production
cp .env.production.template .env
```

## Project Structure

```
JinieBotInterface/
├── config/
│   ├── passport.js          # Discord OAuth strategy
│   ├── security.js          # Security middleware
│   └── validation.js        # Input validation rules
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── api.js              # API endpoints
│   ├── dashboard.js        # Dashboard routes
│   └── selectGuildService.js # Guild/service selection
├── schemas/
│   ├── globals/            # Global configuration
│   ├── userData/           # User and base data
│   ├── gameData/           # Game objects and zones
│   └── economy/            # Shop and purchases
├── public/
│   ├── js/
│   │   ├── map/           # Map initialization and handlers
│   │   └── izurvive/      # Coordinate transformation
│   ├── css/               # Stylesheets
│   └── dayzdata/          # Static game data
├── views/                  # EJS templates
├── server.js              # Main application file
├── generate-secrets.js    # Security helper script
├── SECURITY.md           # Security documentation
└── package.json          # Dependencies and scripts
```

## API Endpoints

All API endpoints require authentication and are scoped to user's guild/service.

- `GET /api/recent-players` - Fetch recent player positions
- `GET /api/bases` - Fetch player bases
- `GET /api/spawners` - Fetch active object spawners
- `GET /api/monitorZones` - Fetch monitor zones

Rate limits apply to all endpoints (100 requests per 15 minutes).

## Security Best Practices

1. **Never commit sensitive files**
   - `.env` is in `.gitignore`
   - Never commit secrets or keys
   - Use environment variables for all sensitive data

2. **Keep dependencies updated**
   ```bash
   npm audit
   npm update
   ```

3. **Rotate secrets regularly**
   - Change SESSION_SECRET every 90 days
   - Update Discord OAuth secrets if compromised
   - Rotate database passwords quarterly

4. **Monitor logs**
   - Check for failed authentication attempts
   - Monitor rate limit violations
   - Track suspicious input patterns

5. **Backup regularly**
   - Automated database backups
   - Configuration backups
   - Session store backups

For complete security guidelines, see [SECURITY.md](SECURITY.md).

## Troubleshooting

### Authentication Issues
- Verify Discord OAuth callback URL matches exactly
- Check Discord application scopes include "identify" and "guilds"
- Ensure user has access to at least one authorized guild

### Session Issues
- Verify SESSION_SECRET is set and secure
- Check MongoDB connection for session store
- Clear browser cookies and try again

### Rate Limiting
- Default: 100 API requests per 15 minutes
- Auth routes: 5 attempts per 15 minutes
- Adjust in `config/security.js` if needed

### CORS Errors
- Add your domain to ALLOWED_ORIGINS
- Verify protocol (http/https) matches
- Check browser console for specific origin

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run security validation: `npm run security:validate`
5. Submit a pull request

## License

[Add your license here]

## Support

For security issues, please email [security contact] instead of opening a public issue.

For general support, open an issue on GitHub.

## Acknowledgments

- [Leaflet.js](https://leafletjs.com/) - Interactive map library
- [iZurvive](https://www.izurvive.com/) - DayZ map tiles and coordinate system
- [Express.js](https://expressjs.com/) - Web framework
- [Passport.js](http://www.passportjs.org/) - Authentication middleware

---

**Security Notice**: This application handles sensitive user data. Always follow security best practices and keep dependencies updated.
