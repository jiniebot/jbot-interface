// Store Management - Main JavaScript
// Handles drag-and-drop, API calls, and UI interactions

// Global state
let storeData = {
  items: [],
  organized: {},
  shopCategories: [],
  itemCategories: {},
  channelNames: {},
  categoryNames: {} // Item category ID -> Name mapping
};

let currentDraggedItem = null;
let currentEditingItem = null;
let autoScrollInterval = null;
let lastDragY = 0;
let draggedElement = null;
let placeholderElement = null;
let lastDropTarget = null;
let originalPosition = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
});

// Initialize the application
async function initializeApp() {
  try {
    await Promise.all([
      loadItemCategories(),
      loadStoreItems()
    ]);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Failed to load store data');
  }
}

// Load item categories (default + custom)
async function loadItemCategories() {
  try {
    const response = await fetch('/api/store/item-categories');
    const data = await response.json();
    
    if (data.success) {
      storeData.categoryNames = data.categories || {};
      
      // Populate item category datalist for the form
      const itemCategoryList = document.getElementById('itemCategoryList');
      if (itemCategoryList) {
        itemCategoryList.innerHTML = Object.entries(storeData.categoryNames)
          .map(([id, name]) => `<option value="${id}">${name}</option>`)
          .join('');
      }
    }
  } catch (error) {
    console.error('Error loading item categories:', error);
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Top controls
  document.getElementById('backToDashboard')?.addEventListener('click', () => {
    window.location.href = '/dashboard';
  });
  
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    loadStoreItems();
  });
  
  document.getElementById('addItemBtn')?.addEventListener('click', () => {
    openAddItemModal();
  });
  
  // Empty state add button
  document.getElementById('emptyStateAddBtn')?.addEventListener('click', () => {
    openAddItemModal();
  });
  
  // Menu toggle
  document.getElementById('menuButton')?.addEventListener('click', toggleMenu);
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('menuDropdown');
    const menuButton = document.getElementById('menuButton');
    if (!menu?.contains(e.target) && !menuButton?.contains(e.target)) {
      menu?.classList.remove('show');
    }
  });
  
  // Item form submission
  document.getElementById('itemForm')?.addEventListener('submit', handleItemFormSubmit);
  
  // Item modal close buttons
  document.getElementById('closeItemModalBtn')?.addEventListener('click', closeItemModal);
  document.getElementById('cancelItemModalBtn')?.addEventListener('click', closeItemModal);
  
  // Item details modal close buttons
  document.getElementById('closeItemDetailsModalBtn')?.addEventListener('click', closeItemDetailsModal);
  document.getElementById('closeItemDetailsModalBtn2')?.addEventListener('click', closeItemDetailsModal);
  document.getElementById('editCurrentItemBtn')?.addEventListener('click', editCurrentItem);
  document.getElementById('deleteCurrentItemBtn')?.addEventListener('click', deleteCurrentItem);
  
  // Close modals on backdrop click
  document.getElementById('itemModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'itemModal') closeItemModal();
  });
  
  document.getElementById('itemDetailsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'itemDetailsModal') closeItemDetailsModal();
  });
}

// Toggle menu dropdown
function toggleMenu() {
  const menu = document.getElementById('menuDropdown');
  menu?.classList.toggle('show');
}

// Load store items from API
async function loadStoreItems() {
  const loadingSpinner = document.getElementById('loadingSpinner');
  const storeContent = document.getElementById('storeContent');
  const emptyState = document.getElementById('emptyState');
  
  loadingSpinner.style.display = 'flex';
  storeContent.style.display = 'none';
  
  try {
    const response = await fetch('/api/store/items');
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load items');
    }
    
    storeData.items = data.items;
    storeData.organized = data.organized;
    storeData.channelNames = data.channelNames || {};
    
    // Extract shop categories
    storeData.shopCategories = Object.keys(data.organized).sort();
    
    loadingSpinner.style.display = 'none';
    
    if (storeData.items.length === 0) {
      emptyState.style.display = 'flex';
      storeContent.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      storeContent.style.display = 'block';
      renderStoreItems();
    }
  } catch (error) {
    console.error('Error loading store items:', error);
    loadingSpinner.style.display = 'none';
    showError('Failed to load store items: ' + error.message);
  }
}

