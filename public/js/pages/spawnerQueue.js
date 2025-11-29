const state = {
  queue: [],
  files: {
    objectSpawners: {
      remoteNotInCfg: [],
      cfgNotOnRemote: [],
      cfgFiles: [],
    },
    pra: {
      remoteNotInCfg: [],
      cfgNotOnRemote: [],
      cfgFiles: [],
    },
    spawnGear: {
      remoteNotInCfg: [],
      cfgNotOnRemote: [],
      cfgFiles: [],
    },
  },
  stats: null,
  search: "",
  queueStatus: { status: 'idle', isProcessing: false },
  connectionState: {
    connected: false,
    retrying: false,
    retryCount: 0,
    maxRetries: 10,
    retryDelay: 2000, // Start with 2 seconds
  }
};

const overlay = document.getElementById("page-loading-overlay");
const queueListEl = document.getElementById("queueList");
const queueEmptyEl = document.getElementById("queueEmpty");
const uploadStatusEl = document.getElementById("uploadStatus");
const uploadPanel = document.getElementById("uploadPanel");
const statsPanel = document.getElementById("statsPanel");

let lastRefreshAt = 0;
let processing = false;
let lastProcessAt = 0;
let statusPollInterval = null;
let webhookRegistered = false;
let socket = null;
const panelSearch = {
  spawnerAdd: "",
  spawnerRemove: "",
  praAdd: "",
  praRemove: "",
  spawnAdd: "",
  spawnRemove: "",
};

document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  loadAll();
  initializeWebhook();
  initializeSocket();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Disconnect socket when tab is hidden to save resources
    if (socket && socket.connected) {
      socket.disconnect();
      console.log('📡 Socket disconnected (tab hidden)');
    }
  } else {
    // Reconnect when tab is visible
    if (socket && !socket.connected) {
      socket.connect();
      console.log('📡 Socket reconnecting (tab visible)');
    }
    // Load fresh data when returning to tab
    loadQueueStatus();
    loadQueue();
  }
});

window.addEventListener("beforeunload", () => {
  cleanupWebhook();
  if (socket) {
    socket.disconnect();
    console.log('📡 Socket disconnected (page unload)');
  }
});

function bindControls() {
  document.getElementById("backToDashboard")?.addEventListener("click", () => {
    window.location.href = "/dashboard";
  });

  document.getElementById("refreshBtn")?.addEventListener("click", loadAll);
  document.getElementById("toggleUploadBtn")?.addEventListener("click", toggleUploadPanel);
  document.getElementById("toggleStatsBtn")?.addEventListener("click", toggleStatsPanel);
  document.getElementById("processNowBtn")?.addEventListener("click", processQueue);
  document.getElementById("processQueueBtn")?.addEventListener("click", processQueue);
  document.getElementById("clearQueueBtn")?.addEventListener("click", clearQueue);
  document.getElementById("reloadFilesBtn")?.addEventListener("click", () => loadFiles(state.search));
  document.getElementById("uploadJsonBtn")?.addEventListener("click", handleUpload);
  document.getElementById("statsToggle")?.addEventListener("click", toggleStatsPanel);

  document.getElementById("menuButton")?.addEventListener("click", toggleMenu);
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("menuDropdown");
    const menuButton = document.getElementById("menuButton");
    const toggleUploadBtn = document.getElementById("toggleUploadBtn");
    if (!menu?.contains(e.target) && !menuButton?.contains(e.target)) {
      menu?.classList.remove("show");
    }
    if (!uploadPanel?.contains(e.target) && !toggleUploadBtn?.contains(e.target)) {
      // Close upload panel when clicking elsewhere
      closeUploadPanel();
    }
  });

  wireSearch("searchSpawnerAdd", "spawnerAdd");
  wireSearch("searchSpawnerRemove", "spawnerRemove");
  wireSearch("searchPraAdd", "praAdd");
  wireSearch("searchPraRemove", "praRemove");
  wireSearch("searchSpawnAdd", "spawnAdd");
  wireSearch("searchSpawnRemove", "spawnRemove");

  // Collapse stats panel by default
  if (statsPanel) statsPanel.classList.add("hidden");
}

