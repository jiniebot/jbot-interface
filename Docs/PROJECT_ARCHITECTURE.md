# JinieBotInterface - Project Architecture

**Version**: 2.0  
**Date**: November 21, 2025  
**Status**: Design & Implementation Phase

## Overview

This document outlines the complete architecture for the expanded JinieBotInterface dashboard, designed for efficiency, scalability, and user experience.

## User Flow

```
Landing Page
    ├─→ Login (OAuth) → Main Dashboard
    ├─→ Sign Up → Patreon
    ├─→ Join Discord → Discord Invite
    └─→ YouTube → YouTube Channel

Main Dashboard
    ├─→ Map View (with markers)
    │   ├─→ Click Marker → Show Info in Panels → Edit Page
    │   └─→ Layer Controls
    ├─→ Left Panel (Info Display)
    ├─→ Right Panel (Details/Actions)
    ├─→ Bottom Toolbar
    │   ├─→ Store Management
    │   ├─→ Quest Management
    │   ├─→ Log Viewer
    │   └─→ Spawner Queue
    └─→ Global Menu (...)
        ├─→ Logout
        ├─→ Switch Service
        ├─→ Patreon
        └─→ Account Settings
```

## Architecture Components

### Frontend Architecture

```
public/
├── css/
│   ├── landing.css           # Landing page styles
│   ├── dashboard.css         # Main dashboard styles
│   ├── panels.css            # Floating panel styles
│   ├── toolbar.css           # Bottom toolbar styles
│   ├── edit-pages.css        # Edit page styles
│   └── components.css        # Reusable UI components
├── js/
│   ├── components/
│   │   ├── FloatingPanel.js  # Left/Right panel component
│   │   ├── Toolbar.js        # Bottom toolbar component
│   │   ├── GlobalMenu.js     # ... menu component
│   │   ├── MapMarker.js      # Custom marker handling
│   │   └── Modal.js          # Modal dialogs
│   ├── pages/
│   │   ├── landing.js        # Landing page logic
│   │   ├── dashboard.js      # Main dashboard (refactored)
│   │   ├── storeManager.js   # Store management
│   │   ├── questManager.js   # Quest management
│   │   ├── logViewer.js      # Log viewing
│   │   ├── spawnerQueue.js   # Spawner queue editor
│   │   └── accountSettings.js # Account settings
│   ├── map/
│   │   ├── initMap.js        # Map initialization
│   │   ├── markers/
│   │   │   ├── players.js    # Player markers
│   │   │   ├── factions.js   # Faction markers
│   │   │   ├── spawners.js   # Spawner markers
│   │   │   ├── zones.js      # Zone markers
│   │   │   ├── raids.js      # Raid markers
│   │   │   ├── bases.js      # Base markers
│   │   │   ├── bounties.js   # Bounty markers
│   │   │   ├── events.js     # Event markers
│   │   │   ├── flags.js      # Flag markers
│   │   │   └── quests.js     # Quest markers
│   │   └── markerManager.js  # Centralized marker control
│   ├── api/
│   │   └── client.js         # API client with fetch wrappers
│   └── utils/
│       ├── helpers.js        # Utility functions
│       ├── validation.js     # Client-side validation
│       └── cache.js          # Client-side caching
└── views/
    ├── landing.ejs           # New landing page
    ├── dashboard.ejs         # Refactored dashboard
    ├── store.ejs             # Store management page
    ├── quests.ejs            # Quest management page
    ├── logs.ejs              # Log viewer page
    ├── spawner-queue.ejs     # Spawner queue page
    ├── account-settings.ejs  # Account settings page
    └── partials/
        ├── header.ejs        # Common header with ... menu
        ├── footer.ejs        # Common footer
        ├── sidebar.ejs       # Reusable sidebar
        └── modal.ejs         # Modal template
```

### Backend Architecture

