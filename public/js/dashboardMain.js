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
import { setupZoneDrawing } from "./map/zoneDrawing.js";

// Create layer groups for all data types
let recentPlayersLayer = L.layerGroup();
let baseClusterGroup = L.layerGroup();
let monitorZonesLayer = L.layerGroup();
let activeObjClusterGroup = L.layerGroup();
const loadingOverlay = document.getElementById('page-loading-overlay');
const showOverlay = () => loadingOverlay?.classList.remove('hidden');
const hideOverlay = () => loadingOverlay?.classList.add('hidden');

(async function main() {
  showOverlay();
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

  // Load data layers in parallel
  await Promise.all([
    loadRecentPlayers(map, recentPlayersLayer),
    loadBases(map, baseClusterGroup),
    loadMonitorZones(map, monitorZonesLayer),
    loadActiveObjSps(map, activeObjClusterGroup)
  ]);

  // Enable drawing new monitor zones directly on the map
  setupZoneDrawing(map, {
    onZoneCreated: async () => {
      await loadMonitorZones(map, monitorZonesLayer);
    },
  });

  hideOverlay();

  // Layer toggles are now handled by filter panel checkboxes in dashboard-new.ejs
  // Wire top-level filter checkboxes (recent players, bases, monitor zones, spawned objects)
  document.getElementById('toggleRecentPlayers')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      if (!map.hasLayer(recentPlayersLayer)) map.addLayer(recentPlayersLayer);
    } else {
      if (map.hasLayer(recentPlayersLayer)) map.removeLayer(recentPlayersLayer);
    }
  });

  document.getElementById('toggleBases')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      if (!map.hasLayer(baseClusterGroup)) map.addLayer(baseClusterGroup);
    } else {
      if (map.hasLayer(baseClusterGroup)) map.removeLayer(baseClusterGroup);
    }
  });

  document.getElementById('toggleMonitorZones')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      if (!map.hasLayer(monitorZonesLayer)) map.addLayer(monitorZonesLayer);
    } else {
      if (map.hasLayer(monitorZonesLayer)) map.removeLayer(monitorZonesLayer);
    }
  });

  document.getElementById('toggleActiveObjs')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      if (!map.hasLayer(activeObjClusterGroup)) map.addLayer(activeObjClusterGroup);
    } else {
      if (map.hasLayer(activeObjClusterGroup)) map.removeLayer(activeObjClusterGroup);
    }
  });
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
    const response = await fetch(`/api/monitorZones/${zoneId}/toggle`, {
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
    const response = await fetch(`/api/monitorZones/${zoneId}`, {
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
