/**
 * Standardized Data Loader Module
 * Handles all database fetching with consistent error handling and loading states
 */

import { mapDayZToLeaflet, scaleToLeaflet } from "../izurvive/mapDayZToLeaflet.js";

// ============================================
// CONFIGURATION
// ============================================

const API_BASE = '/api';
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // ms

// Client-side cache configuration
const CLIENT_CACHE = new Map();
const CACHE_TTL = {
  '/bases': 30000,        // 30 seconds
  '/spawners': 30000,     // 30 seconds
  '/monitorZones': 30000, // 30 seconds
  '/zones': 30000,        // 30 seconds
  '/recent-players': 20000 // 20 seconds
};

// Icon configurations
const ICONS = {
  player: {
    url: 'https://raw.githubusercontent.com/jiniebot/JJDZAM_images/38911c2c2004c16d0a787ebd2b0ace0058f3f0b5/RecentPlayer.png',
    size: [15, 15],
    anchor: [8, 8],
    popupAnchor: [0, -8]
  },
  object: {
    url: 'https://raw.githubusercontent.com/jiniebot/JJDZAM_images/bc1da79db01b4f3a38babc69c97bb95f0e8f158d/obj.png',
    size: [15, 15],
    anchor: [8, 8],
    popupAnchor: [0, -8]
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Fetch data from API with retry logic and client-side caching
 */
async function fetchWithRetry(endpoint, attempts = RETRY_ATTEMPTS, bypassCache = false) {
  const startTime = performance.now();
  
  // Check client-side cache first
  if (!bypassCache) {
    const cached = CLIENT_CACHE.get(endpoint);
    if (cached && cached.expiry > Date.now()) {
      const elapsed = (performance.now() - startTime).toFixed(2);
      console.log(`🚀 CLIENT CACHE HIT: ${endpoint} (${elapsed}ms, expires in ${Math.round((cached.expiry - Date.now()) / 1000)}s)`);
      return cached.data;
    } else if (cached) {
      console.log(`⏰ Client cache EXPIRED for ${endpoint}`);
    } else {
      console.log(`❌ Client cache MISS for ${endpoint} (not cached yet)`);
    }
  }

  console.log(`🌐 Fetching from server: ${endpoint}`);
  
  for (let i = 0; i < attempts; i++) {
    try {
      const fetchStart = performance.now();
      const response = await fetch(`${API_BASE}${endpoint}`);
      const fetchTime = (performance.now() - fetchStart).toFixed(2);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const parseStart = performance.now();
      const data = await response.json();
      const parseTime = (performance.now() - parseStart).toFixed(2);
      const totalTime = (performance.now() - startTime).toFixed(2);
      
      // Log timing breakdown
      console.log(`✅ SERVER RESPONSE: ${endpoint} | Total: ${totalTime}ms (Network: ${fetchTime}ms, Parse: ${parseTime}ms) | Items: ${data.bases?.length || data.spawners?.length || data.zones?.length || data.monitorZones?.length || data.recentPlayers?.length || 'N/A'}`);
      
      // Cache the response with TTL
      const ttl = CACHE_TTL[endpoint] || 30000; // Default 30s
      CLIENT_CACHE.set(endpoint, {
        data: data,
        expiry: Date.now() + ttl
      });
      console.log(`💾 Cached ${endpoint} for ${ttl/1000}s`);
      
      return data;
    } catch (error) {
      console.warn(`⚠️ Attempt ${i + 1}/${attempts} failed for ${endpoint}:`, error.message);
      
      if (i === attempts - 1) {
        const totalTime = (performance.now() - startTime).toFixed(2);
        console.error(`❌ Failed to fetch ${endpoint} after ${attempts} attempts (${totalTime}ms total)`);
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
    }
  }
}

/**
 * Invalidate client-side cache for specific endpoint or pattern
 */
export function invalidateCache(pattern) {
  if (typeof pattern === 'string') {
    // Exact match
    CLIENT_CACHE.delete(pattern);
  } else if (pattern instanceof RegExp) {
    // Pattern match
    for (const key of CLIENT_CACHE.keys()) {
      if (pattern.test(key)) {
        CLIENT_CACHE.delete(key);
      }
    }
  }
}

/**
 * Clear all client-side cache
 */
export function clearAllCache() {
  CLIENT_CACHE.clear();
  console.log('✅ Client cache cleared');
}

/**
 * Create a standard Leaflet icon
 */
function createIcon(type, customSize = null) {
  const config = ICONS[type] || ICONS.player;
  const size = customSize || config.size;
  
  return L.icon({
    iconUrl: config.url,
    iconSize: size,
    iconAnchor: config.anchor,
    popupAnchor: config.popupAnchor
  });
}

/**
 * Create a flag icon with dynamic sizing
 */
function createFlagIcon(flagIconURL, zoom) {
  // Scale based on zoom level
  // Zoomed out (zoom <= 2): 40% bigger = 7px radius (14px diameter)
  // Zoomed in (zoom >= 4): 2x size = 10px radius (20px diameter)
  // Linear interpolation between zoom levels 2-4
  let radius;
  if (zoom <= 2) {
    radius = 7; // 40% bigger than original 5px
  } else if (zoom >= 4) {
    radius = 10; // 2x original 5px
  } else {
    // Linear interpolation between 7 and 10
    const t = (zoom - 2) / 2; // normalize to 0-1
    radius = 7 + (3 * t);
  }
  
  const diameter = radius * 2;
  
  return L.divIcon({
    className: 'base-marker',
    html: `
      <svg height="${diameter}" width="${diameter}" style="overflow: visible; cursor: pointer;">
        <circle cx="${radius}" cy="${radius}" r="${radius}" style="fill: url(#flagPattern-${flagIconURL.replace(/[^a-zA-Z0-9]/g, '')}); stroke: #ffffff7d; stroke-width: 1.5;" />
        <defs>
          <pattern id="flagPattern-${flagIconURL.replace(/[^a-zA-Z0-9]/g, '')}" x="0" y="0" width="1" height="1">
            <image href="${flagIconURL}" x="0" y="0" width="${diameter}" height="${diameter}" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        </defs>
      </svg>
    `,
    iconSize: [diameter, diameter],
    iconAnchor: [radius, radius],
    popupAnchor: [0, -radius]
  });
}

/**
 * Get flag size based on zoom level
 */
function getFlagSize(zoom) {
  // Match city marker size (10x10 to match the 5px radius circle)
  return [10, 10];
}

/**
 * Show loading indicator
 */
function showLoading(layerType) {
  // Could emit event for UI loading spinner
  window.dispatchEvent(new CustomEvent('dataLoading', { detail: { layerType, loading: true } }));
}

/**
 * Hide loading indicator
 */
function hideLoading(layerType, count) {
  window.dispatchEvent(new CustomEvent('dataLoading', { detail: { layerType, loading: false, count } }));
}

// ============================================
// DETAIL PANEL FUNCTIONS
// ============================================

/**
 * Show data in left panel
 */
function showInLeftPanel(content) {
  const leftPanel = document.querySelector('.panel-content');
  if (leftPanel) {
    if (typeof content === 'string') {
      leftPanel.innerHTML = content;
    } else {
      leftPanel.innerHTML = '';
      leftPanel.appendChild(content);
    }
    
    // Add event delegation for copy buttons
    leftPanel.querySelectorAll('.copy-id-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = this.dataset.id;
        navigator.clipboard.writeText(id);
        const originalText = this.textContent;
        this.textContent = '✓ Copied!';
        setTimeout(() => {
          this.textContent = originalText;
        }, 2000);
      });
    });
  }
}