// Render all store items
function renderStoreItems() {
  const container = document.getElementById('shopCategoriesContainer');
  container.innerHTML = '';
  
  // Populate shop category datalist for the form
  const shopCategoryList = document.getElementById('shopCategoryList');
  if (shopCategoryList) {
    shopCategoryList.innerHTML = storeData.shopCategories
      .map(cat => `<option value="${cat}">`)
      .join('');
  }
  
  // Render each shop category
  storeData.shopCategories.forEach(shopCategory => {
    const shopCategoryEl = createShopCategoryElement(shopCategory);
    container.appendChild(shopCategoryEl);
  });
}

// Create a shop category element
function createShopCategoryElement(shopCategory) {
  const itemsByCategory = storeData.organized[shopCategory];
  const itemCategories = Object.keys(itemsByCategory).sort((a, b) => a - b);
  const totalItems = Object.values(itemsByCategory).reduce((sum, items) => sum + items.length, 0);
  
  // Get channel name or use ID as fallback
  const channelName = storeData.channelNames[shopCategory] || shopCategory;
  
  const shopCategoryDiv = document.createElement('div');
  shopCategoryDiv.className = 'shop-category';
  shopCategoryDiv.dataset.shopCategory = shopCategory;
  
  // Header
  const header = document.createElement('div');
  header.className = 'shop-category-header';
  header.innerHTML = `
    <div class="shop-category-title">
      <div class="shop-category-icon">🛒</div>
      <div>
        <span class="shop-category-name">${channelName}</span>
        <span class="shop-category-count">(${totalItems} items)</span>
      </div>
    </div>
    <div class="shop-category-toggle">▼</div>
  `;
  
  header.addEventListener('click', () => {
    shopCategoryDiv.classList.toggle('collapsed');
  });
  
  // Content
  const content = document.createElement('div');
  content.className = 'shop-category-content';
  
  // Render each item category
  itemCategories.forEach(itemCategory => {
    const itemCategoryEl = createItemCategoryElement(shopCategory, itemCategory, itemsByCategory[itemCategory]);
    content.appendChild(itemCategoryEl);
  });
  
  shopCategoryDiv.appendChild(header);
  shopCategoryDiv.appendChild(content);
  
  return shopCategoryDiv;
}

// Create an item category element
function createItemCategoryElement(shopCategory, itemCategory, items) {
  const itemCategoryDiv = document.createElement('div');
  itemCategoryDiv.className = 'item-category';
  itemCategoryDiv.dataset.shopCategory = shopCategory;
  itemCategoryDiv.dataset.itemCategory = itemCategory;
  
  // Get category name
  const categoryName = storeData.categoryNames[itemCategory] || `Category ${itemCategory}`;
  
  // Header
  const header = document.createElement('div');
  header.className = 'item-category-header';
  header.innerHTML = `
    <div class="item-category-title">
      <span>${categoryName}</span>
      <span class="item-category-badge">${items.length}</span>
    </div>
  `;
  
  // Items grid
  const grid = document.createElement('div');
  grid.className = items.length === 0 ? 'items-grid empty' : 'items-grid';
  
  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-category-message">No items in this category</div>';
  } else {
    items.forEach(item => {
      const itemEl = createShopItemElement(item);
      grid.appendChild(itemEl);
    });
  }
  
  itemCategoryDiv.appendChild(header);
  itemCategoryDiv.appendChild(grid);
  
  // Setup drop zone AFTER grid is created and appended
  setupDropZone(itemCategoryDiv);
  
  return itemCategoryDiv;
}