```
routes/
├── auth.js               # Authentication (OAuth, signup)
├── api/
│   ├── players.js        # Player data endpoints
│   ├── factions.js       # Faction data endpoints
│   ├── spawners.js       # Spawner data endpoints
│   ├── zones.js          # Zone data endpoints
│   ├── raids.js          # Raid data endpoints
│   ├── bases.js          # Base data endpoints
│   ├── bounties.js       # Bounty data endpoints
│   ├── events.js         # Event data endpoints
│   ├── flags.js          # Flag data endpoints
│   ├── quests.js         # Quest data endpoints
│   ├── shop.js           # Shop/store endpoints
│   ├── logs.js           # Log data endpoints
│   └── spawnerQueue.js   # Spawner queue endpoints
├── pages/
│   ├── landing.js        # Landing page route
│   ├── dashboard.js      # Dashboard route
│   ├── store.js          # Store page route
│   ├── quests.js         # Quest page route
│   ├── logs.js           # Logs page route
│   ├── spawnerQueue.js   # Spawner queue route
│   └── accountSettings.js # Account settings route
└── middleware/
    ├── auth.js           # Authentication middleware
    ├── validation.js     # Request validation
    └── pagination.js     # Pagination helper

schemas/
├── users/
│   └── User.js           # User account schema
├── gameData/
│   ├── Player.js         # Player data (RecentPlayers enhanced)
│   ├── Faction.js        # Faction data (FactionProfile enhanced)
│   ├── Spawner.js        # Active object spawners (enhanced)
│   ├── Zone.js           # Monitor zones (enhanced)
│   ├── Raid.js           # Raid data (enhanced)
│   ├── Base.js           # Base data (BaseProfile enhanced)
│   ├── Bounty.js         # Bounty system
│   ├── DynamicEvent.js   # Dynamic events
│   ├── Flag.js           # Flag data (enhanced)
│   └── Quest.js          # Quest data (enhanced)
├── economy/
│   ├── ShopItem.js       # Shop items (enhanced)
│   ├── Purchase.js       # Purchase history (enhanced)
│   └── Transaction.js    # Transaction log
└── system/
    ├── Log.js            # System logs
    └── SpawnerQueue.js   # Spawner queue items
```

## Data Models

### Enhanced Schemas

#### User Schema
```javascript
{
  discordId: String,          // Discord user ID
  username: String,           // Discord username
  email: String,              // Optional email
  avatar: String,             // Discord avatar URL
  patreonTier: String,        // Patreon subscription tier
  patreonId: String,          // Patreon user ID
  createdAt: Date,
  lastLogin: Date,
  preferences: {
    theme: String,            // dark/light
    mapDefaults: Object,      // Default map settings
    notifications: Boolean
  }
}
```

#### Bounty Schema (New)
```javascript
{
  guildID: String,
  serviceId: String,
  targetUserId: String,
  targetGamertag: String,
  reward: Number,
  description: String,
  status: String,            // active, claimed, expired
  createdBy: String,
  createdAt: Date,
  expiresAt: Date,
  location: [Number],        // Last known location
  claimedBy: String,
  claimedAt: Date
}
```

#### DynamicEvent Schema (New)
```javascript
{
  guildID: String,
  serviceId: String,
  eventType: String,         // airdrop, heli_crash, convoy, etc.
  location: [Number],
  radius: Number,
  isActive: Boolean,
  startTime: Date,
  duration: Number,          // minutes
  rewards: [String],
  participants: [String],
  status: String             // scheduled, active, completed
}
```

#### Enhanced Faction Schema
```javascript
{
  guildID: String,
  serviceId: String,
  factionId: String,
  name: String,
  tag: String,               // 2-5 character tag
  color: String,             // Hex color for map
  leader: String,            // Discord user ID
  members: [String],         // Discord user IDs
  allies: [String],          // Faction IDs
  enemies: [String],         // Faction IDs
  territory: {
    bases: [String],         // Base IDs
    zones: [String]          // Zone IDs
  },
  stats: {
    kills: Number,
    deaths: Number,
    raidWins: Number,
    raidLosses: Number
  },
  createdAt: Date,
  lastActive: Date
}
```

## API Endpoints

### Authentication
```
POST   /auth/signup              # Create new account (redirect to Patreon)
GET    /auth/login               # OAuth login
GET    /auth/callback            # OAuth callback
GET    /auth/logout              # Logout
```

### User Management
```
GET    /api/users/me             # Get current user info
PATCH  /api/users/me             # Update user preferences
GET    /api/users/authorized     # Get authorized users for service
POST   /api/users/authorized     # Add authorized user (owner only)
DELETE /api/users/authorized/:id # Remove authorized user
POST   /api/users/leave-service  # Remove self from service
```