/**
 * Show actions in right panel
 */
function showInRightPanel(content) {
  const rightPanel = document.getElementById('rightPanelContent');
  if (rightPanel) {
    if (typeof content === 'string') {
      rightPanel.innerHTML = content;
    } else {
      rightPanel.innerHTML = '';
      rightPanel.appendChild(content);
    }
  }
}

// ============================================
// LOADER FUNCTIONS
// ============================================

/**
 * Load Recent Players
 */
export async function loadRecentPlayers(map, layerGroup) {
  const loadStart = performance.now();
  console.log('👥 Starting loadRecentPlayers()...');
  showLoading('Recent Players');
  
  // Store layer group globally for focus function
  window.recentPlayersLayerGroup = layerGroup;
  
  try {
    const data = await fetchWithRetry('/recent-players');
    const players = data.recentPlayers || [];
    console.log(`👥 Fetched ${players.length} players`);
    
    players.forEach((player, idx) => {
      const latLng = mapDayZToLeaflet(player.lastPos[0], player.lastPos[2], map);
      
      const marker = L.marker(latLng, {
        title: player.gamertag,
        icon: createIcon('player')
      });
      
      // Store player data globally for focus function
      if (!window.playerDataCache) window.playerDataCache = {};
      window.playerDataCache[`player_${idx}`] = player;
      
      const popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <strong>${player.gamertag}</strong><br>
        Last Seen: ${new Date(player.lastSeen).toLocaleString()}<br>
      `;
      
      const focusBtn = document.createElement('button');
      focusBtn.textContent = '🔍 Focus';
      focusBtn.style.cssText = `
        background: rgba(74, 144, 226, 0.8);
        color: white;
        border: none;
        padding: 6px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        backdrop-filter: blur(10px);
        transition: all 0.2s;
        margin-top: 5px;
      `;
      
      focusBtn.addEventListener('mouseenter', () => {
        focusBtn.style.background = 'rgba(74, 144, 226, 1)';
      });
      
      focusBtn.addEventListener('mouseleave', () => {
        focusBtn.style.background = 'rgba(74, 144, 226, 0.8)';
      });
      
      focusBtn.addEventListener('click', () => {
        window.focusPlayer(`player_${idx}`);
      });
      
      popupContent.appendChild(focusBtn);
      marker.bindPopup(popupContent);
      
      marker.on('click', () => {
        // Build left panel with comprehensive player info
        const leftPanelHTML = `
          <h3>Player Information</h3>
          <div class="ios-card">
            <strong>Gamertag:</strong> ${player.gamertag}<br>
            ${player.userName ? `<strong>Discord:</strong> ${player.userName}<br>` : ''}
            <strong>User ID:</strong> ${player.userID}<br>
            ${player.inGameID ? `<strong>In-Game ID:</strong> <span class="copy-id-btn" data-id="${player.inGameID}" style="cursor: pointer; color: #4A90E2; text-decoration: underline;">Click to Copy ID</span><br>` : ''}
            <strong>Last Seen:</strong> ${new Date(player.lastSeen).toLocaleString()}<br>
            <strong>Position:</strong> ${player.lastPos.join(', ')}
          </div>
          ${player.hasProfile ? `
            <div class="ios-card">
              <h4>Profile Stats</h4>
              <strong>Balance:</strong> $${player.balance || 0}<br>
              ${player.factionID ? `<strong>Faction:</strong> ${player.factionID}<br>` : ''}
              ${player.baseID ? `<strong>Base:</strong> ${player.baseID}<br>` : ''}
              ${player.timePlayed ? `<strong>Time Played:</strong> ${Math.round(player.timePlayed / 60)} minutes<br>` : ''}
            </div>
            <div class="ios-card">
              <h4>Combat Stats</h4>
              <strong>Kills:</strong> ${player.kills || 0}<br>
              <strong>Deaths:</strong> ${player.deaths || 0}<br>
              <strong>K/D Ratio:</strong> ${player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills || 0}<br>
              <strong>Friendly Kills:</strong> ${player.friendlyKills || 0}<br>
            </div>
            ${player.last5Kills && player.last5Kills.length > 0 ? `
              <div class="ios-card">
                <h4>Recent Kills</h4>
                ${player.last5Kills.slice(0, 5).map(kill => `
                  <div style="margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                    <strong>${kill.victim}</strong><br>
                    <small>${new Date(kill.timeLog).toLocaleString()}</small><br>
                    ${kill.distance ? `Distance: ${Math.round(kill.distance)}m<br>` : ''}
                    ${kill.location ? `Location: ${kill.location}` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            <div class="ios-card">
              <h4>Activity Stats</h4>
              <strong>Items Built:</strong> ${player.lifetimeBuiltItems || 0}<br>
              <strong>Items Placed:</strong> ${player.lifetimePlacedItems || 0}<br>
              <strong>Teleports Used:</strong> ${player.lifetimeTeleports || 0}<br>
              <strong>Emotes Used:</strong> ${player.lifetimeEmotes || 0}<br>
              ${player.completedBounties && player.completedBounties.length > 0 ? `<strong>Bounties Completed:</strong> ${player.completedBounties.length}<br>` : ''}
              ${player.completedDailyQuests && player.completedDailyQuests.length > 0 ? `<strong>Daily Quests:</strong> ${player.completedDailyQuests.length}<br>` : ''}
              ${player.completedWeeklyQuests && player.completedWeeklyQuests.length > 0 ? `<strong>Weekly Quests:</strong> ${player.completedWeeklyQuests.length}<br>` : ''}
            </div>
            ${player.last10Pos && player.last10Pos.length > 0 ? `
              <div class="ios-card">
                <h4>Recent Locations</h4>
                ${player.last10Pos.slice(0, 5).map((pos, idx) => `
                  <div style="margin-bottom: 4px; font-size: 12px;">
                    <strong>#${idx + 1}:</strong> [${pos.x}, ${pos.y}, ${pos.z}]
                  </div>
                `).join('')}
                ${player.last10Pos.length > 5 ? `<small style="color: var(--text-gray);">+${player.last10Pos.length - 5} more</small>` : ''}
              </div>
            ` : ''}
            ${player.stolenFactionMoney && Object.keys(player.stolenFactionMoney).length > 0 ? `
              <div class="ios-card">
                <h4>Faction Activity</h4>
                <small style="color: var(--text-gray);">Stolen from factions: $${Object.values(player.stolenFactionMoney).reduce((a, b) => a + b, 0)}</small>
              </div>
            ` : ''}
            ${player.bounties && player.bounties.filter(b => b.status === 'active').length > 0 ? `
              <div class="ios-card">
                <h4>Active Bounties</h4>
                <span class="ios-badge danger">${player.bounties.filter(b => b.status === 'active').length} Active</span>
              </div>
            ` : ''}
          ` : `
            <div class="ios-card">
              <p style="color: var(--text-gray); font-style: italic;">No profile data available for this player.</p>
            </div>
          `}
        `;
        
        showInLeftPanel(leftPanelHTML);
        
        const rightPanelContent = document.createElement('div');
        rightPanelContent.innerHTML = `
          <button class="icon-button" data-action="edit-player" data-id="${player.userID}">
            <span class="icon">✏️</span>
            <span class="label">Edit Player</span>
          </button>
          <button class="icon-button" data-action="create-bounty" data-id="${player.userID}" data-name="${player.gamertag}">
            <span class="icon">🎯</span>
            <span class="label">Add Bounty</span>
          </button>
          <button class="icon-button" data-action="view-history" data-id="${player.userID}">
            <span class="icon">📊</span>
            <span class="label">View History</span>
          </button>
          ${player.hasProfile && player.factionID ? `
            <button class="icon-button" data-action="view-faction" data-id="${player.factionID}">
              <span class="icon">👥</span>
              <span class="label">View Faction</span>
            </button>
          ` : ''}
          ${player.hasProfile && player.baseID ? `
            <button class="icon-button" data-action="view-base" data-id="${player.baseID}">
              <span class="icon">🏠</span>
              <span class="label">View Base</span>
            </button>
          ` : ''}
        `;
        
        // Attach event listeners
        rightPanelContent.querySelectorAll('.icon-button').forEach(btn => {
          btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            
            if (action === 'edit-player') {
              window.location.href = `/edit/player/${id}`;
            } else if (action === 'create-bounty') {
              createBounty(id, name);
            } else if (action === 'view-history') {
              viewPlayerHistory(id);
            } else if (action === 'view-faction') {
              window.location.href = `/faction/${id}`;
            } else if (action === 'view-base') {
              window.location.href = `/base/${id}`;
            }
          });
        });
        
        showInRightPanel(rightPanelContent);
      });
      
      layerGroup.addLayer(marker);
    });
    
    map.addLayer(layerGroup);
    hideLoading('Recent Players', players.length);
    
    const loadTime = (performance.now() - loadStart).toFixed(2);
    console.log(`✅ loadRecentPlayers() completed in ${loadTime}ms (${players.length} players)`);
  } catch (error) {
    const loadTime = (performance.now() - loadStart).toFixed(2);
    console.error(`❌ loadRecentPlayers() failed after ${loadTime}ms:`, error);
    hideLoading('Recent Players', 0);
  }
}

/**
 * Load Bases
 */
export async function loadBases(map, layerGroup) {
  const loadStart = performance.now();
  console.log('📦 Starting loadBases()...');
  showLoading('Bases');
  
  try {
    const data = await fetchWithRetry('/bases');
    const bases = data.bases || [];
    console.log(`📦 Fetched ${bases.length} bases`);

    // Fetch Discord roles and users to show names instead of IDs
    let roleMap = {};
    try {
      if (cachedRoles === null) {
        console.log('🔍 Fetching Discord roles...');
        const roleStart = performance.now();
        const roleResp = await fetch('/api/discord/roles');
        if (roleResp.ok) {
          const roleData = await roleResp.json();
          cachedRoles = roleData.roles || [];
          console.log(`✅ Fetched ${cachedRoles.length} Discord roles in ${(performance.now() - roleStart).toFixed(2)}ms`);
        } else {
          cachedRoles = [];
          console.log('⚠️ Discord roles fetch failed');
        }
      } else {
        console.log(`💾 Using cached Discord roles (${cachedRoles.length} roles)`);
      }
      (cachedRoles || []).forEach((r) => {
        roleMap[r.id] = r.name;
      });
    } catch (e) {
      cachedRoles = [];
      console.log('⚠️ Discord roles fetch error:', e.message);
    }

    let userMap = {};
    const ownerIds = [...new Set(bases.map((b) => b.owner_userID).filter(Boolean))];
    if (ownerIds.length) {
      const uncached = ownerIds.filter((id) => !cachedUsers[id]);
      if (uncached.length) {
        try {
          console.log(`🔍 Fetching ${uncached.length} Discord users (out of ${ownerIds.length} total)...`);
          const userStart = performance.now();
          
          // Batch in groups of 50 to avoid overloading the API
          const batchSize = 50;
          for (let i = 0; i < uncached.length; i += batchSize) {
            const batch = uncached.slice(i, i + batchSize);
            console.log(`  → Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uncached.length / batchSize)}: ${batch.length} users`);
            const batchStart = performance.now();
            
            const userResp = await fetch(`/api/discord/users?id=${batch.join(',')}`);
            if (userResp.ok) {
              const userData = await userResp.json();
              Object.assign(cachedUsers, userData.users || {});
              console.log(`  ✅ Batch completed in ${(performance.now() - batchStart).toFixed(2)}ms`);
            } else {
              console.log(`  ⚠️ Batch failed: ${userResp.status}`);
            }
          }
          
          console.log(`✅ Fetched all Discord users in ${(performance.now() - userStart).toFixed(2)}ms`);
        } catch (e) {
          // ignore if not configured
          console.log('⚠️ Discord users fetch error:', e.message);
        }
      } else {
        console.log(`💾 All ${ownerIds.length} Discord users already cached`);
      }
      ownerIds.forEach((id) => {
        if (cachedUsers[id]) userMap[id] = cachedUsers[id];
      });
    }
    
    // Load flag icon mappings
    console.log('🚩 Fetching flag options...');
    const flagStart = performance.now();
    const flagResponse = await fetch('/dayzdata/flagOptions.json');
    const flagData = await flagResponse.json();
    const flagMap = {};
    
    flagData.Flag_Options.forEach((flag) => {
      flagMap[flag.value] = flag.imgpath;
    });
    console.log(`✅ Loaded ${flagData.Flag_Options.length} flag options in ${(performance.now() - flagStart).toFixed(2)}ms`);
    
    console.log('🏗️ Creating base markers...');
    const markerStart = performance.now();
    bases.forEach((base) => {
      const latLng = mapDayZToLeaflet(base.flagLoc[0], base.flagLoc[2], map);

      const ownerLabel = (() => {
        const info = userMap[base.owner_userID];
        if (!info) return base.owner_userID || 'Unknown';
        return info.display_name || info.global_name || info.username || base.owner_userID;
      })();

      const factionLabel = (() => {
        if (!base.factionID) return 'None';
        return roleMap[base.factionID] || base.factionID;
      })();
      
      const flagIconURL = flagMap[base.flagName] || 
        'https://raw.githubusercontent.com/jiniebot/JJDZAM_images/8f963d2b025e82322867638b1cb9443921ce8478/Flag_White.png';
      
      const marker = L.marker(latLng, {
        title: base.baseName,
        icon: createFlagIcon(flagIconURL, map.getZoom())
      });
      
      // Store reference to base data on marker for zoom handler
      marker._baseData = {
        base: base,
        flagIconURL: flagIconURL
      };
      
      marker.bindPopup(`
        <div style="position: relative; padding-right: 40px;">
          <img src="${flagIconURL}" style="position: absolute; top: 0; right: 0; width: 32px; height: 32px; object-fit: contain;" />
          <strong>${base.baseName}</strong><br>
          Owner: ${ownerLabel}<br>
          Faction: ${factionLabel}<br>
          Structures: ${base.structures.length}
        </div>
      `);
      
      marker.on('click', () => {
        showInLeftPanel(`
          <h3>Base Information</h3>
          <div class="ios-card">
            <strong>Name:</strong> ${base.baseName}<br>
            <strong>Owner:</strong> ${ownerLabel}<br>
            <strong>Faction:</strong> ${factionLabel}<br>
            <strong>Structures:</strong> ${base.structures.length}<br>
            <strong>Location:</strong> ${base.flagLoc.join(', ')}
          </div>
          <div class="ios-card">
            <h4>Structures</h4>
            ${base.structures.map(s => `<div>• ${s.type || s}</div>`).join('')}
          </div>
        `);
        
        const rightPanelContent = document.createElement('div');
        rightPanelContent.innerHTML = `
          <button class="icon-button" data-action="edit-base" data-id="${base.baseID}">
            <span class="icon">✏️</span>
            <span class="label">Edit Base</span>
          </button>
          <button class="icon-button" data-action="create-raid" data-id="${base.baseID}" data-name="${base.baseName}">
            <span class="icon">⚔️</span>
            <span class="label">Report Raid</span>
          </button>
          <button class="icon-button" data-action="teleport-base" data-id="${base.baseID}">
            <span class="icon">🌀</span>
            <span class="label">Teleport</span>
          </button>
          <button class="icon-button danger" data-action="delete-base" data-id="${base.baseID}">
            <span class="icon">🗑️</span>
            <span class="label">Delete</span>
          </button>
        `;
        
        // Attach event listeners
        rightPanelContent.querySelectorAll('.icon-button').forEach(btn => {
          btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            
            if (action === 'edit-base') {
              window.location.href = `/edit/base/${id}`;
            } else if (action === 'create-raid') {
              createRaid(id, name);
            } else if (action === 'teleport-base') {
              teleportToBase(id);
            } else if (action === 'delete-base') {
              deleteBase(id);
            }
          });
        });
        
        showInRightPanel(rightPanelContent);
      });
      
      layerGroup.addLayer(marker);
    });
    console.log(`✅ Created ${bases.length} base markers in ${(performance.now() - markerStart).toFixed(2)}ms`);
    
    // Store zoom handler on layerGroup to prevent duplicates
    if (!layerGroup._zoomHandlerAttached) {
      map.on('zoomend', () => {
        const currentZoom = map.getZoom();
        layerGroup.eachLayer((marker) => {
          if (marker._baseData) {
            marker.setIcon(createFlagIcon(marker._baseData.flagIconURL, currentZoom));
          }
        });
      });
      layerGroup._zoomHandlerAttached = true;
    }
    
    map.addLayer(layerGroup);
    hideLoading('Bases', bases.length);
    
    const loadTime = (performance.now() - loadStart).toFixed(2);
    console.log(`✅ loadBases() completed in ${loadTime}ms (${bases.length} bases)`);
  } catch (error) {
    const loadTime = (performance.now() - loadStart).toFixed(2);
    console.error(`❌ loadBases() failed after ${loadTime}ms:`, error);
    hideLoading('Bases', 0);
  }
}

/**
 * Load Monitor Zones
 */
// Shared cache for Discord lookups (per page load)
let cachedChannels = null;
let cachedRoles = null;
let cachedUsers = {};

export async function loadMonitorZones(map, layerGroup) {
  const loadStart = performance.now();
  console.log('🗺️ Starting loadMonitorZones()...');
  showLoading('Monitor Zones');
  
  // Support both old (single layer) and new (active/inactive layers) format
  const activeLayer = layerGroup.activeLayer || layerGroup;
  const inactiveLayer = layerGroup.inactiveLayer || layerGroup;
  
  activeLayer.clearLayers();
  if (inactiveLayer !== activeLayer) {
    inactiveLayer.clearLayers();
  }
  
  try {
    const data = await fetchWithRetry('/monitorZones');
    const zones = data.monitorZones || [];
    console.log(`🗺️ Fetched ${zones.length} zones`);

    // Fetch Discord channels once for display (ignore failures silently)
    let channelMap = {};
    try {
      if (cachedChannels === null) {
        const chResp = await fetch('/api/discord/channels');
        if (chResp.ok) {
          const chData = await chResp.json();
          cachedChannels = chData.channels || [];
        } else {
          cachedChannels = [];
        }
      }
      (cachedChannels || []).forEach((ch) => {
        channelMap[ch.id] = ch.name;
      });
    } catch (e) {
      cachedChannels = [];
    }
    
    // Create a shared SVG renderer with extra padding to prevent clipping
    const sharedRenderer = L.svg({ padding: 2.0 });

    // Append radial gradient defs once (avoid duplicate defs)
    if (!document.getElementById('zoneGradient')) {
      const svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svgDefs.innerHTML = `
        <radialGradient id="zoneGradient" cx="50%" cy="50%" r="80%">
          <stop offset="0%" stop-color="rgba(0,0,255,0)" />
          <stop offset="100%" stop-color="rgba(0,0,255,0.5)" />
        </radialGradient>
      `;
      const mapSvg = document.querySelector("svg");
      if (mapSvg) mapSvg.appendChild(svgDefs);
    }
    
    zones.forEach((zone) => {
      let shape;
      
      if (zone.zoneType === 0) {
        // Circular zone
        const latLng = mapDayZToLeaflet(zone.location[0], zone.location[2], map);
        
        // Skip this zone if range is invalid (must be positive)
        if (!zone.range || zone.range <= 0 || isNaN(zone.range)) {
          // Silently skip zones with invalid ranges
          return;
        }
        
        // Calculate the second point on the edge of the circle
        const edgePoint = mapDayZToLeaflet(zone.location[0] + zone.range, zone.location[2], map);
        
        // Calculate pixel distance at current zoom
        const point1 = map.latLngToLayerPoint(latLng);
        const point2 = map.latLngToLayerPoint(edgePoint);
        const radiusInPixels = Math.sqrt(
          Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
        );
        
        // Use circleMarker with pixel radius (not affected by projection bounds)
        // Style based on active status
        const isActive = zone.isActive;
        shape = L.circleMarker(latLng, {
          radius: radiusInPixels,
          stroke: true,
          color: isActive ? "rgba(255,255,255,0.55)" : "rgba(255, 59, 48, 0.6)", // white for active, red for inactive
          weight: 2,
          dashArray: isActive ? null : "5, 5", // dotted for inactive
          fillColor: isActive ? "rgba(120, 144, 180, 0.2)" : "transparent", // fill only if active
          fillOpacity: isActive ? 0.2 : 0,
          opacity: isActive ? 0.8 : 0.6,
          renderer: sharedRenderer
        });
        
        // Store zone data for zoom handler
        shape._zoneData = zone;
        
        // Only apply gradient to active zones
        if (isActive) {
          const applyGradient = () => {
            const element = shape.getElement();
            if (element) {
              element.setAttribute("fill", "url(#zoneGradient)");
              // Remove any clipping
              element.removeAttribute("clip-path");
              element.style.overflow = "visible";
            }
          };
          
          shape.on("add", applyGradient);
          
          // Store gradient function on shape for zoom handler
          shape._applyGradient = applyGradient;
        }
        
      } else if (zone.zoneType === 1) {
        // Polygon zone
        const polygonCoords = zone.polygon.map(({ x, y }) => 
          mapDayZToLeaflet(x, y, map)
        );
        
        // Style based on active status
        const isActive = zone.isActive;
        shape = L.polygon(polygonCoords, {
          color: isActive ? "rgba(255,255,255,0.55)" : "rgba(255, 59, 48, 0.6)", // white for active, red for inactive
          weight: 2,
          dashArray: isActive ? null : "5, 5", // dotted for inactive
          fillColor: isActive ? "rgba(90, 120, 100, 0.2)" : "transparent", // fill only if active
          fillOpacity: isActive ? 0.2 : 0,
          opacity: isActive ? 0.8 : 0.6
        });
      }
      
      if (shape) {
        shape.bindPopup(`
          <strong>${zone.name}</strong><br>
          Type: ${zone.type}<br>
          ${zone.zoneType === 0 ? `Range: ${zone.range}m<br>` : `Vertices: ${zone.polygon?.length || 0}<br>`}
          Active: ${zone.isActive ? "Yes" : "No"}
        `);
        
        shape.on('click', () => {
          showInLeftPanel(`
            <h3>Monitor Zone</h3>
            <div class="ios-card">
              <strong>Name:</strong> ${zone.name}<br>
              <strong>Type:</strong> ${zone.type}<br>
              <strong>Zone Type:</strong> ${zone.zoneType === 0 ? 'Circular' : 'Polygon'}<br>
              ${zone.range ? `<strong>Range:</strong> ${zone.range}m<br>` : ''}
              ${zone.radarChannel ? `<strong>Channel:</strong> ${channelMap[zone.radarChannel] ? `#${channelMap[zone.radarChannel]} (${zone.radarChannel})` : zone.radarChannel}<br>` : ''}
              <strong>Active:</strong> <span class="ios-badge ${zone.isActive ? 'success' : 'danger'}">${zone.isActive ? 'Yes' : 'No'}</span>
            </div>
            ${zone.description ? `<div class="ios-card"><p>${zone.description}</p></div>` : ''}
          `);
          
          const rightPanelContent = document.createElement('div');
          rightPanelContent.innerHTML = `
            <button class="icon-button" data-action="edit-zone" data-id="${zone._id}">
              <span class="icon">✏️</span>
              <span class="label">Edit Zone</span>
            </button>
            <button class="icon-button" data-action="toggle-zone" data-id="${zone._id}" data-active="${!zone.isActive}">
              <span class="icon">${zone.isActive ? '⏸️' : '▶️'}</span>
              <span class="label">${zone.isActive ? 'Disable' : 'Enable'}</span>
            </button>
            <button class="icon-button danger" data-action="delete-zone" data-id="${zone._id}">
              <span class="icon">🗑️</span>
              <span class="label">Delete</span>
            </button>
          `;
          
          // Attach event listeners
          rightPanelContent.querySelectorAll('.icon-button').forEach(btn => {
            btn.addEventListener('click', () => {
              const action = btn.dataset.action;
              const id = btn.dataset.id;
              
              if (action === 'edit-zone') {
                window.location.href = `/edit/zone/${id}`;
              } else if (action === 'toggle-zone') {
                toggleZone(id, btn.dataset.active === 'true');
              } else if (action === 'delete-zone') {
                deleteZone(id);
              }
            });
          });
          
          showInRightPanel(rightPanelContent);
        });
        
        // Add to appropriate layer based on active status
        const targetLayer = zone.isActive ? activeLayer : inactiveLayer;
        targetLayer.addLayer(shape);
      }
    });
    
    // Attach single (debounced) handler for gradient reapplication and radius update
    const handleZoomUpdate = () => {
      let rafId = null;
      const scheduleUpdate = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          try {
            // Update shapes in both active and inactive layers
            [activeLayer, inactiveLayer].forEach(layer => {
              layer.eachLayer((shape) => {
                // Reapply gradient
                if (shape._applyGradient) {
                  try { shape._applyGradient(); } catch (e) { /* ignore */ }
                }

                // Update circle radius for pixel-based circles
                if (shape._zoneData && shape._zoneData.zoneType === 0) {
                  try {
                    const latLng = shape.getLatLng();
                    const edgePoint = mapDayZToLeaflet(
                      shape._zoneData.location[0] + shape._zoneData.range,
                      shape._zoneData.location[2],
                      map
                    );

                    const point1 = map.latLngToLayerPoint(latLng);
                    const point2 = map.latLngToLayerPoint(edgePoint);

                    if (
                      Number.isFinite(point1.x) && Number.isFinite(point1.y) &&
                      Number.isFinite(point2.x) && Number.isFinite(point2.y)
                    ) {
                      const radiusInPixels = Math.sqrt(
                        Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
                      );
                      if (Number.isFinite(radiusInPixels) && radiusInPixels > 0) {
                        shape.setRadius(radiusInPixels);
                      }
                    }
                  } catch (err) {
                    // If calculation fails during rapid interaction, skip this shape
                  }
                }
              });
            });
          } finally {
            rafId = null;
          }
        });
      };
      return scheduleUpdate;
    };

    if (!activeLayer._zoomHandlerAttached) {
      const scheduleUpdate = handleZoomUpdate();
      map.on('zoomend moveend', scheduleUpdate);
      activeLayer._zoomHandlerAttached = true;
      inactiveLayer._zoomHandlerAttached = true;
    }
    
    // Add both layers to map
    map.addLayer(activeLayer);
    if (inactiveLayer !== activeLayer) {
      map.addLayer(inactiveLayer);
    }
    
    // Count zones in each layer
    const activeCount = activeLayer.getLayers().length;
    const inactiveCount = inactiveLayer !== activeLayer ? inactiveLayer.getLayers().length : 0;
    const totalCount = activeCount + inactiveCount;
    
    hideLoading('Monitor Zones', totalCount);
    
    const loadTime = (performance.now() - loadStart).toFixed(2);
    console.log(`✅ loadMonitorZones() completed in ${loadTime}ms (${activeCount} active, ${inactiveCount} inactive, ${totalCount} total)`);
  } catch (error) {
    const loadTime = (performance.now() - loadStart).toFixed(2);
    console.error(`❌ loadMonitorZones() failed after ${loadTime}ms:`, error);
    hideLoading('Monitor Zones', 0);
  }
}

/**
 * Load Active Object Spawners
 */
export async function loadActiveObjSps(map, layerGroup) {
  const loadStart = performance.now();
  console.log('📦 Starting loadActiveObjSps()...');
  showLoading('Spawned Objects');
  
  try {
    const data = await fetchWithRetry('/spawners');
    const spawners = (data.spawners || []).filter(obj => 
      !obj.fileName.startsWith('Flag_') && 
      !obj.fileName.startsWith('Armband_')
    );
    console.log(`📦 Fetched ${spawners.length} spawned objects`);
    
    spawners.forEach((obj) => {
      const latLng = mapDayZToLeaflet(obj.pos[0], obj.pos[2], map);
      
      const marker = L.marker(latLng, {
        title: obj.fileName,
        icon: createIcon('object')
      });
      
      const popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <strong>${obj.fileName}</strong><br>
        Owner: ${obj.owner_userID || 'Server'}<br>
        Lifetime: ${obj.lifetime === -1 ? "Forever" : obj.lifetime}<br>
        Status: ${obj.isActive ? "Active" : "Inactive"}<br>
        <button class="rm-btn" data-action="queue-removal" data-id="${obj._id}">Queue Removal</button>
      `;
      
      popupContent.querySelector('.rm-btn').addEventListener('click', () => {
        queueForRemoval(obj._id);
      });
      
      marker.bindPopup(popupContent);
      
      marker.on('click', () => {
        showInLeftPanel(`
          <h3>Spawned Object</h3>
          <div class="ios-card">
            <strong>Object:</strong> ${obj.fileName}<br>
            <strong>Owner:</strong> ${obj.owner_userID || 'Server'}<br>
            <strong>Position:</strong> ${obj.pos.join(', ')}<br>
            <strong>Lifetime:</strong> ${obj.lifetime === -1 ? 'Permanent' : obj.lifetime + 's'}<br>
            <strong>Status:</strong> <span class="ios-badge ${obj.isActive ? 'success' : 'danger'}">${obj.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        `);
        
        const rightPanelContent = document.createElement('div');
        rightPanelContent.innerHTML = `
          <button class="icon-button" data-action="edit-object" data-id="${obj._id}">
            <span class="icon">✏️</span>
            <span class="label">Edit Object</span>
          </button>
          <button class="icon-button warning" data-action="queue-removal" data-id="${obj._id}">
            <span class="icon">📦</span>
            <span class="label">Queue Removal</span>
          </button>
          <button class="icon-button danger" data-action="delete-object" data-id="${obj._id}">
            <span class="icon">🗑️</span>
            <span class="label">Delete Now</span>
          </button>
        `;
        
        // Attach event listeners
        rightPanelContent.querySelectorAll('.icon-button').forEach(btn => {
          btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            
            if (action === 'edit-object') {
              window.location.href = `/edit/object/${id}`;
            } else if (action === 'queue-removal') {
              queueForRemoval(id);
            } else if (action === 'delete-object') {
              deleteObject(id);
            }
          });
        });
        
        showInRightPanel(rightPanelContent);
      });
      
      layerGroup.addLayer(marker);
    });
    
    map.addLayer(layerGroup);
    hideLoading('Spawned Objects', spawners.length);
    
    const loadTime = (performance.now() - loadStart).toFixed(2);
    console.log(`✅ loadActiveObjSps() completed in ${loadTime}ms (${spawners.length} objects)`);
  } catch (error) {
    const loadTime = (performance.now() - loadStart).toFixed(2);
    console.error(`❌ loadActiveObjSps() failed after ${loadTime}ms:`, error);
    hideLoading('Spawned Objects', 0);
  }
}