// Create a shop item element
function createShopItemElement(item) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'shop-item';
  itemDiv.draggable = true;
  itemDiv.dataset.itemId = item._id;
  
  // Setup drag events
  setupDragEvents(itemDiv, item);
  
  // Create image container
  const imageDiv = document.createElement('div');
  imageDiv.className = 'item-image';
  
  if (item.imagePath) {
    const img = document.createElement('img');
    img.src = item.imagePath;
    img.alt = item.name;
    img.onerror = function() {
      this.parentElement.innerHTML = '<div class="item-image-placeholder">📦</div>';
    };
    imageDiv.appendChild(img);
  } else {
    imageDiv.innerHTML = '<div class="item-image-placeholder">📦</div>';
  }
  
  if (item.factionLevel > -1) {
    const badge = document.createElement('div');
    badge.className = 'item-faction-badge';
    badge.textContent = `LVL ${item.factionLevel}`;
    imageDiv.appendChild(badge);
  }
  
  // Create info section
  const infoDiv = document.createElement('div');
  infoDiv.className = 'item-info';
  infoDiv.innerHTML = `
    <div class="item-name" title="${item.name}">${item.name}</div>
    <div class="item-description">${item.description}</div>
  `;
  
  // Create details section
  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'item-details';
  detailsDiv.innerHTML = `
    <div class="item-price">💰 ${item.price}</div>
    <div class="item-quantity">x${item.maxQuantity}</div>
  `;
  
  // Create actions section
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'item-actions';
  
  const editBtn = document.createElement('button');
  editBtn.className = 'item-action-btn edit';
  editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditItemModal(item._id);
  });
  
  const viewBtn = document.createElement('button');
  viewBtn.className = 'item-action-btn';
  viewBtn.innerHTML = '<i class="fas fa-eye"></i> View';
  viewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    viewItemDetails(item._id);
  });
  
  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(viewBtn);
  
  // Assemble the item
  itemDiv.appendChild(imageDiv);
  itemDiv.appendChild(infoDiv);
  itemDiv.appendChild(detailsDiv);
  itemDiv.appendChild(actionsDiv);
  
  return itemDiv;
}

// Setup drag events for an item
function setupDragEvents(element, item) {
  element.addEventListener('dragstart', (e) => {
    console.log('🚀 DRAGSTART:', {
      itemId: item._id,
      itemName: item.name,
      shopCategory: item.shopCategory,
      itemCategory: item.itemCategory
    });
    
    currentDraggedItem = item;
    draggedElement = element;
    element.classList.add('dragging');
    
    // Store original position
    const container = element.parentElement;
    const items = [...container.querySelectorAll('.shop-item')];
    originalPosition = items.indexOf(element);
    
    console.log('📍 Original position:', originalPosition, 'of', items.length, 'items');
    
    // Create drag preview with fixed size
    const preview = element.cloneNode(true);
    preview.id = 'dragPreview';
    preview.style.cssText = `
      position: fixed;
      top: -10000px;
      left: -10000px;
      width: ${element.offsetWidth}px;
      height: ${element.offsetHeight}px;
      pointer-events: none;
      z-index: -1;
    `;
    document.body.appendChild(preview);
    e.dataTransfer.setDragImage(preview, element.offsetWidth / 2, element.offsetHeight / 2);
    
    // Start auto-scroll monitoring
    startAutoScroll();
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item._id);
  });
  
  element.addEventListener('dragend', async (e) => {
    element.classList.remove('dragging');
    
    // Check if we need to save the reorder or move
    if (draggedElement && currentDraggedItem && placeholderElement) {
      const placeholderParent = placeholderElement.parentNode;
      const parentCategory = placeholderParent?.closest('.item-category');
      
      if (parentCategory) {
        const shopCategory = parentCategory.dataset.shopCategory;
        const itemCategory = parseInt(parentCategory.dataset.itemCategory);
        
        const isSameCategory = currentDraggedItem.shopCategory === shopCategory && 
                               currentDraggedItem.itemCategory === itemCategory;
        
        if (isSameCategory) {
          // Replace placeholder with actual element
          if (placeholderElement.parentNode) {
            placeholderElement.parentNode.insertBefore(draggedElement, placeholderElement);
          }
          
          // Check if position changed
          const container = draggedElement.parentElement;
          const items = [...container.querySelectorAll('.shop-item')];
          const currentIndex = items.indexOf(draggedElement);
          
          if (currentIndex !== -1 && currentIndex !== originalPosition) {
            // Position changed - save the new order
            const itemsInOrder = items.map(el => el.dataset.itemId);
            console.log('Reordering - new order:', itemsInOrder);
            
            // Find what item is now after the dragged item
            const afterElement = items[currentIndex + 1];
            const beforeElement = items[currentIndex - 1];
            
            if (afterElement) {
              await reorderItem(currentDraggedItem._id, afterElement.dataset.itemId, 'before');
            } else if (beforeElement) {
              await reorderItem(currentDraggedItem._id, beforeElement.dataset.itemId, 'after');
            }
          }
        }
      }
    }
    
    currentDraggedItem = null;
    draggedElement = null;
    originalPosition = null;
    lastDropTarget = null;
    
    // Stop auto-scroll
    stopAutoScroll();
    
    // Remove drag preview
    const preview = document.getElementById('dragPreview');
    if (preview) preview.remove();
    
    // Remove placeholder
    if (placeholderElement && placeholderElement.parentNode) {
      placeholderElement.remove();
      placeholderElement = null;
    }
  });
}