function toggleMenu() {
  const menu = document.getElementById("menuDropdown");
  const willShow = !menu?.classList.contains("show");
  closeUploadPanel();
  menu?.classList.toggle("show", willShow);
  if (willShow && menu) {
    menu.style.top = `${(uploadPanel?.getBoundingClientRect().top || 80) - 10}px`;
    menu.style.right = `${(window.innerWidth - (uploadPanel?.getBoundingClientRect().right || window.innerWidth - 20)) + 0}px`;
  }
}

function toggleStatsPanel() {
  if (!statsPanel) return;
  const shouldShow = statsPanel.classList.contains("hidden");
  statsPanel.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    statsPanel.classList.add("collapsed");
  } else {
    statsPanel.classList.remove("collapsed");
  }
}

function toggleUploadPanel() {
  if (!uploadPanel) return;
  const willShow = uploadPanel.classList.contains("hidden");
  closeMenus();
  uploadPanel.classList.toggle("hidden", !willShow);
  if (willShow) {
    statsPanel?.classList.add("hidden");
  }
}

function closeUploadPanel() {
  if (!uploadPanel) return;
  uploadPanel.classList.add("hidden");
}

function closeMenus() {
  document.getElementById("menuDropdown")?.classList.remove("show");
}

function setLoading(isLoading) {
  if (!overlay) return;
  overlay.classList.toggle("hidden", !isLoading);
  if (overlay && isLoading) {
    const loadingText = overlay.querySelector('.loading-text');
    if (loadingText && state.connectionState.retrying) {
      loadingText.textContent = `Connecting to backend... (attempt ${state.connectionState.retryCount + 1}/${state.connectionState.maxRetries})`;
    } else if (loadingText) {
      loadingText.textContent = 'Syncing queue...';
    }
  }
}

