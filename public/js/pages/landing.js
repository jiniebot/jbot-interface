// Landing Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // Initialize fullPage.js
  new fullpage('#fullpage', {
    // License key for open source projects (free)
    licenseKey: 'gplv3-license',
    
    // Navigation
    anchors: ['hero', 'features', 'pricing', 'commands', 'about'],
    menu: '.nav-links',
    navigation: true,
    navigationPosition: 'right',
    
    // Scrolling
    scrollingSpeed: 700,
    autoScrolling: true,
    fitToSection: true,
    fitToSectionDelay: 600,
    scrollBar: false,
    easing: 'easeInOutCubic',
    
    // Design
    paddingTop: '0',
    paddingBottom: '0',
    
    // Accessibility
    keyboardScrolling: true,
    animateAnchor: true,
    recordHistory: true,
    
    // Mobile
    touchSensitivity: 5,
    normalScrollElementTouchThreshold: 5,
    
    // Allow scrolling within specific elements
    normalScrollElements: '.features-main-panel, .command-tree-scroll, .features-content',
    
    // Events
    afterLoad: function(origin, destination, direction) {
      // Update navbar background based on section
      const navbar = document.querySelector('.navbar');
      if (destination.index > 0) {
        navbar.style.background = 'rgba(15, 15, 15, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.3)';
      } else {
        navbar.style.background = 'rgba(15, 15, 15, 0.95)';
        navbar.style.boxShadow = 'none';
      }
    }
  });

  // Feature section navigation with pagination
  const featureNavBtns = document.querySelectorAll('.feature-nav-btn');
  const featureSlides = document.querySelectorAll('.feature-slide');
  const pagePrevBtn = document.getElementById('pagePrev');
  const pageNextBtn = document.getElementById('pageNext');
  const pageIndicatorsContainer = document.getElementById('pageIndicators');
  const featureIndicators = document.querySelectorAll('.feature-indicator');
  const featuresMainPanel = document.querySelector('.features-main-panel');
  
  let currentFeature = 'factions';
  let currentPage = 1;
  
  // Feature colors mapping
  const featureColors = {
    'factions': '#5865F2',
    'shops': '#57F287',
    'management': '#FEE75C',
    'quests': '#EB459E',
    'raids': '#ED4245',
    'zones': '#00D9FF'
  };
  
  // Get all pages for a feature
  function getPagesForFeature(feature) {
    return document.querySelectorAll(`.feature-slide[data-feature="${feature}"]`);
  }
  
  // Update page indicators
  function updatePageIndicators() {
    const pages = getPagesForFeature(currentFeature);
    pageIndicatorsContainer.innerHTML = '';
    
    pages.forEach((page, index) => {
      const indicator = document.createElement('div');
      indicator.className = 'page-indicator' + (index + 1 === currentPage ? ' active' : '');
      indicator.addEventListener('click', () => {
        currentPage = index + 1;
        showCurrentSlide();
      });
      pageIndicatorsContainer.appendChild(indicator);
    });
    
    // Update button states
    pagePrevBtn.disabled = currentPage === 1;
    pageNextBtn.disabled = currentPage === pages.length;
  }
  
  // Show current slide
  function showCurrentSlide() {
    // Hide all slides
    featureSlides.forEach(slide => slide.classList.remove('active'));
    
    // Show current slide
    const targetSlide = document.querySelector(
      `.feature-slide[data-feature="${currentFeature}"][data-page="${currentPage}"]`
    );
    if (targetSlide) {
      targetSlide.classList.add('active');
    }
    
    // Reset scroll to top of feature display
    const featureDisplay = document.getElementById('featureDisplay');
    if (featureDisplay) {
      featureDisplay.scrollTop = 0;
    }
    
    updatePageIndicators();
  }
  
  // Update feature color
  function updateFeatureColor() {
    const color = featureColors[currentFeature];
    if (color && featuresMainPanel) {
      featuresMainPanel.setAttribute('data-feature-color', color);
    }
    
    // Update mobile feature indicators
    featureIndicators.forEach(indicator => {
      if (indicator.getAttribute('data-feature') === currentFeature) {
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active');
      }
    });
  }
  
  // Feature button click
  featureNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFeature = btn.getAttribute('data-feature');
      currentPage = 1; // Reset to first page
      
      // Update active button
      featureNavBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      updateFeatureColor();
      showCurrentSlide();
    });
  });
  
  // Feature indicator click (mobile)
  featureIndicators.forEach(indicator => {
    indicator.addEventListener('click', () => {
      currentFeature = indicator.getAttribute('data-feature');
      currentPage = 1; // Reset to first page
      
      // Update active button
      featureNavBtns.forEach(b => b.classList.remove('active'));
      const activeBtn = document.querySelector(`.feature-nav-btn[data-feature="${currentFeature}"]`);
      if (activeBtn) {
        activeBtn.classList.add('active');
      }
      
      updateFeatureColor();
      showCurrentSlide();
    });
  });
  
  // Pagination controls
  pagePrevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      showCurrentSlide();
    }
  });
  
  pageNextBtn.addEventListener('click', () => {
    const pages = getPagesForFeature(currentFeature);
    if (currentPage < pages.length) {
      currentPage++;
      showCurrentSlide();
    }
  });
  
  // Initialize
  updateFeatureColor();
  updatePageIndicators();

  // Mobile feature navigation
  const featurePrevBtn = document.getElementById('featurePrev');
  const featureNextBtn = document.getElementById('featureNext');
  const featureOrder = ['factions', 'shops', 'management', 'quests', 'raids', 'zones'];
  
  function switchFeature(direction) {
    const currentIndex = featureOrder.indexOf(currentFeature);
    let newIndex;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : featureOrder.length - 1;
    } else {
      newIndex = currentIndex < featureOrder.length - 1 ? currentIndex + 1 : 0;
    }
    
    currentFeature = featureOrder[newIndex];
    currentPage = 1; // Reset to first page
    
    // Update active button
    featureNavBtns.forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.feature-nav-btn[data-feature="${currentFeature}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
    
    updateFeatureColor();
    showCurrentSlide();
  }
  
  featurePrevBtn.addEventListener('click', () => switchFeature('prev'));
  featureNextBtn.addEventListener('click', () => switchFeature('next'));

  // Navbar scroll effect
  let lastScroll = 0;
  const navbar = document.querySelector('.navbar');
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
      navbar.style.background = 'rgba(15, 15, 15, 0.98)';
      navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.3)';
    } else {
      navbar.style.background = 'rgba(15, 15, 15, 0.95)';
      navbar.style.boxShadow = 'none';
    }
    
    lastScroll = currentScroll;
  });

  // Animate elements on scroll
  const cardObserverOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, cardObserverOptions);

  document.querySelectorAll('.feature-card, .pricing-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    cardObserver.observe(el);
  });

  // Add click tracking for analytics (implement as needed)
  document.querySelectorAll('.btn, .hero-link, .nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
      const text = e.currentTarget.textContent.trim();
      const href = e.currentTarget.href;
      console.log('Link clicked:', text, href);
      // Add your analytics tracking here
    });
  });

  // Load and render command tree
  async function loadCommandTree() {
    try {
      const response = await fetch('/assets/data/command-tree.json');
      const data = await response.json();
      const commandTree = document.getElementById('commandTree');
      
      if (!commandTree) return;
      
      renderCommands(data.commands, commandTree);
    } catch (error) {
      console.error('Failed to load command tree:', error);
    }
  }

  function renderCommands(commands, container) {
    let expandedCommand = null;

    commands.forEach(command => {
      if (command.deleted) return;
      
      const commandItem = document.createElement('div');
      commandItem.className = 'command-item collapsed';
      commandItem.dataset.commandName = command.name;
      
      const commandName = document.createElement('div');
      commandName.className = 'command-name';
      commandName.textContent = `/${command.name}`;
      commandItem.appendChild(commandName);
      
      if (command.description) {
        const commandDesc = document.createElement('div');
        commandDesc.className = 'command-description';
        commandDesc.textContent = command.description;
        commandItem.appendChild(commandDesc);
      }
      
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'command-children';
      
      // Render subcommand groups
      if (command.subcommandGroups && command.subcommandGroups.length > 0) {
        const groupsContainer = document.createElement('div');
        groupsContainer.className = 'subcommand-groups-container';
        
        command.subcommandGroups.forEach(group => {
          const groupDiv = document.createElement('div');
          groupDiv.className = 'subcommand-group';
          
          const groupName = document.createElement('div');
          groupName.className = 'subcommand-group-name';
          groupName.textContent = group.name;
          groupDiv.appendChild(groupName);
          
          if (group.description) {
            const groupDesc = document.createElement('div');
            groupDesc.className = 'command-description';
            groupDesc.textContent = group.description;
            groupDiv.appendChild(groupDesc);
          }
          
          // Render subcommands in group
          if (group.subcommands && group.subcommands.length > 0) {
            const subcommandsContainer = document.createElement('div');
            subcommandsContainer.className = 'subcommands-container';
            
            group.subcommands.forEach(subcommand => {
              const subcommandDiv = document.createElement('div');
              subcommandDiv.className = 'subcommand';
              
              const subcommandName = document.createElement('div');
              subcommandName.className = 'subcommand-name';
              subcommandName.textContent = subcommand.name;
              subcommandDiv.appendChild(subcommandName);
              
              if (subcommand.description) {
                const subcommandDesc = document.createElement('div');
                subcommandDesc.className = 'command-description';
                subcommandDesc.textContent = subcommand.description;
                subcommandDiv.appendChild(subcommandDesc);
              }
              
              // Render options
              if (subcommand.options && subcommand.options.length > 0) {
                const optionsContainer = document.createElement('div');
                optionsContainer.className = 'options-container';
                
                subcommand.options.forEach(option => {
                  const optionDiv = document.createElement('div');
                  optionDiv.className = option.required ? 'option option-required' : 'option';
                  optionDiv.textContent = `${option.name} (${option.type})${option.required ? ' *' : ''}`;
                  optionDiv.title = option.description;
                  optionsContainer.appendChild(optionDiv);
                });
                
                subcommandDiv.appendChild(optionsContainer);
                
                subcommandName.style.cursor = 'pointer';
                subcommandName.addEventListener('click', (e) => {
                  e.stopPropagation();
                  optionsContainer.classList.toggle('expanded');
                  subcommandName.classList.toggle('expanded');
                });
              }
              
              subcommandsContainer.appendChild(subcommandDiv);
            });
            
            groupDiv.appendChild(subcommandsContainer);
            
            groupName.style.cursor = 'pointer';
            groupName.addEventListener('click', (e) => {
              e.stopPropagation();
              subcommandsContainer.classList.toggle('expanded');
              groupName.classList.toggle('expanded');
            });
          }
          
          groupsContainer.appendChild(groupDiv);
        });
        
        childrenContainer.appendChild(groupsContainer);
      }
      
      // Render direct subcommands
      if (command.subcommands && command.subcommands.length > 0) {
        const subcommandsContainer = document.createElement('div');
        subcommandsContainer.className = 'subcommands-container';
        
        command.subcommands.forEach(subcommand => {
          const subcommandDiv = document.createElement('div');
          subcommandDiv.className = 'subcommand';
          
          const subcommandName = document.createElement('div');
          subcommandName.className = 'subcommand-name';
          subcommandName.textContent = subcommand.name;
          subcommandDiv.appendChild(subcommandName);
          
          if (subcommand.description) {
            const subcommandDesc = document.createElement('div');
            subcommandDesc.className = 'command-description';
            subcommandDesc.textContent = subcommand.description;
            subcommandDiv.appendChild(subcommandDesc);
          }
          
          // Render options
          if (subcommand.options && subcommand.options.length > 0) {
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-container';
            
            subcommand.options.forEach(option => {
              const optionDiv = document.createElement('div');
              optionDiv.className = option.required ? 'option option-required' : 'option';
              optionDiv.textContent = `${option.name} (${option.type})${option.required ? ' *' : ''}`;
              optionDiv.title = option.description;
              optionsContainer.appendChild(optionDiv);
            });
            
            subcommandDiv.appendChild(optionsContainer);
            
            subcommandName.style.cursor = 'pointer';
            subcommandName.addEventListener('click', (e) => {
              e.stopPropagation();
              optionsContainer.classList.toggle('expanded');
              subcommandName.classList.toggle('expanded');
            });
          }
          
          subcommandsContainer.appendChild(subcommandDiv);
        });
        
        childrenContainer.appendChild(subcommandsContainer);
      }
      
      // Render direct options
      if (command.options && command.options.length > 0) {
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'options-container';
        
        command.options.forEach(option => {
          const optionDiv = document.createElement('div');
          optionDiv.className = option.required ? 'option option-required' : 'option';
          optionDiv.textContent = `${option.name} (${option.type})${option.required ? ' *' : ''}`;
          optionDiv.title = option.description;
          optionsContainer.appendChild(optionDiv);
        });
        
        childrenContainer.appendChild(optionsContainer);
      }
      
      if (childrenContainer.children.length > 0) {
        commandItem.appendChild(childrenContainer);
        
        commandName.addEventListener('click', (e) => {
          e.stopPropagation();
          
          // Check if this command is already expanded
          const isCurrentlyExpanded = commandItem.classList.contains('expanded-item');
          
          if (isCurrentlyExpanded) {
            // Collapse this command and return to grid view
            commandItem.classList.remove('expanded-item');
            commandItem.classList.add('collapsed');
            childrenContainer.classList.remove('expanded');
            commandName.classList.remove('expanded');
            container.classList.remove('has-expanded');
            
            // Show all other commands
            const allItems = container.querySelectorAll('.command-item');
            allItems.forEach(item => {
              item.classList.remove('hidden');
              item.classList.add('collapsed');
            });
            
            expandedCommand = null;
          } else {
            // Expand this command and hide others
            if (expandedCommand) {
              expandedCommand.classList.remove('expanded-item');
              expandedCommand.classList.add('hidden');
              expandedCommand.querySelector('.command-children').classList.remove('expanded');
              expandedCommand.querySelector('.command-name').classList.remove('expanded');
            }
            
            // Hide all other commands
            const allItems = container.querySelectorAll('.command-item');
            allItems.forEach(item => {
              if (item !== commandItem) {
                item.classList.add('hidden');
                item.classList.remove('collapsed');
              }
            });
            
            // Expand this command
            commandItem.classList.remove('collapsed', 'hidden');
            commandItem.classList.add('expanded-item');
            childrenContainer.classList.add('expanded');
            commandName.classList.add('expanded');
            container.classList.add('has-expanded');
            
            expandedCommand = commandItem;
          }
        });
      }
      
      container.appendChild(commandItem);
    });
  }

  // Load command tree when page loads
  loadCommandTree();
});