// Auto-scroll when dragging near viewport edges
function startAutoScroll() {
  if (autoScrollInterval) return;
  
  autoScrollInterval = setInterval(() => {
    const scrollThreshold = 150; // Increased from 100 for more sensitivity
    const maxScrollSpeed = 25; // Increased from 15
    
    // Calculate scroll speed based on distance from edge (faster when closer)
    let scrollSpeed = 0;
    
    if (lastDragY < scrollThreshold) {
      // Scroll up - speed increases as you get closer to top
      const distanceFromTop = lastDragY;
      const speedMultiplier = 1 - (distanceFromTop / scrollThreshold);
      scrollSpeed = -(maxScrollSpeed * speedMultiplier);
    } else if (lastDragY > window.innerHeight - scrollThreshold) {
      // Scroll down - speed increases as you get closer to bottom
      const distanceFromBottom = window.innerHeight - lastDragY;
      const speedMultiplier = 1 - (distanceFromBottom / scrollThreshold);
      scrollSpeed = maxScrollSpeed * speedMultiplier;
    }
    
    if (scrollSpeed !== 0) {
      window.scrollBy(0, scrollSpeed);
    }
  }, 16); // ~60fps
  
  // Track mouse position
  document.addEventListener('dragover', trackDragPosition);
}

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
  document.removeEventListener('dragover', trackDragPosition);
}

function trackDragPosition(e) {
  lastDragY = e.clientY;
}

// Get element that should come after the dragged element
// This needs to work with grid layouts where items wrap across multiple columns
function getDragAfterElement(container, mouseY, mouseX) {
  if (!container) {
    console.log('❌ getDragAfterElement: No container');
    return null;
  }
  
  const draggableElements = [...container.querySelectorAll('.shop-item:not(.dragging):not(.shop-item-placeholder)')];
  
  console.log('🔍 getDragAfterElement:', {
    mouseY: mouseY,
    mouseX: mouseX,
    elementsFound: draggableElements.length,
    elementIds: draggableElements.map(el => el.dataset.itemId)
  });
  
  if (draggableElements.length === 0) {
    console.log('⚠️ No draggable elements found');
    return null;
  }
  
  // Strategy: Find which element the mouse is hovering over or closest to
  // Then determine if we should insert before or after based on mouse position within that element
  
  let targetElement = null;
  let insertBefore = null;
  
  for (let i = 0; i < draggableElements.length; i++) {
    const child = draggableElements[i];
    const box = child.getBoundingClientRect();
    
    console.log('  📏 Element', child.dataset.itemId, ':', {
      index: i,
      box: { top: box.top.toFixed(1), left: box.left.toFixed(1), 
             bottom: box.bottom.toFixed(1), right: box.right.toFixed(1) }
    });
    
    // Check if mouse is within this element's bounds
    if (mouseX >= box.left && mouseX <= box.right &&
        mouseY >= box.top && mouseY <= box.bottom) {
      console.log('    🎯 Mouse is INSIDE this element');
      targetElement = child;
      
      // Determine if we should insert before or after based on position within the element
      const relativeX = (mouseX - box.left) / box.width;
      const relativeY = (mouseY - box.top) / box.height;
      
      console.log('    � Relative position:', { x: relativeX.toFixed(2), y: relativeY.toFixed(2) });
      
      // If in the first half (left side or top half), insert before
      // Otherwise, insert after (which means before the next element)
      if (relativeX < 0.5) {
        insertBefore = child;
        console.log('    ⬅️ Insert BEFORE this element');
      } else {
        insertBefore = draggableElements[i + 1] || null;
        console.log('    ➡️ Insert AFTER this element (before next)');
      }
      break;
    }
    
    // If mouse is above or to the left, this might be our insertion point
    if (mouseY < box.top || (mouseY < box.bottom && mouseX < box.left)) {
      console.log('    ⬆️ Mouse is before this element');
      insertBefore = child;
      break;
    }
  }
  
  console.log('🎯 Final result:', insertBefore?.dataset?.itemId || 'null (append to end)');
  return insertBefore;
}

