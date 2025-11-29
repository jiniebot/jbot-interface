// Select Guild Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  let guildCards = document.querySelectorAll('.guild-card');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const cardsContainer = document.getElementById('guildCards');
  const pageTitle = document.querySelector('.page-title');
  const pageSubtitle = document.querySelector('.page-subtitle');
  const backBtn = document.getElementById('backBtn');
  
  let currentPage = 0;
  let currentMode = 'guilds'; // 'guilds' or 'services'
  let savedGuildsHTML = ''; // Store original guilds HTML
  
  // Check if mobile - updated to detect mobile more accurately
  function checkMobile() {
    return window.innerWidth <= 768;
  }
  
  // Function to get cards per page based on current screen size
  function getCardsPerPage() {
    return checkMobile() ? 1 : 3;
  }
  
  let cardsPerPage = getCardsPerPage();
  let totalPages = Math.ceil(guildCards.length / cardsPerPage);
  
  // Save initial guilds HTML
  savedGuildsHTML = cardsContainer.innerHTML;
  
  // Update visible cards based on current page with sliding animation
  function updateVisibleCards() {
    // Recalculate cards per page in case of screen size change
    cardsPerPage = getCardsPerPage();
    totalPages = Math.ceil(guildCards.length / cardsPerPage);
    
    // Make sure currentPage is within bounds
    if (currentPage >= totalPages) {
      currentPage = totalPages - 1;
    }
    if (currentPage < 0) {
      currentPage = 0;
    }
    
    console.log('updateVisibleCards - cardsPerPage:', cardsPerPage, 'totalPages:', totalPages, 'currentPage:', currentPage);
    
    // Fade out
    cardsContainer.style.opacity = '0';
    
    setTimeout(() => {
      // Hide all cards first
      guildCards.forEach(card => card.style.display = 'none');
      
      // Calculate which cards to show on current page
      const startIdx = currentPage * cardsPerPage;
      const endIdx = Math.min(startIdx + cardsPerPage, guildCards.length);
      
      console.log('Showing cards from', startIdx, 'to', endIdx);
      
      // Show only the cards for this page
      for (let i = startIdx; i < endIdx; i++) {
        guildCards[i].style.display = 'flex';
      }
      
      // Update arrow visibility while cards are hidden
      if (totalPages > 1) {
        prevBtn.style.display = currentPage > 0 ? 'flex' : 'none';
        nextBtn.style.display = currentPage < totalPages - 1 ? 'flex' : 'none';
      } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      }
      
      // Fade in
      setTimeout(() => {
        cardsContainer.style.opacity = '1';
      }, 50);
    }, 300);
  }

  // Handle guild selection and show services
  async function selectGuild(guildId) {
    try {
      const response = await fetch('/selectGuildService/guild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `guildId=${guildId}`
      });

      const data = await response.json();

      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }

      // Switch to service selection mode
      currentMode = 'services';
      currentPage = 0;
      
      // Show back button
      backBtn.style.display = 'block';
      
      // Update titles
      pageTitle.textContent = 'Select a Service';
      pageSubtitle.textContent = `Choose a service for ${data.guildName}`;

      // Fade out current cards
      cardsContainer.style.opacity = '0';

      setTimeout(() => {
        // Clear current cards
        cardsContainer.innerHTML = '';

        // Create service cards
        console.log('Creating service cards:', data.services.length);
        data.services.forEach((service, idx) => {
          console.log(`Service ${idx}:`, service.serviceName, service.mapLoc);
          const card = createServiceCard(service);
          cardsContainer.appendChild(card);
        });

        // Update card references and reset pagination
        guildCards = document.querySelectorAll('.guild-card');
        console.log('Total service cards created:', guildCards.length);
        cardsPerPage = getCardsPerPage();
        totalPages = Math.ceil(guildCards.length / cardsPerPage);
        currentPage = 0;
        
        console.log('Cards per page:', cardsPerPage);
        console.log('Total pages:', totalPages);
        console.log('Is mobile:', checkMobile());
        console.log('Window width:', window.innerWidth);

        // Hide all cards first
        guildCards.forEach(card => card.style.display = 'none');

        // Calculate which cards to show on first page
        const startIdx = 0;
        const endIdx = Math.min(cardsPerPage, guildCards.length);
        
        console.log('Showing cards from', startIdx, 'to', endIdx);

        // Show cards for first page
        for (let i = startIdx; i < endIdx; i++) {
          console.log('Displaying card', i);
          guildCards[i].style.display = 'flex';
        }

        // Update arrow visibility - use updateVisibleCards for consistency
        updateVisibleCards();
      }, 300);
    } catch (error) {
      console.error('Error selecting guild:', error);
    }
  }

  // Create a service card element
  function createServiceCard(service) {
    const card = document.createElement('div');
    card.className = 'guild-card';
    card.dataset.serviceId = service.serviceId;

    // Convert mapLoc number to map name
    const mapNames = { 0: 'chernarus', 3: 'sakhal', 1: 'livonia' };
    const mapLoc = mapNames[Number(service.mapLoc)] || 'chernarus';
    const iconPath = `/images/mapicons/${mapLoc}.png`;

    // Create icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'guild-icon-container';
    
    const iconImg = document.createElement('img');
    iconImg.src = iconPath;
    iconImg.alt = mapLoc;
    iconImg.className = 'guild-icon';
    
    // Handle image load error
    iconImg.onerror = () => {
      iconContainer.innerHTML = `
        <div class="guild-icon-placeholder">
          <span class="guild-initial">${service.serviceName.charAt(0).toUpperCase()}</span>
        </div>
      `;
    };
    
    iconContainer.appendChild(iconImg);

    // Create service name
    const serviceName = document.createElement('h2');
    serviceName.className = 'guild-name';
    serviceName.textContent = service.serviceName;

    // Create select button
    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'guild-select-btn service-select-btn';
    selectBtn.dataset.serviceId = service.serviceId;
    selectBtn.textContent = 'Select Service';

    // Assemble card
    card.appendChild(iconContainer);
    card.appendChild(serviceName);
    card.appendChild(selectBtn);

    return card;
  }

  // Handle service selection
  async function selectService(serviceId) {
    console.log('Selecting service:', serviceId);
    try {
      const response = await fetch('/selectGuildService/service', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: `serviceId=${serviceId}`
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.redirect) {
        console.log('Redirecting to:', data.redirect);
        window.location.href = data.redirect;
      }
    } catch (error) {
      console.error('Error selecting service:', error);
    }
  }

  // Go back to guild selection
  function backToGuilds() {
    // Fade out
    cardsContainer.style.opacity = '0';
    
    setTimeout(() => {
      // Restore guilds
      cardsContainer.innerHTML = savedGuildsHTML;
      
      // Update mode and state
      currentMode = 'guilds';
      currentPage = 0;
      
      // Hide back button
      backBtn.style.display = 'none';
      
      // Update titles
      pageTitle.textContent = 'Select Your Server';
      pageSubtitle.textContent = 'Choose which Discord server to manage';
      
      // Update card references
      guildCards = document.querySelectorAll('.guild-card');
      
      // Recalculate pagination
      cardsPerPage = getCardsPerPage();
      totalPages = Math.ceil(guildCards.length / cardsPerPage);
      
      // Hide all cards first
      guildCards.forEach(card => card.style.display = 'none');
      
      // Show first page cards
      const startIdx = 0;
      const endIdx = Math.min(cardsPerPage, guildCards.length);
      for (let i = startIdx; i < endIdx; i++) {
        guildCards[i].style.display = 'flex';
      }
      
      // Update arrow visibility
      if (totalPages > 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'flex';
      } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      }
      
      // Fade in
      setTimeout(() => {
        cardsContainer.style.opacity = '1';
      }, 50);
    }, 300);
  }
  
  // Navigation handlers
  prevBtn.addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      updateVisibleCards();
    }
  });
  
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages - 1) {
      currentPage++;
      updateVisibleCards();
    }
  });
  
  // Back button handler
  backBtn.addEventListener('click', () => {
    backToGuilds();
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      prevBtn.click();
    } else if (e.key === 'ArrowRight') {
      nextBtn.click();
    }
  });
  
  // Handle window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateVisibleCards(); // Update cards on resize instead of reload
    }, 250);
  });
  
  // Initialize - hide all cards first, then show correct amount
  guildCards.forEach(card => card.style.display = 'none');
  
  // Recalculate and show correct cards
  cardsPerPage = getCardsPerPage();
  totalPages = Math.ceil(guildCards.length / cardsPerPage);
  currentPage = 0;
  
  console.log('Initial setup - cardsPerPage:', cardsPerPage, 'totalPages:', totalPages, 'isMobile:', checkMobile());
  
  // Show first page immediately
  const startIdx = 0;
  const endIdx = Math.min(cardsPerPage, guildCards.length);
  for (let i = startIdx; i < endIdx; i++) {
    guildCards[i].style.display = 'flex';
  }
  
  // Update arrow visibility
  if (totalPages > 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'flex';
  } else {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  }

  // Event delegation for card selection
  cardsContainer.addEventListener('click', async (e) => {
    console.log('Click detected on:', e.target);
    console.log('Target classes:', e.target.classList);
    
    // Check if clicked on guild select button
    if (e.target.classList.contains('guild-select-btn') && !e.target.classList.contains('service-select-btn')) {
      console.log('Guild select button clicked');
      const card = e.target.closest('.guild-card');
      const guildId = card.dataset.guildId;
      await selectGuild(guildId);
      return;
    }

    // Check if clicked on service select button
    if (e.target.classList.contains('service-select-btn')) {
      console.log('Service select button clicked');
      const serviceId = e.target.dataset.serviceId;
      console.log('Service ID:', serviceId);
      await selectService(serviceId);
      return;
    }

    // Check if form submission (fallback)
    if (e.target.tagName === 'FORM') {
      e.preventDefault();
    }
  });

  // Prevent form submissions (we handle everything with JS now)
  cardsContainer.addEventListener('submit', (e) => {
    e.preventDefault();
  });
});