// ============================================
// GLOBAL HELPER FUNCTIONS
// ============================================

/**
 * Focus on a player - show their movement path and recent kill locations
 */
let focusLayerGroup = null;

window.focusPlayer = function(playerCacheKey) {
  console.log('focusPlayer called with key:', playerCacheKey);
  console.log('playerDataCache:', window.playerDataCache);
  console.log('mapInstance:', window.mapInstance);
  
  const player = window.playerDataCache?.[playerCacheKey];
  const map = window.mapInstance?.map;
  const recentPlayersLayer = window.recentPlayersLayerGroup;
  
  console.log('Found player:', player);
  console.log('Found map:', map);
  
  if (!map) {
    console.error('Map not found');
    return;
  }
  
  if (!player) {
    console.error('Player data not found for key:', playerCacheKey);
    console.error('Available keys:', Object.keys(window.playerDataCache || {}));
    return;
  }
  
  console.log('Starting focus on player:', player.gamertag);
  
  // HIDE all other recent player markers
  if (recentPlayersLayer && map.hasLayer(recentPlayersLayer)) {
    map.removeLayer(recentPlayersLayer);
  }
  
  // Clear previous focus layers
  if (focusLayerGroup) {
    map.removeLayer(focusLayerGroup);
  }
  focusLayerGroup = L.layerGroup();
  
  const pathCoords = [];
  
  // Process last 10 positions if available
  if (player.last10Pos && player.last10Pos.length > 0) {
    player.last10Pos.forEach((pos, idx) => {
      const latLng = mapDayZToLeaflet(pos.x, pos.z, map);
      pathCoords.push(latLng);
      
      // Blue circle for each intermediate position
      const posMarker = L.circleMarker(latLng, {
        radius: 8,
        fillColor: '#4A90E2',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      });
      
      posMarker.bindPopup(`
        <strong>Position #${idx + 1}</strong><br>
        [${pos.x}, ${pos.y}, ${pos.z}]
      `);
      
      focusLayerGroup.addLayer(posMarker);
    });
  }
  
  // Add current position (last position)
  const currentLatLng = mapDayZToLeaflet(player.lastPos[0], player.lastPos[2], map);
  pathCoords.push(currentLatLng);
  
  // GREEN circle for START (first position)
  if (pathCoords.length > 0) {
    const startMarker = L.circleMarker(pathCoords[0], {
      radius: 10,
      fillColor: '#00FF00',
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9
    });
    
    startMarker.bindPopup(`
      <strong>START</strong><br>
      ${player.gamertag}<br>
      First tracked position
    `);
    
    focusLayerGroup.addLayer(startMarker);
  }
  
  // RED circle for END (current position)
  const endMarker = L.circleMarker(currentLatLng, {
    radius: 10,
    fillColor: '#FF0000',
    color: '#fff',
    weight: 3,
    opacity: 1,
    fillOpacity: 0.9
  });
  
  endMarker.bindPopup(`
    <strong>CURRENT POSITION</strong><br>
    ${player.gamertag}<br>
    ${player.lastPos.join(', ')}<br>
    Last Seen: ${new Date(player.lastSeen).toLocaleString()}
  `);
  
  focusLayerGroup.addLayer(endMarker);
  
  // Draw LINE connecting all points
  if (pathCoords.length > 1) {
    const pathLine = L.polyline(pathCoords, {
      color: '#4A90E2',
      weight: 3,
      opacity: 0.8
    });
    
    focusLayerGroup.addLayer(pathLine);
  }
  
  // Add KILL markers
  if (player.last5Kills && player.last5Kills.length > 0) {
    player.last5Kills.forEach((kill, idx) => {
      // Try different position field names
      const killPos = kill.position || kill.pos || kill.location;
      
      if (killPos && Array.isArray(killPos) && killPos.length >= 3) {
        const killLatLng = mapDayZToLeaflet(killPos[0], killPos[2], map);
        
        const killMarker = L.circleMarker(killLatLng, {
          radius: 8,
          fillColor: '#FF00FF',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        });
        
        killMarker.bindPopup(`
          <strong>💀 Kill: ${kill.victim}</strong><br>
          ${new Date(kill.timeLog).toLocaleString()}<br>
          ${kill.distance ? `Distance: ${Math.round(kill.distance)}m<br>` : ''}
          ${kill.location || 'Unknown location'}
        `);
        
        focusLayerGroup.addLayer(killMarker);
      }
    });
  }
  
  // Add focus layer to map
  map.addLayer(focusLayerGroup);
  
  // Fit map to show all focus markers
  if (focusLayerGroup.getLayers().length > 0) {
    try {
      const bounds = new L.LatLngBounds();
      focusLayerGroup.eachLayer((layer) => {
        if (layer.getLatLng) {
          bounds.extend(layer.getLatLng());
        } else if (layer.getBounds) {
          bounds.extend(layer.getBounds());
        }
      });
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) {
      console.error('Error fitting bounds:', error);
    }
  }
  
  // Add unfocus button to right panel
  const rightPanel = document.getElementById('rightPanelContent');
  if (rightPanel) {
    const unfocusBtn = document.createElement('button');
    unfocusBtn.className = 'icon-button danger';
    unfocusBtn.innerHTML = `
      <span class="icon">✕</span>
      <span class="label">Clear Focus</span>
    `;
    unfocusBtn.addEventListener('click', () => {
      window.unfocusPlayer();
    });
    rightPanel.innerHTML = '';
    rightPanel.appendChild(unfocusBtn);
  }
};

/**
 * Clear player focus and restore all recent player markers
 */
window.unfocusPlayer = function() {
  const map = window.mapInstance?.map;
  const recentPlayersLayer = window.recentPlayersLayerGroup;
  
  if (!map) {
    console.error('Map not found');
    return;
  }
  
  // Remove focus layer
  if (focusLayerGroup) {
    map.removeLayer(focusLayerGroup);
    focusLayerGroup = null;
  }
  
  // Restore all recent player markers
  if (recentPlayersLayer && !map.hasLayer(recentPlayersLayer)) {
    map.addLayer(recentPlayersLayer);
  }
  
  // Clear right panel
  showInRightPanel('');
};