async function retryableFetch(url, options = {}, retries = state.connectionState.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      // If successful, mark as connected
      if (response.ok || response.status < 500) {
        state.connectionState.connected = true;
        state.connectionState.retrying = false;
        state.connectionState.retryCount = 0;
        return response;
      }
      
      // Server error, retry
      throw new Error(`Server error: ${response.status}`);
    } catch (error) {
      const isLastAttempt = i === retries - 1;
      const isConnectionError = error.message.includes('Failed to fetch') || 
                                 error.message.includes('NetworkError') ||
                                 error.message.includes('ECONNREFUSED') ||
                                 error.name === 'TypeError'; // Fetch throws TypeError for network errors
      
      if (isConnectionError && !isLastAttempt) {
        state.connectionState.retrying = true;
        state.connectionState.retryCount = i;
        
        // Exponential backoff with jitter: 2s, 4s, 6s, 8s, 10s...
        const delay = Math.min(state.connectionState.retryDelay * (i + 1), 10000);
        const jitter = Math.random() * 1000;
        
        console.log(`[Retry] Connection failed, retrying in ${Math.round(delay + jitter)}ms (attempt ${i + 1}/${retries})`);
        setLoading(true); // Update loading text with retry count
        
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        continue;
      }
      
      // Non-connection error or last attempt
      state.connectionState.connected = false;
      state.connectionState.retrying = false;
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

async function loadAll(force = false) {
  const now = Date.now();
  if (!force && now - lastRefreshAt < 60000) {
    return;
  }
  lastRefreshAt = now;
  setLoading(true);
  
  try {
    await Promise.all([loadQueue(), loadQueueStatus(), loadFiles(), loadStats()]);
    // Ensure UI reflects current processing state
    updateProcessingUI();
    
    // If we successfully loaded, mark as connected
    if (!state.connectionState.connected) {
      console.log('[Connection] Successfully connected to backend');
      state.connectionState.connected = true;
      state.connectionState.retrying = false;
      state.connectionState.retryCount = 0;
    }
  } catch (error) {
    console.error('[Connection] Failed to load data:', error);
    
    // If initial load fails, show error message
    if (!state.connectionState.connected) {
      showConnectionError();
    }
  } finally {
    setLoading(false);
  }
}

async function loadQueue() {
  try {
    const res = await retryableFetch("/api/queue-manager/queue");
    const data = await res.json();
    state.queue = data.queue || data.items || [];
    
    // Update status from queue response if available
    if (data.status) {
      const wasProcessing = state.queueStatus.isProcessing;
      state.queueStatus = {
        status: data.status.status || 'idle',
        isProcessing: data.status.status === 'processing',
        startedAt: data.status.startedAt,
        queueLength: state.queue.length
      };
      
      // Update UI if status changed
      if (wasProcessing !== state.queueStatus.isProcessing) {
        console.log(`[Queue] Processing status changed: ${wasProcessing} → ${state.queueStatus.isProcessing}`);
        updateProcessingUI();
        
        // Show user feedback
        if (state.queueStatus.isProcessing) {
          showUploadStatus("Queue is being processed by the backend...", "info");
        } else if (wasProcessing) {
          showUploadStatus("Queue processing completed!", "success");
        }
      }
    }
    
    renderQueue();
  } catch (error) {
    console.error("Failed to load queue", error);
    renderQueue(true);
  }
}

async function loadFiles() {
  try {
    const res = await retryableFetch(`/api/queue-manager/files`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.files = {
      objectSpawners: data.objectSpawners || state.files.objectSpawners,
      pra: data.pra || state.files.pra,
      spawnGear: data.spawnGear || state.files.spawnGear,
    };
    renderFilePanels();
  } catch (error) {
    console.error("Failed to load files", error);
    renderFilePanels(true);
  }
}

async function loadStats() {
  try {
    const res = await retryableFetch("/api/queue-manager/stats");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.stats = data;
    renderStats(data);
  } catch (error) {
    console.error("Failed to load stats", error);
    renderStats(null, true);
  }
}

function renderQueue(hasError = false) {
  if (!queueListEl || !queueEmptyEl) return;

  // Track existing item IDs for animation
  const existingIds = new Set(
    Array.from(queueListEl.querySelectorAll('.queue-item')).map(el => el.dataset.itemId)
  );

  queueListEl.innerHTML = "";
  queueEmptyEl.style.display = "none";

  if (hasError) {
    queueListEl.innerHTML = `<div class="helper-text muted">Could not load queue.</div>`;
    return;
  }

  if (!state.queue || state.queue.length === 0) {
    queueEmptyEl.style.display = "block";
    return;
  }

  state.queue.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "queue-item";
    
    // Use item.id if available, fallback to index for backwards compatibility
    const identifier = item.id || idx;
    div.dataset.itemId = identifier;
    
    // Add flash animation for new items
    if (!existingIds.has(String(identifier))) {
      div.classList.add('queue-item-new');
      setTimeout(() => div.classList.remove('queue-item-new'), 500);
    }
    
    div.innerHTML = `
      <div class="queue-meta">
        <div class="queue-file">${item.fileName || "Unnamed"}</div>
        <div class="queue-action">${formatActionLabel(item.action)}</div>
      </div>
      <div class="queue-actions">
        <button class="ios-button ghost" data-id="${identifier}" aria-label="remove">Remove</button>
      </div>
    `;

    div.querySelector("button")?.addEventListener("click", () => removeQueueItem(identifier));
    queueListEl.appendChild(div);
  });
}

