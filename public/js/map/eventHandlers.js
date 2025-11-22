export function handleZoom(map, markersByType) {
  map.on("zoomend", () => {
    const currentZoom = map.getZoom();

    Object.keys(markersByType).forEach((type) => {
      const checkbox = document.querySelector(`.category-item[data-type="${type}"]`);

      // If no checkbox exists, skip silently (city markers don't have checkboxes)
      if (!checkbox) {
        return;
      }

      const isChecked = checkbox.checked;

      markersByType[type].forEach((marker) => {
        if (currentZoom >= marker.minZoom && currentZoom <= marker.maxZoom && isChecked) {
          map.addLayer(marker);
        } else {
          map.removeLayer(marker);
        }
      });
    });
  });
}


export function handleMapType(document, map, tileLayers, currentLayer) {
  const radioButtons = document.querySelectorAll('input[name="mapType"]');
  radioButtons.forEach((button) =>
    button.addEventListener("change", (e) => {
      const selectedType = e.target.value; // Get the map type (e.g., "Top", "Sat")
      if (currentLayer) {
        map.removeLayer(currentLayer); // Remove the current layer
      }
      currentLayer = tileLayers[selectedType].addTo(map); // Add the new layer
      console.log(`Switched to ${selectedType} layer`); // Debugging info
    })
  );

  // Return the updated currentLayer
  return currentLayer;
}

export function handleTypeToggle(map, markersByType) {
  // Attach event listeners to checkboxes
  const checkboxes = document.querySelectorAll(".category-item");

  checkboxes.forEach((checkbox) => {
    const type = checkbox.dataset.type;

    // On page load, add markers for checked types
    if (checkbox.checked) {
      markersByType[type]?.forEach((marker) => marker.addTo(map));
    }

    // Toggle visibility when checkbox is changed
    checkbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;

      if (isChecked) {
        markersByType[type]?.forEach((marker) => marker.addTo(map));
      } else {
        markersByType[type]?.forEach((marker) => marker.remove());
      }
    });
  });
}
export function handleLayerToggle(map, markers, layerState) {
  document.querySelectorAll(".category-item").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const typeName = e.target.dataset.id;
      if (!markers[typeName]) return;

      if (e.target.checked) {
        markers[typeName].forEach((marker) => map.addLayer(marker));
        layerState[typeName] = true;
      } else {
        markers[typeName].forEach((marker) => map.removeLayer(marker));
        layerState[typeName] = false;
      }
    });
  });
}