// Setup drop zone for item categories
function setupDropZone(categoryElement) {
  const itemsGrid = categoryElement.querySelector('.items-grid');
  
  console.log('🔧 setupDropZone called:', {
    categoryElement: categoryElement.className,
    shopCategory: categoryElement.dataset.shopCategory,
    itemCategory: categoryElement.dataset.itemCategory,
    foundItemsGrid: !!itemsGrid,
    itemsGridClass: itemsGrid?.className
  });
  
  categoryElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    console.log('🔵 DRAGOVER EVENT:', {
      hasDraggedItem: !!currentDraggedItem,
      hasDraggedElement: !!draggedElement,
      hasItemsGrid: !!itemsGrid,
      itemsGridStillInDOM: itemsGrid ? document.contains(itemsGrid) : false
    });
    
    if (!currentDraggedItem || !draggedElement) {
      console.log('❌ Missing dragged item or element');
      return;
    }
    
    const targetShopCategory = categoryElement.dataset.shopCategory;
    const targetItemCategory = parseInt(categoryElement.dataset.itemCategory);
    
    console.log('📍 Category Check:', {
      draggedFrom: {
        shop: currentDraggedItem.shopCategory,
        item: currentDraggedItem.itemCategory
      },
      target: {
        shop: targetShopCategory,
        item: targetItemCategory
      }
    });
    
    const isSameCategory = currentDraggedItem.shopCategory === targetShopCategory && 
                           currentDraggedItem.itemCategory === targetItemCategory;
    
    console.log('🎯 Same category?', isSameCategory);
    
    if (isSameCategory) {
      // Handle reordering within same category
      categoryElement.classList.remove('drag-over');
      console.log('✅ Same category - handling reorder');
      
      if (itemsGrid && draggedElement) {
        // Create placeholder if it doesn't exist
        if (!placeholderElement) {
          placeholderElement = document.createElement('div');
          placeholderElement.className = 'shop-item-placeholder';
          const width = draggedElement.offsetWidth;
          const height = draggedElement.offsetHeight;
          placeholderElement.style.cssText = `
            width: ${width}px;
            height: ${height}px;
            margin: 0;
            border: 2px dashed var(--primary-blue);
            border-radius: 12px;
            background: rgba(0, 122, 255, 0.1);
            box-sizing: border-box;
          `;
          console.log('🆕 Created placeholder:', width, 'x', height);
        }
        
        const afterElement = getDragAfterElement(itemsGrid, e.clientY, e.clientX);
        console.log('📌 After element:', afterElement?.dataset?.itemId || 'end of list');
        
        // Check if the placeholder would be in the same position as the dragged element
        // This happens when:
        // 1. afterElement is the dragged element itself (would insert right before where it is)
        // 2. afterElement is the next sibling of dragged element (would insert right after where it is)
        const draggedNextSibling = draggedElement.nextElementSibling;
        const wouldBeInSamePosition = 
          afterElement === draggedElement || 
          afterElement === draggedNextSibling ||
          (afterElement === null && draggedNextSibling === null); // Both at end
        
        if (wouldBeInSamePosition) {
          console.log('⏸️ Would insert in same position - hiding placeholder');
          // Remove placeholder if it exists
          if (placeholderElement && placeholderElement.parentNode) {
            placeholderElement.remove();
          }
        } else {
          // Remove placeholder from its current position
          if (placeholderElement.parentNode) {
            console.log('🗑️ Removing placeholder from current position');
            placeholderElement.remove();
          }
          
          // Insert placeholder at the target position
          if (afterElement == null) {
            console.log('➕ Appending placeholder to end');
            itemsGrid.appendChild(placeholderElement);
          } else {
            console.log('➕ Inserting placeholder before', afterElement.dataset?.itemId);
            itemsGrid.insertBefore(placeholderElement, afterElement);
          }
          
          console.log('✅ Placeholder should now be visible');
        }
      } else {
        console.log('❌ Missing itemsGrid or draggedElement');
      }
    } else {
      // Different category - show drop zone
      console.log('🔀 Different category - showing drop zone');
      categoryElement.classList.add('drag-over');
      
      // Remove placeholder if dragging to different category
      if (placeholderElement && placeholderElement.parentNode) {
        placeholderElement.remove();
      }
    }
  });
  
  categoryElement.addEventListener('dragleave', (e) => {
    // Only remove highlight if we're actually leaving the category
    const rect = categoryElement.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX >= rect.right ||
        e.clientY < rect.top || e.clientY >= rect.bottom) {
      categoryElement.classList.remove('drag-over');
    }
  });
  
  categoryElement.addEventListener('drop', async (e) => {
    e.preventDefault();
    categoryElement.classList.remove('drag-over');
    
    if (!currentDraggedItem) return;
    
    const targetShopCategory = categoryElement.dataset.shopCategory;
    const targetItemCategory = parseInt(categoryElement.dataset.itemCategory);
    
    const isSameCategory = currentDraggedItem.shopCategory === targetShopCategory && 
                           currentDraggedItem.itemCategory === targetItemCategory;
    
    if (!isSameCategory) {
      // Move to different category
      await moveItem(currentDraggedItem._id, targetShopCategory, targetItemCategory);
    }
    // Reordering is handled in dragend event
  });
}

