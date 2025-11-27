const MAP_SIZES = {
  Chernarus: 15360,
  Livonia: 12800,
  Sakhal: 15360,
};

const TILE_SIZE = 256;
const TILE_MAX_ZOOM = 6;
const WORLD_SIZE = TILE_SIZE * Math.pow(2, TILE_MAX_ZOOM);

function resolveMapName(map) {
  if (map?.options?.mapName) return map.options.mapName;
  const mapLoc = window.sessionData?.mapLoc || 0;
  const mapNames = { 0: "Chernarus", 1: "Sakhal", 2: "Livonia" };
  return mapNames[mapLoc] || "Chernarus";
}

/**
 * Convert DayZ XZ coordinates into Leaflet LatLng.
 * @param {number} x - The X coordinate from DayZ.
 * @param {number} z - The Z coordinate from DayZ.
 * @param {L.Map} [map] - Leaflet map instance to use for unprojection.
 * @returns {L.LatLng} - The lat/lng position for Leaflet.
 */
function mapDayZToLeaflet(x, z, map) {
  if (isNaN(x) || isNaN(z)) {
    console.error("❌ Invalid DayZ coordinates (NaN detected)!");
    return null;
  }

  try {
    const mapName = resolveMapName(map);
    const mapSize = MAP_SIZES[mapName] || MAP_SIZES.Chernarus;

    // Scale DayZ coordinates into the pixel space of the tile pyramid (0..WORLD_SIZE)
    // DayZ uses bottom-left origin; Leaflet/tile pyramid expects top-left, so flip Y.
    const pixelX = (x / mapSize) * WORLD_SIZE;
    const pixelY = WORLD_SIZE - (z / mapSize) * WORLD_SIZE;

    // Use map-specific unprojection when available to ensure exact alignment with the tile grid
    if (map?.unproject) {
      return map.unproject([pixelX, pixelY], TILE_MAX_ZOOM);
    }

    // Fallback to CRS conversion when map is not available
    return L.CRS.EPSG3857.pointToLatLng(L.point(pixelX, pixelY), TILE_MAX_ZOOM);
  } catch (error) {
    console.error("🚨 Error during coordinate transformation:", error);
    return null;
  }
}

function scaleToLeaflet(radius, map) {
  if (isNaN(radius) || radius <= 0) {
    // Return null silently for invalid radius - caller will handle
    return null;
  }

  try {
    // Reference point in DayZ world
    const baseX = 5000, baseZ = 5000;
    const coordA = mapDayZToLeaflet(baseX, baseZ, map);
    const coordB = mapDayZToLeaflet(baseX + radius, baseZ, map);

    if (!coordA || !coordB) {
      console.error("❌ Transformation failed while computing scale.");
      return null;
    }

    if (map?.distance) {
      return map.distance(coordA, coordB);
    }

    return L.CRS.EPSG3857.distance(coordA, coordB);
  } catch (error) {
    console.error("🚨 Error during scaling transformation:", error);
    return null;
  }
}


export { mapDayZToLeaflet, scaleToLeaflet };
