import { initializeMap } from "./map/initMap.js";
import { loadCityData, loadLootMapData } from "./map/loadData.js";
import {
  handleMapType,
  handleTypeToggle,
  handleZoom,
} from "./map/eventHandlers.js";

import {
  loadRecentPlayers,
  loadBases,
  loadMonitorZones,
  loadActiveObjSps
} from "./map/dataLoader.js";

import {
  mapDayZToLeaflet,
  scaleToLeaflet,
} from "./izurvive/mapDayZToLeaflet.js";

// Create layer groups for all data types
let recentPlayersLayer = L.layerGroup();
let baseClusterGroup = L.layerGroup();
let monitorZonesLayer = L.layerGroup();
let activeObjClusterGroup = L.layerGroup();

(async function main() {
  const mapInstance = initializeMap();
  const { map, tileLayers, getCurrentLayer, setCurrentLayer } = mapInstance;

  if (!map) {
    console.error("❌ Map failed to initialize.");
    return;
  }

  // Make map instance available globally for control buttons
  window.mapInstance = mapInstance;

  let currentLayer = tileLayers.Sat.addTo(map);
  setCurrentLayer('Sat'); // Set initial layer

  // Load city markers
  const cityMarkersByType = await loadCityData(map);

  // Load loot map markers
  // const lootMarkersByType = await loadLootMapData(map);

  // Combine markers from both data sources
  const markersByType = { ...cityMarkersByType };

  // City marker checkboxes are now in dashboard-new.ejs filter panel

  // Add zoom handling for all markers
  handleZoom(map, markersByType);

  // Add toggle functionality for marker types
  handleTypeToggle(map, markersByType);

  // Handle map type switching
  handleMapType(document, map, tileLayers, currentLayer);

  // Load data layers
  await loadRecentPlayers(map, recentPlayersLayer);
  await loadBases(map, baseClusterGroup);
  await loadMonitorZones(map, monitorZonesLayer);
  await loadActiveObjSps(map, activeObjClusterGroup);

  // Layer toggles are now handled by filter panel checkboxes in dashboard-new.ejs
})();

// Old loader functions removed - now using standardized dataLoader.js module

// Helper functions for actions
window.createBounty = async function(userId, gamertag) {
  // Redirect to bounty creation page or show modal
  window.location.href = `/create/bounty?target=${userId}&name=${encodeURIComponent(gamertag)}`;
};

window.createRaid = async function(baseId, baseName) {
  window.location.href = `/create/raid?base=${baseId}&name=${encodeURIComponent(baseName)}`;
};

window.teleportToBase = async function(baseId) {
  // Implement teleport logic - would send command to game server
  if (confirm('Teleport to this base?')) {
    alert('Teleport feature coming soon!');
  }
};

window.deleteBase = async function(baseId) {
  if (!confirm('Are you sure you want to delete this base? This cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`/api/bases/${baseId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      alert('Base deleted successfully');
      location.reload();
    } else {
      alert('Failed to delete base');
    }
  } catch (error) {
    console.error('Error deleting base:', error);
    alert('Error deleting base');
  }
};

window.toggleZone = async function(zoneId, enable) {
  try {
    const response = await fetch(`/api/zones/${zoneId}/toggle`, {
      method: 'POST'
    });

    if (response.ok) {
      alert(`Zone ${enable ? 'enabled' : 'disabled'} successfully`);
      location.reload();
    } else {
      alert('Failed to toggle zone');
    }
  } catch (error) {
    console.error('Error toggling zone:', error);
    alert('Error toggling zone');
  }
};

window.deleteZone = async function(zoneId) {
  if (!confirm('Delete this zone?')) return;

  try {
    const response = await fetch(`/api/zones/${zoneId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      alert('Zone deleted successfully');
      location.reload();
    } else {
      alert('Failed to delete zone');
    }
  } catch (error) {
    console.error('Error deleting zone:', error);
  }
};

window.queueForRemoval = async function(objId) {
  if (!confirm('Queue this object for removal?')) return;

  try {
    const response = await fetch(`/api/spawner-queue/${objId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'queued_removal' })
    });

    if (response.ok) {
      alert('Object queued for removal');
    } else {
      alert('Failed to queue object');
    }
  } catch (error) {
    console.error('Error queuing object:', error);
  }
};

window.deleteObject = async function(objId) {
  if (!confirm('Delete this object immediately?')) return;

  try {
    const response = await fetch(`/api/spawners/${objId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      alert('Object deleted successfully');
      location.reload();
    } else {
      alert('Failed to delete object');
    }
  } catch (error) {
    console.error('Error deleting object:', error);
  }
};

window.viewPlayerHistory = async function(userId) {
  window.location.href = `/player/${userId}/history`;
};