function renderFilePanels(hasError = false) {
  const spawnerAddEl = document.getElementById("remoteNotInCfg");
  const spawnerRemoveEl = document.getElementById("cfgNotOnRemote");
  const praAddEl = document.getElementById("praRemoteNotInCfg");
  const praRemoveEl = document.getElementById("praCfgList");
  const spawnAddEl = document.getElementById("spawnRemoteNotInCfg");
  const spawnRemoveEl = document.getElementById("spawnCfgList");

  const clearNodes = (els) => els.forEach((el) => el && (el.innerHTML = ""));
  clearNodes([spawnerAddEl, spawnerRemoveEl, praAddEl, praRemoveEl, spawnAddEl, spawnRemoveEl]);

  if (hasError) {
    [spawnerAddEl, spawnerRemoveEl, praAddEl, praRemoveEl, spawnAddEl, spawnRemoveEl].forEach((el) => {
      if (el) el.innerHTML = `<div class="helper-text muted">Unable to load.</div>`;
    });
    return;
  }

  fillList(
    spawnerAddEl,
    filterBySearch(state.files.objectSpawners.remoteNotInCfg, panelSearch.spawnerAdd),
    (name) => addToQueue(name, "add-noupload")
  );
  fillList(
    spawnerRemoveEl,
    filterBySearch(state.files.objectSpawners.cfgFiles, panelSearch.spawnerRemove),
    (name) => addToQueue(name, "remove")
  );

  fillList(
    praAddEl,
    filterBySearch(state.files.pra.remoteNotInCfg, panelSearch.praAdd),
    (name) => addToQueue(name, "add-pra-noupload")
  );
  fillList(
    praRemoveEl,
    filterBySearch(state.files.pra.cfgFiles, panelSearch.praRemove),
    (name) => addToQueue(name, "remove-pra")
  );

  fillList(
    spawnAddEl,
    filterBySearch(state.files.spawnGear.remoteNotInCfg, panelSearch.spawnAdd),
    (name) => addToQueue(name, "add-spawngear-noupload")
  );
  fillList(
    spawnRemoveEl,
    filterBySearch(state.files.spawnGear.cfgFiles, panelSearch.spawnRemove),
    (name) => addToQueue(name, "remove-spawngear")
  );
}

