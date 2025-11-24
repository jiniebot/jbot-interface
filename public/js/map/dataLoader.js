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
 * Fetch data from API with retry logic
 */
async function fetchWithRetry(endpoint, attempts = RETRY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn(`⚠️ Attempt ${i + 1}/${attempts} failed for ${endpoint}:`, error.message);
      
      if (i === attempts - 1) {
        console.error(`❌ Failed to fetch ${endpoint} after ${attempts} attempts`);
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
    }
  }
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
  const size = getFlagSize(zoom);
  return L.icon({
    iconUrl: flagIconURL,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
    popupAnchor: [0, -size[1] / 2]
  });
}

/**
 * Get flag size based on zoom level
 */
function getFlagSize(zoom) {
  if (zoom >= 6) return [30, 30];
  if (zoom >= 5) return [35, 35];
  if (zoom >= 4) return [40, 40];
  return [30, 30];
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
  showLoading('Recent Players');
  
  // Store layer group globally for focus function
  window.recentPlayersLayerGroup = layerGroup;
  
  try {
    const data = await fetchWithRetry('/recent-players');
    const players = data.recentPlayers || [];
    
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
  } catch (error) {
    console.error('Failed to load recent players:', error);
    hideLoading('Recent Players', 0);
  }
}

/**
 * Load Bases
 */
export async function loadBases(map, layerGroup) {
  showLoading('Bases');
  
  try {
    const data = await fetchWithRetry('/bases');
    const bases = data.bases || [];
    
    // Load flag icon mappings
    const flagResponse = await fetch('/dayzdata/flagOptions.json');
    const flagData = await flagResponse.json();
    const flagMap = {};
    
    flagData.Flag_Options.forEach((flag) => {
      flagMap[flag.value] = flag.imgpath;
    });
    
    bases.forEach((base) => {
      const latLng = mapDayZToLeaflet(base.flagLoc[0], base.flagLoc[2], map);
      
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
        <strong>${base.baseName}</strong><br>
        Owner: ${base.owner_userID}<br>
        Faction: ${base.factionID || "None"}<br>
        Structures: ${base.structures.length}
      `);
      
      marker.on('click', () => {
        showInLeftPanel(`
          <h3>Base Information</h3>
          <div class="ios-card">
            <strong>Name:</strong> ${base.baseName}<br>
            <strong>Owner:</strong> ${base.owner_userID}<br>
            <strong>Faction:</strong> ${base.factionID || 'None'}<br>
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
  } catch (error) {
    console.error('Failed to load bases:', error);
    hideLoading('Bases', 0);
  }
}

/**
 * Load Monitor Zones
 */
export async function loadMonitorZones(map, layerGroup) {
  showLoading('Monitor Zones');
  
  try {
    const data = await fetchWithRetry('/monitorZones');
    const zones = data.monitorZones || [];
    
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
        shape = L.circleMarker(latLng, {
          radius: radiusInPixels,
          stroke: false,
          color: "blue",
          fillOpacity: 1,
          strokeOpacity: 0.1,
          renderer: sharedRenderer
        });
        
        // Store zone data for zoom handler
        shape._zoneData = zone;
        
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
        
      } else if (zone.zoneType === 1) {
        // Polygon zone
        const polygonCoords = zone.polygon.map(({ x, y }) => 
          mapDayZToLeaflet(x, y, map)
        );
        
        shape = L.polygon(polygonCoords, {
          color: "red",
          fillColor: "red",
          fillOpacity: 0.2
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
        
        layerGroup.addLayer(shape);
      }
    });
    
    // Attach single (debounced) handler for gradient reapplication and radius update
    if (!layerGroup._zoomHandlerAttached) {
      let rafId = null;
      const scheduleUpdate = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          try {
            layerGroup.eachLayer((shape) => {
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
          } finally {
            rafId = null;
          }
        });
      };

      map.on('zoomend moveend', scheduleUpdate);
      layerGroup._zoomHandlerAttached = true;
    }
    
    map.addLayer(layerGroup);
    hideLoading('Monitor Zones', zones.length);
  } catch (error) {
    console.error('Failed to load monitor zones:', error);
    hideLoading('Monitor Zones', 0);
  }
}

/**
 * Load Active Object Spawners
 */
export async function loadActiveObjSps(map, layerGroup) {
  showLoading('Spawned Objects');
  
  try {
    const data = await fetchWithRetry('/spawners');
    const spawners = (data.spawners || []).filter(obj => 
      !obj.fileName.startsWith('Flag_') && 
      !obj.fileName.startsWith('Armband_')
    );
    
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
        <button class="rm-btn" data-action="queue-removal" data-id="${obj.id}">Queue Removal</button>
      `;
      
      popupContent.querySelector('.rm-btn').addEventListener('click', () => {
        queueForRemoval(obj.id);
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
          <button class="icon-button" data-action="edit-object" data-id="${obj.id}">
            <span class="icon">✏️</span>
            <span class="label">Edit Object</span>
          </button>
          <button class="icon-button warning" data-action="queue-removal" data-id="${obj.id}">
            <span class="icon">📦</span>
            <span class="label">Queue Removal</span>
          </button>
          <button class="icon-button danger" data-action="delete-object" data-id="${obj.id}">
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
  } catch (error) {
    console.error('Failed to load spawned objects:', error);
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
