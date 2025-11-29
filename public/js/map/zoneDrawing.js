import { mapLeafletToDayZ } from "../izurvive/mapDayZToLeaflet.js";

/**
 * Simple draw helper for creating circular and polygonal monitor zones.
 * @param {L.Map} map Leaflet map instance
 * @param {Object} options
 * @param {Function} options.onZoneCreated callback after successful save (e.g., reload zones)
 */
export function setupZoneDrawing(map, { onZoneCreated } = {}) {
  const container = document.getElementById("map-container") || document.body;
  let channelOptions = [];

  const controls = document.createElement("div");
  controls.id = "zone-draw-controls";
  controls.classList.add("collapsed"); // Start collapsed
  controls.innerHTML = `
    <div class="zone-draw-header">
      <div class="zone-draw-title">Monitor Zones</div>
      <div class="zone-draw-subtitle">Draw on map to create a zone</div>
    </div>
    <div class="zone-draw-content">
      <div class="zone-draw-actions">
        <button type="button" class="zone-draw-btn" data-mode="circle">Draw Circle</button>
        <button type="button" class="zone-draw-btn" data-mode="polygon">Draw Polygon</button>
        <button type="button" class="zone-draw-btn ghost" data-action="finish" disabled>Finish</button>
        <button type="button" class="zone-draw-btn ghost" data-action="cancel" disabled>Cancel</button>
      </div>
      <div class="zone-draw-status" id="zoneDrawStatus">Choose a draw mode to begin.</div>
      <div class="zone-meta hidden" id="zoneMetaPanel"></div>
    </div>
  `;
  container.appendChild(controls);

  const statusEl = controls.querySelector("#zoneDrawStatus");
  const metaPanel = controls.querySelector("#zoneMetaPanel");
  const finishBtn = controls.querySelector('[data-action="finish"]');
  const cancelBtn = controls.querySelector('[data-action="cancel"]');

  let mode = null;
  let points = [];
  let previewCircle = null;
  let previewPolyline = null;
  let previewPolygon = null;
  let tempLayer = L.layerGroup().addTo(map);

  const setStatus = (msg) => {
    statusEl.textContent = msg;
  };

  const resetDrawing = () => {
    mode = null;
    points = [];
    tempLayer.clearLayers();
    previewCircle = null;
    previewPolyline = null;
    previewPolygon = null;
    finishBtn.disabled = true;
    cancelBtn.disabled = true;
    setStatus("Choose a draw mode to begin.");
    metaPanel.classList.add("hidden");
    metaPanel.innerHTML = "";
    map.off("click", handleMapClick);
    map.off("mousemove", handleMouseMove);
  };

  const startDrawing = (selectedMode) => {
    resetDrawing();
    mode = selectedMode;
    setStatus(
      selectedMode === "circle"
        ? "Circle: click center, then click edge."
        : "Polygon: click vertices, then Finish."
    );
    finishBtn.disabled = selectedMode === "circle";
    cancelBtn.disabled = false;
    map.on("click", handleMapClick);
    map.on("mousemove", handleMouseMove);
  };

  const handleMouseMove = (e) => {
    if (!mode) return;
    if (mode === "circle" && points.length === 1) {
      const center = points[0];
      const radius = map.distance(center, e.latlng);
      if (!previewCircle) {
        previewCircle = L.circle(center, {
          radius,
          color: "#57F287",
          fillColor: "#57F287",
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(tempLayer);
      } else {
        previewCircle.setRadius(radius);
      }
    }

    if (mode === "polygon" && points.length > 0) {
      const livePoints = [...points, e.latlng];
      if (!previewPolyline) {
        previewPolyline = L.polyline(livePoints, {
          color: "#57F287",
          weight: 2,
          dashArray: "6 4",
        }).addTo(tempLayer);
      } else {
        previewPolyline.setLatLngs(livePoints);
      }
    }
  };

  const updatePolygonPreview = () => {
    if (previewPolygon) {
      previewPolygon.setLatLngs(points);
    } else {
      previewPolygon = L.polygon(points, {
        color: "#57F287",
        fillColor: "#57F287",
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(tempLayer);
    }
    finishBtn.disabled = points.length < 3;
  };

  const handleMapClick = (e) => {
    if (!mode) return;
    if (mode === "circle") {
      points.push(e.latlng);
      if (points.length === 1) {
        setStatus("Now click the edge of the circle.");
      } else if (points.length === 2) {
        finalizeGeometry();
      }
    } else if (mode === "polygon") {
      points.push(e.latlng);
      updatePolygonPreview();
      setStatus("Add vertices, then click Finish to save.");
    }
  };

  const toDayZCoords = (latLng) => mapLeafletToDayZ(latLng, map);

  const buildGeometry = () => {
    if (mode === "circle" && points.length >= 2) {
      const center = points[0];
      const edge = points[1];
      const centerDZ = toDayZCoords(center);
      const edgeDZ = toDayZCoords(edge);
      const dx = edgeDZ.x - centerDZ.x;
      const dz = edgeDZ.z - centerDZ.z;
      const range = Math.max(1, Math.round(Math.sqrt(dx * dx + dz * dz)));
      return {
        zoneType: 0,
        location: [centerDZ.x, 0, centerDZ.z],
        range,
        polygon: [],
        summary: `Center: ${centerDZ.x.toFixed(0)}, ${centerDZ.z.toFixed(
          0
        )} • Range: ${range}m`,
      };
    }

    if (mode === "polygon" && points.length >= 3) {
      const coords = points.map((pt) => {
        const { x, z } = toDayZCoords(pt);
        return { x, y: z };
      });
      return {
        zoneType: 1,
        location: [],
        range: null,
        polygon: coords,
        summary: `Vertices: ${coords.length}`,
      };
    }

    return null;
  };

  const submitZone = async (payload, saveBtn, statusEl) => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    statusEl.textContent = "Saving zone...";

    try {
      const response = await fetch("/api/monitorZones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = err.details || err.error || `Failed to save zone (HTTP ${response.status})`;
        throw new Error(message);
      }

      statusEl.textContent = "Zone saved. Reloading...";
      if (typeof onZoneCreated === "function") {
        await onZoneCreated();
      }
      resetDrawing();
      setStatus("Zone created. Choose a draw mode to add another.");
    } catch (error) {
      console.error("❌ Failed to save monitor zone:", error);
      statusEl.textContent = error.message || "Failed to save zone";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Zone";
    }
  };

  const fetchChannels = async () => {
    try {
      const resp = await fetch("/api/discord/channels");
      if (!resp.ok) return;
      const data = await resp.json();
      channelOptions = data.channels || [];
    } catch (e) {
      // silently ignore if Discord token missing
    }
  };

  const showMetaForm = (geometry) => {
    if (!geometry) return;
    metaPanel.classList.remove("hidden");

    const channelSelect = channelOptions
      .map((ch) => `<option value="${ch.id}">#${ch.name}</option>`)
      .join("");

    metaPanel.innerHTML = `
      <div class="zone-meta-title">Zone Details</div>
      <div class="zone-meta-row">
        <label>Name</label>
        <input type="text" id="zoneMetaName" placeholder="Zone name" required>
      </div>
      <div class="zone-meta-row">
        <label>Type</label>
        <select id="zoneMetaType">
          <option value="Radar">Radar</option>
          <option value="Monitor">Monitor</option>
          <option value="SafeZone">SafeZone</option>
        </select>
      </div>
      <div class="zone-meta-row">
        <label>Radar Channel</label>
        <select id="zoneMetaChannelSelect" ${channelOptions.length ? "" : "disabled"}>
          <option value="">${channelOptions.length ? "Select channel (optional)" : "No channels available"}</option>
          ${channelSelect}
        </select>
      </div>
      <div class="zone-meta-row inline">
        <label class="inline-label">
          <input type="checkbox" id="zoneMetaActive" checked>
          Active
        </label>
        <div class="zone-meta-summary">${geometry.summary}</div>
      </div>
      <div class="zone-meta-actions">
        <button type="button" class="zone-draw-btn primary" id="zoneMetaSave">Save Zone</button>
      </div>
    `;

    const saveBtn = metaPanel.querySelector("#zoneMetaSave");
    const statusLine = document.createElement("div");
    statusLine.className = "zone-meta-status";
    metaPanel.appendChild(statusLine);

    saveBtn.addEventListener("click", () => {
      const name = metaPanel.querySelector("#zoneMetaName")?.value?.trim();
      if (!name) {
        statusLine.textContent = "Name is required.";
        return;
      }

      const type = metaPanel.querySelector("#zoneMetaType")?.value || "Monitor";
      const radarChannelSelect = metaPanel.querySelector("#zoneMetaChannelSelect");
      const radarChannel = (radarChannelSelect && radarChannelSelect.value) || "N/A";
      const isActive = !!metaPanel.querySelector("#zoneMetaActive")?.checked;

      const payload = {
        name,
        type,
        radarChannel,
        isActive,
        zoneType: geometry.zoneType,
        location: geometry.location,
        range: geometry.range,
        polygon: geometry.polygon,
      };

      submitZone(payload, saveBtn, statusLine);
    });
  };

  const finalizeGeometry = () => {
    const geometry = buildGeometry();
    if (!geometry) {
      setStatus("Add more points before finishing.");
      return;
    }
    map.off("click", handleMapClick);
    map.off("mousemove", handleMouseMove);
    finishBtn.disabled = true;
    setStatus("Shape captured. Add details then save.");
    showMetaForm(geometry);
  };

  finishBtn.addEventListener("click", finalizeGeometry);
  cancelBtn.addEventListener("click", () => {
    resetDrawing();
  });

  controls.querySelectorAll(".zone-draw-btn[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = btn.getAttribute("data-mode");
      startDrawing(selected);
    });
  });

  // Expose reset for other modules if needed
  fetchChannels();

  return { reset: resetDrawing };
}