function fillList(container, items, queueAction) {
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="helper-text muted">Nothing here.</div>`;
    return;
  }
  items.forEach((name) => {
    const isTight = name.length > 28;
    const pill = buildPill(name, [{ label: "Queue", action: () => queueAction(name) }], isTight);
    container.appendChild(pill);
  });
}

function buildPill(name, actions = [], tight = false) {
  const pill = document.createElement("div");
  pill.className = `pill${tight ? " tight" : ""}`;
  const fileLabel = document.createElement("div");
  fileLabel.className = "file-name";
  fileLabel.textContent = name;
  pill.appendChild(fileLabel);

  if (actions.length) {
    const actionsEl = document.createElement("div");
    actionsEl.className = "pill-actions";
    actions.forEach(({ label, action }) => {
      const btn = document.createElement("button");
      btn.className = "ios-button ghost";
      btn.textContent = label;
      btn.addEventListener("click", action);
      actionsEl.appendChild(btn);
    });
    pill.appendChild(actionsEl);
  }

  return pill;
}

function formatActionLabel(action) {
  switch (action) {
    case "add":
      return "➕ Add to CFG & upload";
    case "add-noupload":
      return "➕ Add to CFG (no upload)";
    case "remove":
      return "🗑️ Remove from CFG";
    case "add-pra":
      return "➕ Add PRA";
    case "remove-pra":
      return "🗑️ Remove PRA";
    case "add-spawngear":
      return "➕ Add spawn gear";
    case "remove-spawngear":
      return "🗑️ Remove spawn gear";
    case "update-settings":
      return "⚙️ Apply CFG settings";
    default:
      return action || "action";
  }
}

async function addToQueue(fileName, action) {
  // Check if processing is active
  if (state.queueStatus.isProcessing) {
    showUploadStatus("Cannot add items while processing is active.", "error");
    return;
  }
  
  try {
    setLoading(true);
    const res = await retryableFetch("/api/queue-manager/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, action }),
    }, 3);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add to queue");
    state.queue = data.queue || state.queue;
    renderQueue();
    showUploadStatus(`Queued ${fileName} (${action})`, "success");
  } catch (error) {
    console.error("Queue add failed", error);
    showUploadStatus(error.message || "Failed to queue file", "error");
  } finally {
    setLoading(false);
  }
}

async function removeQueueItem(idOrIndex) {
  // Check if processing is active
  if (state.queueStatus.isProcessing) {
    showUploadStatus("Cannot remove items while processing is active.", "error");
    return;
  }
  
  try {
    setLoading(true);
    const res = await retryableFetch(`/api/queue-manager/queue/${idOrIndex}`, {
      method: "DELETE",
    }, 3);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to remove item");
    state.queue = data.queue || [];
    renderQueue();
  } catch (error) {
    console.error("Queue remove failed", error);
    showUploadStatus(error.message || "Failed to remove", "error");
  } finally {
    setLoading(false);
  }
}

async function processQueue() {
  // Check if already processing via backend
  if (state.queueStatus.isProcessing) {
    showUploadStatus("Queue is already being processed by the backend.", "error");
    return;
  }
  
  const now = Date.now();
  if (processing) return;
  if (now - lastProcessAt < 5 * 60 * 1000) {
    showUploadStatus("Queue processing is throttled (5 min).", "error");
    return;
  }
  if (!confirm("Process the queue now? This will apply queued changes immediately.")) {
    return;
  }
  processing = true;
  lastProcessAt = now;
  setProcessingState(true);
  try {
    setLoading(true);
    const res = await retryableFetch("/api/queue-manager/queue/process", { method: "POST" }, 3);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Process failed");
    }
    showUploadStatus("Queue processing kicked off.", "success");
    
    // Immediately poll for status update
    await loadQueueStatus();
  } catch (error) {
    console.error("Process queue failed", error);
    showUploadStatus(error.message || "Unable to process queue", "error");
  } finally {
    setLoading(false);
    setTimeout(() => {
      processing = false;
      setProcessingState(false);
    }, 5000);
  }
}

async function clearQueue() {
  // Check if processing is active
  if (state.queueStatus.isProcessing) {
    showUploadStatus("Cannot clear queue while processing is active.", "error");
    return;
  }
  
  if (!confirm("Clear the current queue?")) return;
  try {
    setLoading(true);
    const res = await retryableFetch("/api/queue-manager/queue/clear", { method: "POST" }, 3);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to clear queue");
    state.queue = data.queue || [];
    renderQueue();
  } catch (error) {
    console.error("Clear queue failed", error);
    showUploadStatus(error.message || "Failed to clear queue", "error");
  } finally {
    setLoading(false);
  }
}

async function handleUpload() {
  const fileInput = document.getElementById("jsonFileInput");
  const actionSelect = document.getElementById("uploadActionSelect");

  const file = fileInput?.files?.[0];
  const action = actionSelect?.value || "add";

  if (!file) {
    showUploadStatus("Choose a JSON file to upload.", "error");
    return;
  }

  // Validate file size on client side (5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    showUploadStatus(`File too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB`, "error");
    return;
  }

  // Validate JSON extension
  if (!file.name.toLowerCase().endsWith('.json')) {
    showUploadStatus("Only .json files are allowed.", "error");
    return;
  }

  closeUploadPanel();

  // Map action to fileType for validation
  const fileTypeMap = {
    'add': 'spawner',
    'add-pra': 'pra',
    'add-spawngear': 'spawngear'
  };
  const fileType = fileTypeMap[action] || 'spawner';

  try {
    setLoading(true);
    
    // Use FormData for secure multipart upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);

    const res = await retryableFetch("/api/spawner-queue/upload", {
      method: "POST",
      body: formData
      // Don't set Content-Type header - browser will set it with boundary
    }, 3);
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.details || data.error || "Upload failed");
    }

    // Show success with metadata
    const metadata = data.metadata || {};
    let successMsg = `✅ Uploaded ${data.file.savedName}`;
    
    if (fileType === 'pra' && metadata.areaName) {
      successMsg += ` (Area: ${metadata.areaName})`;
    } else if (fileType === 'spawngear' && metadata.name) {
      successMsg += ` (${metadata.name})`;
    }
    
    showUploadStatus(successMsg, "success");
    
    // Now add to queue using the saved filename with correct action (add, add-pra, add-spawngear)
    const savedFileName = data.file.savedName.replace(/\.json$/i, "");
    const queueAction = action; // Use the action directly (add, add-pra, add-spawngear)
    
    await addToQueue(savedFileName, queueAction);
    
    // Clear file input
    fileInput.value = "";
    
    // Reload file lists
    await loadFiles(state.search);
  } catch (error) {
    console.error("Upload failed", error);
    showUploadStatus(error.message || "Upload failed", "error");
  } finally {
    setLoading(false);
  }
}

function renderStats(data, hasError = false) {
  const nextRestartValue = document.getElementById("nextRestartValue");
  const nextRestartExact = document.getElementById("nextRestartExact");
  const preQueueValue = document.getElementById("preQueueValue");
  const preQueueExact = document.getElementById("preQueueExact");
  const lastRestartValue = document.getElementById("lastRestartValue");
  const lastRestartExact = document.getElementById("lastRestartExact");
  const queueLastValue = document.getElementById("queueLastValue");
  const queueLastExact = document.getElementById("queueLastExact");
  const serverNameBadge = document.getElementById("serverNameBadge");

  const empty = "—";
  if (hasError || !data) {
    [nextRestartValue, preQueueValue, lastRestartValue, queueLastValue].forEach((el) => {
      if (el) el.textContent = empty;
    });
    [nextRestartExact, preQueueExact, lastRestartExact, queueLastExact].forEach((el) => {
      if (el) el.textContent = "Unavailable";
    });
    if (serverNameBadge) serverNameBadge.textContent = "Queue offline";
    return;
  }

  if (serverNameBadge) serverNameBadge.textContent = data.serverName || "Server";

  const nextRestartMs = data.nextRestartInMs;
  if (nextRestartValue) nextRestartValue.textContent = nextRestartMs != null ? formatDuration(nextRestartMs) : empty;
  if (nextRestartExact) {
    nextRestartExact.textContent = data.restartStats?.predictedNextAtISO
      ? new Date(data.restartStats.predictedNextAtISO).toLocaleString()
      : empty;
  }

  const preQueueMs = data.nextPreQueueInMs;
  if (preQueueValue) preQueueValue.textContent = preQueueMs != null ? formatDuration(preQueueMs) : empty;
  if (preQueueExact) {
    preQueueExact.textContent = data.restartStats?.preQueue?.forRestartAtISO
      ? new Date(data.restartStats.preQueue.forRestartAtISO).toLocaleTimeString()
      : empty;
  }

  if (lastRestartValue) {
    lastRestartValue.textContent = data.lastRestartISO
      ? timeAgo(new Date(data.lastRestartISO))
      : empty;
  }
  if (lastRestartExact) {
    lastRestartExact.textContent = data.lastRestartISO
      ? new Date(data.lastRestartISO).toLocaleString()
      : empty;
  }

  if (queueLastValue) {
    queueLastValue.textContent = data.queueLastProcessedInMs != null
      ? `${Math.round(data.queueLastProcessedInMs / 60000)}m ago`
      : empty;
  }
  if (queueLastExact) {
    queueLastExact.textContent = data.restartStats?.queue?.lastProcessedAtISO
      ? new Date(data.restartStats.queue.lastProcessedAtISO).toLocaleString()
      : empty;
  }
}

function formatDuration(ms) {
  if (ms == null) return "—";
  const isPast = ms < 0;
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const label = `${hours}h ${minutes}m`;
  return isPast ? `${label} ago` : label;
}

function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function showUploadStatus(message, type = "info") {
  if (!uploadStatusEl) return;
  uploadStatusEl.textContent = message;
  uploadStatusEl.style.color = type === "error" ? "#ff8a8a" : type === "success" ? "#7cf29c" : "#cdd2da";
}

function showConnectionError() {
  // Show error in queue panel
  if (queueListEl) {
    queueListEl.innerHTML = `
      <div class="helper-text muted" style="text-align: center; padding: 20px;">
        <div style="font-size: 32px; margin-bottom: 10px;">⚠️</div>
        <div style="color: #ff8a8a; font-weight: 600; margin-bottom: 8px;">Connection Failed</div>
        <div style="color: #cdd2da; font-size: 13px; margin-bottom: 15px;">
          Unable to connect to backend API after ${state.connectionState.maxRetries} attempts.
        </div>
        <button class="ios-button primary" onclick="location.reload()">
          Retry Connection
        </button>
      </div>
    `;
  }
  
  // Show error in file panels
  const errorHtml = '<div class="helper-text muted" style="text-align: center; padding: 10px;">Backend unavailable</div>';
  document.getElementById("remoteNotInCfg").innerHTML = errorHtml;
  document.getElementById("cfgNotOnRemote").innerHTML = errorHtml;
  document.getElementById("praRemoteNotInCfg").innerHTML = errorHtml;
  document.getElementById("praCfgList").innerHTML = errorHtml;
  document.getElementById("spawnRemoteNotInCfg").innerHTML = errorHtml;
  document.getElementById("spawnCfgList").innerHTML = errorHtml;
}

function wireSearch(inputId, key) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener(
    "input",
    debounce((e) => {
      panelSearch[key] = (e.target.value || "").toLowerCase();
      renderFilePanels();
    }, 150)
  );
}

function filterBySearch(list, keyword) {
  if (!keyword) return list || [];
  return (list || []).filter((item) =>
    (item || "").toLowerCase().includes(keyword)
  );
}

// Webhook and status polling for real-time updates
async function initializeWebhook() {
  try {
    // Register webhook endpoint (in real implementation, this would be a server endpoint)
    // For now, we'll rely on polling instead
    console.log("Webhook initialization (polling fallback enabled)");
  } catch (error) {
    console.error("Failed to initialize webhook:", error);
  }
}

async function cleanupWebhook() {
  if (webhookRegistered) {
    try {
      // Unregister webhook on page unload
      stopStatusPolling();
    } catch (error) {
      console.error("Failed to cleanup webhook:", error);
    }
  }
}

async function loadQueueStatus() {
  try {
    // Use fewer retries for status polling (it happens frequently)
    const res = await retryableFetch("/api/queue-manager/queue/status", {}, 3);
    const data = await res.json();
    
    console.log("[Status API] Response:", data);
    
    if (!res.ok) {
      console.error("Failed to load queue status:", data.error);
      return;
    }
    
    const wasProcessing = state.queueStatus.isProcessing;
    const previousQueueLength = state.queueStatus.queueLength;
    
    console.log(`[Status] wasProcessing: ${wasProcessing}, data.status: ${data.status}, data.isProcessing: ${data.isProcessing}`);
    
    state.queueStatus = {
      status: data.status,
      isProcessing: data.isProcessing || data.status === 'processing',
      startedAt: data.startedAt,
      queueLength: data.queueLength
    };
    
    console.log(`[Status] Updated state.queueStatus.isProcessing: ${state.queueStatus.isProcessing}`);
    
    // Update UI based on processing status
    updateProcessingUI();
    
    // If processing just finished, reload everything
    if (wasProcessing && !state.queueStatus.isProcessing) {
      console.log("Queue processing completed, reloading...");
      await loadQueue();
      await loadFiles();
      showUploadStatus("Queue processing completed!", "success");
    }
    
    // If processing just started, show it
    if (!wasProcessing && state.queueStatus.isProcessing) {
      console.log("Queue processing started...");
      showUploadStatus("Queue is being processed by the backend...", "info");
    }
    
    // If queue length changed (external modification), reload queue
    if (previousQueueLength !== undefined && previousQueueLength !== data.queueLength && !state.queueStatus.isProcessing) {
      console.log(`Queue length changed: ${previousQueueLength} → ${data.queueLength}, reloading...`);
      await loadQueue();
    }
    
  } catch (error) {
    console.error("Failed to load queue status:", error);
  }
}

function updateProcessingUI() {
  const processBtn = document.getElementById("processNowBtn");
  const processQueueBtn = document.getElementById("processQueueBtn");
  const clearBtn = document.getElementById("clearQueueBtn");
  
  const isProcessing = state.queueStatus.isProcessing;
  
  console.log(`[UI] Updating processing UI: isProcessing=${isProcessing}`);
  
  // Disable controls when processing
  if (processBtn) {
    processBtn.disabled = isProcessing;
    // Keep emoji, just gray it out when processing
    processBtn.style.opacity = isProcessing ? "0.5" : "1";
    processBtn.style.filter = isProcessing ? "grayscale(100%)" : "none";
  }
  
  if (processQueueBtn) {
    processQueueBtn.disabled = isProcessing;
    processQueueBtn.textContent = isProcessing ? "Processing..." : "Process Queue";
    processQueueBtn.style.opacity = isProcessing ? "0.5" : "1";
  }
  
  if (clearBtn) {
    clearBtn.disabled = isProcessing;
    clearBtn.style.opacity = isProcessing ? "0.5" : "1";
  }
  
  // Add visual indicator for processing state
  if (queueListEl) {
    if (isProcessing) {
      queueListEl.classList.add('processing');
    } else {
      queueListEl.classList.remove('processing');
    }
  }
  
  // Show processing indicator
  const processingIndicator = document.getElementById("processingIndicator");
  if (processingIndicator) {
    processingIndicator.style.display = isProcessing ? "flex" : "none";
    console.log(`[UI] Processing indicator display set to: ${isProcessing ? "flex" : "none"}`);
  } else {
    console.warn("[UI] Processing indicator element not found!");
  }
}

function initializeSocket() {
  console.log('📡 Initializing Socket.io connection to Queue API...');
  
  // Connect to the queue API server - use environment variable or default to localhost
  const queueApiUrl = window.queueContext.queueApiUrl || 'http://localhost:4310';
  console.log('📡 Connecting to Queue API at:', queueApiUrl);
  
  // Force polling transport for HTTP connections to avoid wss:// upgrade issues
  socket = io(queueApiUrl, {
    transports: ['polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity
  });

  socket.on('connect', () => {
    console.log('📡 Socket connected to Queue API:', socket.id);
    
    // Join the room for this guild+service
    const { guildId, serviceId } = window.queueContext;
    socket.emit('join', { guildId, serviceId });
    console.log(`📡 Joined room: ${guildId}-${serviceId}`);
  });

  socket.on('disconnect', (reason) => {
    console.log('📡 Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('📡 Socket connection error:', error);
  });

  // Listen for queue updates
  socket.on('queueUpdated', (data) => {
    console.log('📡 Received queueUpdated event:', data);
    loadQueue();
    loadQueueStatus();
  });

  socket.on('processingStarted', (data) => {
    console.log('📡 Received processingStarted event:', data);
    loadQueueStatus();
  });

  socket.on('queueCleared', (data) => {
    console.log('📡 Received queueCleared event:', data);
    loadQueue();
    loadQueueStatus();
  });

  // Listen for queue status changes (processing/idle)
  socket.on('queueStatusChanged', (data) => {
    console.log('📡 Received queueStatusChanged event:', data);
    
    const wasProcessing = state.queueStatus.isProcessing;
    
    // Update local state
    state.queueStatus = {
      status: data.status,
      isProcessing: data.isProcessing,
      startedAt: data.startedAt,
      updatedAt: data.updatedAt,
      queueLength: state.queueStatus.queueLength // Preserve queue length
    };
    
    // Update UI based on processing state
    updateProcessingUI();
    
    // If processing just started, show notification
    if (!wasProcessing && data.isProcessing) {
      console.log("Queue processing started...");
      showUploadStatus("Queue is being processed by the backend...", "info");
    }
    
    // If processing finished, reload queue and show notification
    if (wasProcessing && !data.isProcessing) {
      console.log("Queue processing completed, reloading...");
      loadQueue();
      loadFiles();
      showUploadStatus("Queue processing completed!", "success");
    }
  });
}

function startStatusPolling() {
  // Deprecated - now using WebSocket for real-time updates
  // Keeping function for backwards compatibility but it does nothing
  console.log('ℹ️ Polling disabled - using WebSocket for real-time updates');
}

function stopStatusPolling() {
  // Deprecated - now using WebSocket for real-time updates
  // Keeping function for backwards compatibility but it does nothing
}
function setProcessingState(isProcessing) {
  const btns = [document.getElementById("processQueueBtn"), document.getElementById("processNowBtn")];
  btns.forEach((btn) => {
    if (!btn) return;
    btn.disabled = isProcessing;
    btn.classList.toggle("disabled", isProcessing);
  });
}

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