### Map Data (All require auth + scope)
```
GET    /api/players              # Get all players
GET    /api/players/:id          # Get specific player
GET    /api/factions             # Get all factions
GET    /api/factions/:id         # Get specific faction
POST   /api/factions             # Create faction
PATCH  /api/factions/:id         # Update faction
DELETE /api/factions/:id         # Delete faction
GET    /api/spawners             # Get all spawners
GET    /api/spawners/:id         # Get specific spawner
POST   /api/spawners             # Create spawner
PATCH  /api/spawners/:id         # Update spawner
DELETE /api/spawners/:id         # Delete spawner
GET    /api/zones                # Get all zones
GET    /api/zones/:id            # Get specific zone
POST   /api/zones                # Create zone
PATCH  /api/zones/:id            # Update zone
DELETE /api/zones/:id            # Delete zone
GET    /api/raids                # Get all raids
GET    /api/raids/:id            # Get specific raid
GET    /api/bases                # Get all bases
GET    /api/bases/:id            # Get specific base
PATCH  /api/bases/:id            # Update base
GET    /api/bounties             # Get all bounties
GET    /api/bounties/:id         # Get specific bounty
POST   /api/bounties             # Create bounty
PATCH  /api/bounties/:id         # Update bounty
DELETE /api/bounties/:id         # Delete bounty
GET    /api/events               # Get all dynamic events
GET    /api/events/:id           # Get specific event
POST   /api/events               # Create event
PATCH  /api/events/:id           # Update event
DELETE /api/events/:id           # Delete event
GET    /api/flags                # Get all flags
GET    /api/quests               # Get all quests
GET    /api/quests/:id           # Get specific quest
POST   /api/quests               # Create quest
PATCH  /api/quests/:id           # Update quest
DELETE /api/quests/:id           # Delete quest
```

### Store Management
```
GET    /api/shop/items           # Get all shop items
GET    /api/shop/items/:id       # Get specific item
POST   /api/shop/items           # Create item (owner only)
PATCH  /api/shop/items/:id       # Update item (owner only)
DELETE /api/shop/items/:id       # Delete item (owner only)
GET    /api/shop/categories      # Get all categories
GET    /api/shop/purchases       # Get purchase history
```

### Quest Management
```
GET    /api/quests/templates     # Get quest templates
POST   /api/quests/from-template # Create quest from template
GET    /api/quests/active        # Get active quests
GET    /api/quests/completed     # Get completed quests
```

### Logs
```
GET    /api/logs                 # Get logs with filtering
GET    /api/logs/export          # Export logs as JSON/CSV
```

### Spawner Queue
```
GET    /api/spawner-queue        # Get queue items
POST   /api/spawner-queue        # Add to queue
PATCH  /api/spawner-queue/:id    # Update queue item
DELETE /api/spawner-queue/:id    # Remove from queue
POST   /api/spawner-queue/sync   # Sync with JinieBot
```

## UI Components

### Floating Panels

**Left Panel**: Information Display
- Shows details of selected map item
- Read-only information
- Quick stats
- Related items

**Right Panel**: Actions & Controls
- Edit button → navigate to edit page
- Quick actions (delete, duplicate, etc.)
- History/activity log
- Related settings

**Panel Features**:
- Adjustable opacity (0.8 default)
- Collapsible/expandable
- Draggable
- Resizable
- Remember state in localStorage

### Bottom Toolbar

**Buttons**:
- 🏪 Store Management
- 📜 Quest Management
- 📋 Log Viewer
- 🔄 Spawner Queue
- 🗺️ Map Settings (toggle layers)

**Toolbar Features**:
- Fixed position
- Icon + text labels
- Active state highlighting
- Tooltips

### Global Menu (... icon)

**Position**: Top-right corner
**Menu Items**:
- 👤 Account Settings
- 🔄 Switch Service
- 💰 Patreon
- 🚪 Logout

**Features**:
- Dropdown menu
- Always visible
- Accessible from all pages

## Page Designs

### Landing Page
- Hero section with logo
- 4 prominent buttons:
  - Login (OAuth)
  - Sign Up (→ Patreon)
  - Join Discord
  - YouTube
- Features showcase
- Testimonials (optional)
- Footer with links

### Main Dashboard
- Full-screen map
- Left panel (collapsed by default)
- Right panel (collapsed by default)
- Bottom toolbar (always visible)
- Global menu (top-right)
- Layer controls (top-left)
- Search bar (top-center)

