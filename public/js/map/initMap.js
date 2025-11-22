let currentLayer = null;

export function initializeMap() {
  const maxZoom = 8;

  // Get mapLoc from session data
  const mapLoc = window.sessionData?.mapLoc || 0;
  
  // Map mapLoc numbers to map names (folder names in tiles directory)
  const mapNames = { 0: 'Chernarus', 1: 'Livonia', 3: 'Sakhal' };
  const mapName = mapNames[mapLoc] || 'Chernarus';

  // Define bounds for DayZ maps (approximately 15360 x 15360 for Chernarus)
  // Convert to Leaflet bounds: Southwest corner and Northeast corner
  const bounds = L.latLngBounds(
    L.latLng(-85, -180),  // Southwest corner
    L.latLng(85, 180)     // Northeast corner
  );

  const map = L.map("map", {
    center: [0, 0], // Center at iZurvive's expected 0,0
    zoom: 3,
    minZoom: 2,
    maxZoom: maxZoom,
    crs: L.CRS.EPSG3857, // 🛠 Change CRS to Web Mercator
    bounceAtZoomLimits: true,
  });

  const tileLayers = {
    Top: L.tileLayer(`/js/map/tiles/${mapName}/Top/res{z}/1.26.0/{y}_{x}.webp`, {
      tileSize: 256,
      maxZoom: maxZoom,
      minZoom: 1,
      noWrap: true,
      bounds: bounds,
      errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    }),
    Sat: L.tileLayer(`/js/map/tiles/${mapName}/Sat/res{z}/1.26.0/{y}_{x}.webp`, {
      tileSize: 256,
      maxZoom: maxZoom,
      minZoom: 1,
      noWrap: true,
      bounds: bounds,
      errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    }),
  };

  // Suppress tile loading errors
  Object.values(tileLayers).forEach(layer => {
    layer.on('tileerror', (e) => {
      // Silently handle missing tiles
      e.tile.style.display = 'none';
    });
  });

  return {
    map,
    tileLayers,
    getCurrentLayer: () => currentLayer,
    setCurrentLayer: (newLayerKey) => {
      if (currentLayer) map.removeLayer(currentLayer);
      currentLayer = tileLayers[newLayerKey].addTo(map);
    },
  };
}