// Reorder item within same category
async function reorderItem(itemId, targetItemId, position) {
  console.log(`Reordering item ${itemId} ${position} item ${targetItemId}`);
  
  try {
    const response = await fetch(`/api/store/items/${itemId}/reorder`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetItemId, position })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to reorder item');
    }
    
    console.log('✅ Item reordered successfully in database');
    showSuccess('Item order updated');
  } catch (error) {
    console.error('❌ Error reordering item:', error);
    showError('Failed to reorder item: ' + error.message);
    // Reload to restore correct order
    await loadStoreItems();
  }
}

// Move item to different category
async function moveItem(itemId, shopCategory, itemCategory) {
  try {
    const response = await fetch(`/api/store/items/${itemId}/move`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ shopCategory, itemCategory })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to move item');
    }
    
    showSuccess('Item moved successfully');
    await loadStoreItems();
  } catch (error) {
    console.error('Error moving item:', error);
    showError('Failed to move item: ' + error.message);
  }
}

// Reorder item within same category
async function reorderItem(itemId, targetItemId, position) {
  try {
    const response = await fetch(`/api/store/items/${itemId}/reorder`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetItemId, position })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to reorder item');
    }
    
    showSuccess('Item reordered successfully');
    await loadStoreItems();
  } catch (error) {
    console.error('Error reordering item:', error);
    showError('Failed to reorder item: ' + error.message);
  }
}

