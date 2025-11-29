// Function to create a marker
export function createCityMarker(latLng, cityName, x, y, minZoom, type) {
  const typeColors = {
    Camp: "rgba(0, 122, 255, 0.6)",
    Capital: "rgba(255, 59, 48, 0.6)",
    City: "rgba(52, 199, 89, 0.6)",
    Hill: "rgba(255, 149, 0, 0.6)",
    Local: "rgba(175, 82, 222, 0.6)",
    Marine: "rgba(90, 200, 250, 0.6)",
    RailroadStation: "rgba(162, 132, 94, 0.6)",
    Ruin: "rgba(142, 142, 147, 0.6)",
    Village: "rgba(255, 204, 0, 0.6)",
  };

  const markerColor = typeColors[type] || "rgba(0, 0, 0, 0.6)"; // Default to semi-transparent black if type is not defined


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
              font-family: 'D-DIN', -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
              font-weight: 600; 
              font-size: 14px; 
              color: #ffffff; 
              text-shadow: none;
              white-space: nowrap;">
              ${cityName}
          </div>
          <!-- Circle marker -->
          <svg height="10" width="10" style="overflow: visible; cursor: pointer;" class="city-circle">
              <circle cx="5" cy="5" r="5" style="fill: ${markerColor}; stroke: #ffffff; stroke-width: 1.5;" />
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