### Store Management
- Data table with shop items
- Add/Edit/Delete buttons
- Category filter
- Search functionality
- Preview of item
- Price calculator

### Quest Management
- Quest list (active/completed tabs)
- Template selector
- Quest builder form
- Reward configuration
- Participant tracking
- Progress visualization

### Log Viewer
- Real-time log stream
- Filter by type/severity
- Date range selector
- Search functionality
- Export button
- Auto-refresh toggle

### Spawner Queue
- Queue item list
- Add new item form
- Drag-to-reorder
- Status indicators
- Sync with bot button
- Bulk actions

### Account Settings
- User profile section
- Authorized users management (if owner)
- Leave service option (if not owner)
- Preferences
- API key management
- Danger zone (delete account)

## Performance Optimization

### Frontend
- **Code Splitting**: Separate bundles per page
- **Lazy Loading**: Load markers only when visible
- **Caching**: Cache API responses (5-minute TTL)
- **Debouncing**: Search and filter inputs
- **Virtual Scrolling**: Large data tables
- **Image Optimization**: WebP format, lazy loading

### Backend
- **Database Indexing**: All query fields indexed
- **Query Optimization**: Projection, lean queries
- **Pagination**: All list endpoints (default 50 items)
- **Caching**: Redis for frequently accessed data
- **Connection Pooling**: MongoDB connection pool
- **Compression**: Gzip responses

### Network
- **CDN**: Static assets served via CDN
- **HTTP/2**: Server push for critical resources
- **Minification**: CSS/JS minified in production
- **Bundle Size**: < 200KB initial load

## Security Considerations

### API Security
- All endpoints require authentication
- Rate limiting per endpoint type
- Input validation on all requests
- SQL/NoSQL injection prevention
- CSRF tokens for state-changing operations

### Data Privacy
- User data encrypted at rest
- PII handled according to GDPR
- Audit logs for data access
- Secure session management

### Authorization Levels
1. **Owner**: Full access, manage users
2. **Authorized User**: Read/write access
3. **Viewer**: Read-only access (future)

## Technology Stack

### Current Stack
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Authentication**: Passport.js (Discord OAuth)
- **Session**: express-session (MongoDB store)
- **Security**: Helmet, express-rate-limit, CORS
- **Template Engine**: EJS
- **Maps**: Leaflet.js

### Recommended Additions
- **Frontend Framework**: Consider Vue.js or React for complex interactions
- **State Management**: Vuex or Redux
- **Build Tool**: Webpack or Vite
- **CSS Framework**: Tailwind CSS or Bootstrap 5
- **Icons**: Font Awesome or Feather Icons
- **Charts**: Chart.js for analytics
- **Real-time**: Socket.io for live updates (optional)

## Development Phases

### Phase 1: Foundation (Week 1-2)
- ✅ Security implementation (completed)
- New landing page
- User registration/signup
- Enhanced database schemas

### Phase 2: Core Dashboard (Week 3-4)
- Floating panels UI
- Bottom toolbar
- Global menu
- Enhanced map markers
- API endpoints for all data types

### Phase 3: Management Pages (Week 5-6)
- Store management
- Quest management
- Log viewer
- Spawner queue editor

### Phase 4: Advanced Features (Week 7-8)
- Account settings
- User management
- Bounty system
- Dynamic events
- Faction management

### Phase 5: Polish & Optimization (Week 9-10)
- Performance optimization
- UI/UX improvements
- Testing
- Documentation
- Deployment

## Testing Strategy

### Unit Tests
- API endpoint tests
- Validation tests
- Security middleware tests

### Integration Tests
- Authentication flow
- API workflows
- Database operations

### End-to-End Tests
- User journey tests
- Critical path testing
- Cross-browser testing

### Performance Tests
- Load testing (100+ concurrent users)
- Stress testing
- Database query performance

## Deployment Strategy

### Staging Environment
- Mirror of production
- Test all changes before production
- Automated deployment

### Production Environment
- Zero-downtime deployment
- Automated backups
- Monitoring and alerts
- Rollback capability

## Future Enhancements

- Mobile app (React Native)
- Real-time collaboration
- Advanced analytics dashboard
- Custom themes
- Plugin system
- Webhooks/API for third-party integrations
- Multi-language support
- Voice commands integration

---

**Next Steps**: Begin implementation with Phase 2 (Core Dashboard) since security foundation is complete.