// Open add item modal
function openAddItemModal() {
  currentEditingItem = null;
  
  document.getElementById('modalTitle').textContent = 'Add New Item';
  document.getElementById('submitBtnText').textContent = 'Add Item';
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  
  document.getElementById('itemModal').classList.add('show');
}

// Open edit item modal
async function openEditItemModal(itemId) {
  try {
    const response = await fetch(`/api/store/items/${itemId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load item');
    }
    
    currentEditingItem = data.item;
    
    document.getElementById('modalTitle').textContent = 'Edit Item';
    document.getElementById('submitBtnText').textContent = 'Save Changes';
    
    // Populate form
    document.getElementById('itemId').value = data.item._id;
    document.getElementById('itemID').value = data.item.itemID;
    document.getElementById('name').value = data.item.name;
    document.getElementById('fileName').value = data.item.fileName;
    document.getElementById('fileNameFlat').value = data.item.fileNameFlat || '';
    document.getElementById('description').value = data.item.description;
    document.getElementById('price').value = data.item.price;
    document.getElementById('maxQuantity').value = data.item.maxQuantity;
    document.getElementById('lifetime').value = data.item.lifetime;
    document.getElementById('factionLevel').value = data.item.factionLevel;
    document.getElementById('shopCategory').value = data.item.shopCategory;
    document.getElementById('itemCategory').value = data.item.itemCategory;
    document.getElementById('imagePath').value = data.item.imagePath || '';
    document.getElementById('author').value = data.item.author || '';
    
    // Disable itemID field when editing
    document.getElementById('itemID').disabled = true;
    
    document.getElementById('itemModal').classList.add('show');
  } catch (error) {
    console.error('Error loading item for edit:', error);
    showError('Failed to load item: ' + error.message);
  }
}

// Close item modal
function closeItemModal() {
  document.getElementById('itemModal').classList.remove('show');
  document.getElementById('itemForm').reset();
  document.getElementById('itemID').disabled = false;
  currentEditingItem = null;
}

// Handle item form submission
async function handleItemFormSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  
  // Parse item category - could be ID or name
  let itemCategoryValue = formData.get('itemCategory');
  let itemCategoryId = itemCategoryValue;
  
  // Check if it's a name, find the ID
  if (isNaN(itemCategoryValue)) {
    const foundEntry = Object.entries(storeData.categoryNames).find(([id, name]) => 
      name.toLowerCase() === itemCategoryValue.toLowerCase()
    );
    if (foundEntry) {
      itemCategoryId = foundEntry[0];
    }
  }
  
  const itemData = {
    itemID: formData.get('itemID'),
    name: formData.get('name'),
    fileName: formData.get('fileName'),
    fileNameFlat: formData.get('fileNameFlat') || formData.get('fileName'),
    description: formData.get('description') || 'An Item',
    price: parseFloat(formData.get('price')),
    maxQuantity: parseInt(formData.get('maxQuantity')),
    lifetime: parseInt(formData.get('lifetime')),
    factionLevel: parseInt(formData.get('factionLevel')),
    shopCategory: formData.get('shopCategory'),
    itemCategory: parseInt(itemCategoryId),
    imagePath: formData.get('imagePath') || '',
    author: formData.get('author') || ''
  };
  
  const itemId = formData.get('itemId');
  
  try {
    let response;
    
    if (itemId) {
      // Update existing item
      response = await fetch(`/api/store/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData)
      });
    } else {
      // Create new item
      response = await fetch('/api/store/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData)
      });
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to save item');
    }
    
    showSuccess(itemId ? 'Item updated successfully' : 'Item added successfully');
    closeItemModal();
    await loadStoreItems();
  } catch (error) {
    console.error('Error saving item:', error);
    showError('Failed to save item: ' + error.message);
  }
}

