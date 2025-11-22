import { IzurviveTransformation } from "../izurvive/izurvive.js";
import { mapDayZToLeaflet } from "../izurvive/mapDayZToLeaflet.js";
import { createCityMarker } from "./markers.js";

async function fetchData(endpoint) {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Error fetching ${endpoint}`);
    return await response.json();
  } catch (err) {
    console.error(`❌ Error loading ${endpoint}:`, err);
    return null;
  }
}

export async function loadMapData(map) {
  const players = await fetchData("/api/players");
  const bases = await fetchData("/api/bases");
  const spawners = await fetchData("/api/spawners");
  const zones = await fetchData("/api/zones");

  if (players) displayPlayers(map, players.players);
  if (bases) displayBases(map, bases.bases);
  if (spawners) displaySpawners(map, spawners.spawners);
  if (zones) displayZones(map, zones.zones);
}

export async function loadCityData(map) {
  const response = await fetch("/dayzdata/citynames_xy.json");

  if (!response.ok) {
    console.error("❌ Failed to fetch citynames.json:", response.status);
    return;
  }

  const cities = await response.json();

  //console.log("✅ Loaded city data:", cities);


  const markersByType = {};

  cities.forEach((city) => {
    const { x, y, nameEN, type, minZoom } = city;
    const latLng = mapDayZToLeaflet(x, y);

    // console.log(`📍 Creating marker for: ${nameEN} at`, latLng);

    const marker = createCityMarker(latLng, nameEN, x, y, minZoom, type);
    // console.log("✅ Marker created:", marker);

    if (!markersByType[type]) {
      markersByType[type] = [];
    }
    markersByType[type].push(marker);
  });

  return markersByType;
}

export async function loadLootMapData(map) {
  const response = await fetch("./dayzdata/lootmap.json"); // Update path as needed
  const lootData = await response.json();
  const markers = {};

  lootData.static.forEach((category) => {
    category.types.forEach((type) => {
      const typeName = type.name;
      if (!markers[typeName]) markers[typeName] = [];
      type.objects.forEach((object) => {
        object.positions.forEach(([lat, lng]) => {
          const latLng = map.unproject([lng, lat], 6); // Convert coordinates
          const marker = L.marker(latLng, {
            icon: L.divIcon({
              html: `<svg height="12" width="12"><circle cx="6" cy="6" r="5" fill="blue" /></svg>`,
              className: "custom-marker",
            }),
          });
          markers[typeName].push(marker);
        });
      });
    });
  });

  return markers;
}
