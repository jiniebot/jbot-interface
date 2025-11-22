// Function to create a marker
export function createCityMarker(latLng, cityName, x, y, minZoom, type) {
  const typeColors = {
    Camp: "blue",
    Capital: "red",
    City: "green",
    Hill: "orange",
    Local: "purple",
    Marine: "teal",
    RailroadStation: "brown",
    Ruin: "gray",
    Village: "yellow",
  };

  const markerColor = typeColors[type] || "black"; // Default to black if type is not defined


  const markerIcon = L.divIcon({
    className: "city-marker",
    html: `
      <div style="position: relative; text-align: center;">
          <!-- City name above -->
          <div style="
              position: absolute;
              top: -18px; /* Position above the circle */
              left: 50%; 
              transform: translateX(-50%); /* Center horizontally */
              font-weight: bold; 
              font-size: 14px; 
              color: black; 
              text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
              white-space: nowrap;">
              ${cityName}
          </div>
          <!-- Circle marker -->
          <svg height="10" width="10" style="overflow: visible; cursor: pointer;" class="city-circle">
              <circle cx="5" cy="5" r="5" style="fill: ${markerColor}; stroke: black; stroke-width: 1;" />
          </svg>
      </div>`,
    iconAnchor: [5, 5], // Anchor the circle's center
  });

  // Create the marker
  const marker = L.marker(latLng, { icon: markerIcon, title: cityName });

  // Attach minZoom as a custom property
  marker.minZoom = minZoom;
  marker.maxZoom = 6; // Max zoom is always 6

  // Add interactivity for hover
  marker.on("mouseover", (e) => {
    const circle = e.target._icon.querySelector(".city-circle circle");
    circle.style.fill = "yellow"; // Change color on hover
  });
  marker.on("mouseout", (e) => {
    const circle = e.target._icon.querySelector(".city-circle circle");
    circle.style.fill = markerColor; // Revert to original color
  });

  return marker;
}