// View item details
async function viewItemDetails(itemId) {
  try {
    const response = await fetch(`/api/store/items/${itemId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load item');
    }
    
    currentEditingItem = data.item;
    
    const detailsContent = document.getElementById('itemDetailsContent');
    detailsContent.innerHTML = `
      ${data.item.imagePath ? `
        <div class="item-detail-image">
          <img src="${data.item.imagePath}" alt="${data.item.name}">
        </div>
      ` : ''}
      
      <div class="item-detail-grid">
        <div class="item-detail-field">
          <div class="item-detail-label">Name</div>
          <div class="item-detail-value">${data.item.name}</div>
        </div>
        <div class="item-detail-field">
          <div class="item-detail-label">Item ID</div>
          <div class="item-detail-value">${data.item.itemID}</div>
        </div>
        <div class="item-detail-field">
          <div class="item-detail-label">Price</div>
          <div class="item-detail-value">💰 ${data.item.price}</div>
        </div>
        <div class="item-detail-field">
          <div class="item-detail-label">Max Quantity</div>
          <div class="item-detail-value">x${data.item.maxQuantity}</div>
        </div>
        <div class="item-detail-field">
          <div class="item-detail-label">Lifetime</div>
          <div class="item-detail-value">${data.item.lifetime} minutes</div>
        </div>
        <div class="item-detail-field">
          <div class="item-detail-label">Faction Level</div>
          <div class="item-detail-value">${data.item.factionLevel === -1 ? 'None' : data.item.factionLevel}</div>
        </div>
        <div class="item-detail-field">
          <div class="item-detail-label">Shop Category</div>
          <div class="item-detail-value">${storeData.channelNames[data.item.shopCategory] || data.item.shopCategory}</div>
        </div>
        <div class="item-detail-field">
          <div class="item-detail-label">Item Category</div>
          <div class="item-detail-value">${storeData.categoryNames[data.item.itemCategory] || data.item.itemCategory}</div>
        </div>
        <div class="item-detail-field">
          <div class="item-detail-label">File Name</div>
          <div class="item-detail-value">${data.item.fileName}</div>
        </div>
        <div class="item-detail-field">
          <div class="item-detail-label">Author</div>
          <div class="item-detail-value">${data.item.author || 'N/A'}</div>
        </div>
      </div>
      
      ${data.item.description ? `
        <div class="item-detail-field">
          <div class="item-detail-label">Description</div>
          <div class="item-detail-value">${data.item.description}</div>
        </div>
      ` : ''}
    `;
    
    document.getElementById('itemDetailsModal').classList.add('show');
  } catch (error) {
    console.error('Error viewing item details:', error);
    showError('Failed to load item details: ' + error.message);
  }
}

// Close item details modal
function closeItemDetailsModal() {
  document.getElementById('itemDetailsModal').classList.remove('show');
  currentEditingItem = null;
}

// Edit current item from details modal
function editCurrentItem() {
  if (currentEditingItem) {
    closeItemDetailsModal();
    openEditItemModal(currentEditingItem._id);
  }
}

// Delete current item from details modal
async function deleteCurrentItem() {
  if (!currentEditingItem) return;
  
  if (!confirm(`Are you sure you want to delete "${currentEditingItem.name}"?\nThis action cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/store/items/${currentEditingItem._id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete item');
    }
    
    showSuccess('Item deleted successfully');
    closeItemDetailsModal();
    await loadStoreItems();
  } catch (error) {
    console.error('Error deleting item:', error);
    showError('Failed to delete item: ' + error.message);
  }
}

// Show success message
function showSuccess(message) {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = 'toast success';
  toast.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: rgba(76, 217, 100, 0.95);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    font-weight: 500;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Show warning message
function showWarning(message) {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = 'toast warning';
  toast.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: rgba(255, 149, 0, 0.95);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    font-weight: 500;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Show error message
function showError(message) {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = 'toast error';
  toast.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: rgba(255, 59, 48, 0.95);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    font-weight: 500;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Make functions globally available
window.openAddItemModal = openAddItemModal;
window.openEditItemModal = openEditItemModal;
window.closeItemModal = closeItemModal;
window.viewItemDetails = viewItemDetails;
window.closeItemDetailsModal = closeItemDetailsModal;
window.editCurrentItem = editCurrentItem;
window.deleteCurrentItem = deleteCurrentItem;
