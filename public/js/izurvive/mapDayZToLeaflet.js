import { IzurviveTransformation } from "./izurvive.js";
import { Point } from "./transform.js";

const transformation = IzurviveTransformation.chernarusPlus();

/**
 * Convert DayZ XZ coordinates into Leaflet LatLng.
 * @param {number} x - The X coordinate from DayZ.
 * @param {number} z - The Z coordinate from DayZ.
 * @returns {L.LatLng} - The lat/lng position for Leaflet.
 */
function mapDayZToLeaflet(x, z) {
  // console.log(`🔍 Converting DayZ Coordinates: X=${x}, Z=${z}`);

  if (isNaN(x) || isNaN(z)) {
    console.error("❌ Invalid DayZ coordinates (NaN detected)!");
    return null;
  }

  try {
    // Convert DayZ XZ to iZurvive lat/lng
    const izurviveCoordinate = transformation.dayzPointToIzurviveCoordinate(
      new Point(x, z)
    );

    // console.log(
    //   `✅ Converted: DayZ (${x}, ${z}) → iZurvive (Lat: ${izurviveCoordinate.lat}, Lng: ${izurviveCoordinate.lng})`
    // );

    if (isNaN(izurviveCoordinate.lat) || isNaN(izurviveCoordinate.lng)) {
      console.error(
        "❌ Transformation failed: NaN detected in iZurvive output!"
      );
      return null;
    }

    // Return LatLng directly (Leaflet uses LatLng, same as iZurvive)
    return new L.LatLng(izurviveCoordinate.lat, izurviveCoordinate.lng);
  } catch (error) {
    console.error("🚨 Error during coordinate transformation:", error);
    return null;
  }
}

function scaleToLeaflet(radius) {
  if (isNaN(radius) || radius <= 0) {
    // Return null silently for invalid radius - caller will handle
    return null;
  }

  try {
    // Reference point in DayZ world
    const baseX = 5000, baseZ = 5000;
    const pointA = new Point(baseX, baseZ);
    const pointB = new Point(baseX + radius, baseZ); // Offset in X direction

    // Convert both points to iZurvive coordinates
    const coordA = transformation.dayzPointToIzurviveCoordinate(pointA);
    const coordB = transformation.dayzPointToIzurviveCoordinate(pointB);

    if (isNaN(coordA.lat) || isNaN(coordA.lng) || isNaN(coordB.lat) || isNaN(coordB.lng)) {
      console.error("❌ Transformation failed: NaN detected in iZurvive output!");
      return null;
    }

    // Calculate distance using haversine formula
    const earthRadius = 6378137; // Earth radius in meters
    const rad = Math.PI / 180;
    const dLat = (coordB.lat - coordA.lat) * rad;
    const dLng = (coordB.lng - coordA.lng) * rad;
    const lat1 = coordA.lat * rad;
    const lat2 = coordB.lat * rad;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = earthRadius * c;

    return distance;
  } catch (error) {
    console.error("🚨 Error during scaling transformation:", error);
    return null;
  }
}


export { mapDayZToLeaflet, scaleToLeaflet };
