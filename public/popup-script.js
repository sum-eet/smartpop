/**
 * SmartPop - Shopify Popup Script
 * Self-contained popup script with mobile optimization and comprehensive features
 */

(function() {
  'use strict';

  // === CONFIGURATION ===
  const CONFIG = {
    APP_URL: 'https://smartpop.vercel.app',
    DEBUG: false,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    SESSION_STORAGE_KEY: 'smartpop_session',
    SHOWN_POPUPS_KEY: 'smartpop_shown',
    MOBILE_BREAKPOINT: 768,
    TOUCH_TARGET_SIZE: 44,
    ANIMATION_DURATION: 300,
    DEBOUNCE_DELAY: 100,
    EXIT_INTENT_THRESHOLD: 10,
    SCROLL_DEBOUNCE: 50,
  };

  // === UTILITY FUNCTIONS ===
  function log(message, data = null) {
    if (CONFIG.DEBUG) {
      console.log('[SmartPop]', message, data);
    }
  }

  function logError(message, error = null) {
    console.error('[SmartPop Error]', message, error);
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  function isMobile() {
    return window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
  }

  function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  function supportsReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // === ADMIN DETECTION ===
  function isShopifyAdmin() {
    try {
      // Check hostname for admin.shopify.com
      if (window.location.hostname === 'admin.shopify.com') {
        log('Admin detected: admin.shopify.com hostname');
        return true;
      }

      // Check for admin paths
      const adminPaths = ['/admin/', '/admin', '/admin.php'];
      for (const path of adminPaths) {
        if (window.location.pathname.includes(path)) {
          log('Admin detected: admin path', window.location.pathname);
          return true;
        }
      }

      // Check for Shopify admin iframe
      if (window.self !== window.top) {
        try {
          const parentHost = window.parent.location.hostname;
          if (parentHost.includes('admin.shopify.com')) {
            log('Admin detected: parent frame is admin');
            return true;
          }
        } catch (e) {
          // Cross-origin error - could be admin iframe
          log('Admin detected: cross-origin parent frame');
          return true;
        }
      }

      // Check for Shopify admin DOM elements
      const adminSelectors = [
        '[data-shopify-admin]',
        '.shopify-admin',
        '#shopify-admin',
        '[href*="admin.shopify.com"]',
        '.admin-bar',
        '.admin-header'
      ];

      for (const selector of adminSelectors) {
        if (document.querySelector(selector)) {
          log('Admin detected: admin DOM element', selector);
          return true;
        }
      }

      // Check for Shopify admin variables
      if (window.Shopify && window.Shopify.admin) {
        log('Admin detected: Shopify.admin object');
        return true;
      }

      // Check URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('preview_theme_id') || urlParams.has('_ab') || urlParams.has('_fd')) {
        log('Admin detected: admin URL parameters');
        return true;
      }

      return false;
    } catch (error) {
      logError('Error in admin detection', error);
      // Fail-safe: assume admin if error occurs
      return true;
    }
  }

  // === SESSION MANAGEMENT ===
  function generateSessionId() {
    return 'sp_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  function getSessionId() {
    try {
      let sessionId = sessionStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
      if (!sessionId) {
        sessionId = generateSessionId();
        sessionStorage.setItem(CONFIG.SESSION_STORAGE_KEY, sessionId);
      }
      return sessionId;
    } catch (error) {
      logError('Error managing session', error);
      return generateSessionId();
    }
  }

  function hasPopupBeenShown(popupId) {
    try {
      const shownPopups = JSON.parse(sessionStorage.getItem(CONFIG.SHOWN_POPUPS_KEY) || '[]');
      return shownPopups.includes(popupId);
    } catch (error) {
      logError('Error checking shown popups', error);
      return false;
    }
  }

  function markPopupAsShown(popupId) {
    try {
      const shownPopups = JSON.parse(sessionStorage.getItem(CONFIG.SHOWN_POPUPS_KEY) || '[]');
      if (!shownPopups.includes(popupId)) {
        shownPopups.push(popupId);
        sessionStorage.setItem(CONFIG.SHOWN_POPUPS_KEY, JSON.stringify(shownPopups));
      }
    } catch (error) {
      logError('Error marking popup as shown', error);
    }
  }

  // === EVENT TRACKING ===
  async function trackEvent(popupId, event, retryCount = 0) {
    try {
      const eventData = {
        popupId,
        event,
        sessionId: getSessionId(),
        userAgent: navigator.userAgent,
        referrer: document.referrer || undefined,
      };

      log('Tracking event', eventData);

      const response = await fetch(`${CONFIG.APP_URL}/api/track-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      log('Event tracked successfully', result);
      return result;
    } catch (error) {
      logError('Error tracking event', error);
      
      // Retry logic
      if (retryCount < CONFIG.RETRY_ATTEMPTS) {
        log(`Retrying event tracking (attempt ${retryCount + 1})`);
        setTimeout(() => {
          trackEvent(popupId, event, retryCount + 1);
        }, CONFIG.RETRY_DELAY * (retryCount + 1));
      }
    }
  }

  // === POPUP CONFIGURATION ===
  async function fetchPopupConfig(retryCount = 0) {
    try {
      const shop = window.Shopify?.shop || window.location.hostname;
      const response = await fetch(`${CONFIG.APP_URL}/api/popup-config?shop=${encodeURIComponent(shop)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const popups = await response.json();
      log('Popup configuration loaded', popups);
      return popups;
    } catch (error) {
      logError('Error fetching popup config', error);
      
      // Retry logic
      if (retryCount < CONFIG.RETRY_ATTEMPTS) {
        log(`Retrying popup config fetch (attempt ${retryCount + 1})`);
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(fetchPopupConfig(retryCount + 1));
          }, CONFIG.RETRY_DELAY * (retryCount + 1));
        });
      }
      
      return [];
    }
  }

  // === POPUP STYLING ===
  function getPopupStyles() {
    return `
      .smartpop-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
        opacity: 0;
        transition: opacity ${CONFIG.ANIMATION_DURATION}ms ease-in-out;
      }
      
      .smartpop-overlay.show {
        opacity: 1;
      }
      
      .smartpop-popup {
        background: white;
        border-radius: 8px;
        padding: 30px;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        transform: scale(0.9);
        transition: transform ${CONFIG.ANIMATION_DURATION}ms ease-in-out;
        -webkit-overflow-scrolling: touch;
      }
      
      .smartpop-overlay.show .smartpop-popup {
        transform: scale(1);
      }
      
      .smartpop-close {
        position: absolute;
        top: 15px;
        right: 15px;
        width: ${CONFIG.TOUCH_TARGET_SIZE}px;
        height: ${CONFIG.TOUCH_TARGET_SIZE}px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s ease;
      }
      
      .smartpop-close:hover {
        background-color: #f0f0f0;
      }
      
      .smartpop-close:focus {
        outline: 2px solid #007cba;
        outline-offset: 2px;
      }
      
      .smartpop-heading {
        font-size: 24px;
        font-weight: bold;
        margin: 0 0 15px 0;
        color: #333;
        line-height: 1.3;
      }
      
      .smartpop-description {
        font-size: 16px;
        margin: 0 0 20px 0;
        color: #666;
        line-height: 1.5;
      }
      
      .smartpop-form {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      
      .smartpop-email {
        padding: 12px;
        border: 2px solid #ddd;
        border-radius: 4px;
        font-size: 16px;
        width: 100%;
        box-sizing: border-box;
        transition: border-color 0.2s ease;
      }
      
      .smartpop-email:focus {
        outline: none;
        border-color: #007cba;
      }
      
      .smartpop-email.error {
        border-color: #d93025;
      }
      
      .smartpop-submit {
        padding: 12px 24px;
        background: #007cba;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s ease;
        min-height: ${CONFIG.TOUCH_TARGET_SIZE}px;
      }
      
      .smartpop-submit:hover {
        background: #005a87;
      }
      
      .smartpop-submit:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      
      .smartpop-error {
        color: #d93025;
        font-size: 14px;
        margin-top: 5px;
      }
      
      .smartpop-success {
        text-align: center;
        padding: 20px;
      }
      
      .smartpop-success-heading {
        font-size: 20px;
        font-weight: bold;
        color: #0f7b0f;
        margin: 0 0 10px 0;
      }
      
      .smartpop-discount {
        font-size: 18px;
        font-weight: bold;
        background: #f0f8ff;
        padding: 10px;
        border-radius: 4px;
        margin: 10px 0;
        color: #007cba;
      }
      
      /* Mobile Optimizations */
      @media (max-width: ${CONFIG.MOBILE_BREAKPOINT}px) {
        .smartpop-overlay {
          padding: 15px;
        }
        
        .smartpop-popup {
          padding: 20px;
          max-width: 100%;
          border-radius: 0;
          max-height: 95vh;
        }
        
        .smartpop-heading {
          font-size: 20px;
        }
        
        .smartpop-description {
          font-size: 14px;
        }
        
        .smartpop-email {
          font-size: 16px;
          padding: 15px;
        }
        
        .smartpop-submit {
          padding: 15px;
          font-size: 16px;
        }
        
        .smartpop-close {
          width: 40px;
          height: 40px;
          top: 10px;
          right: 10px;
        }
      }
      
      /* Small Mobile */
      @media (max-width: 479px) {
        .smartpop-overlay {
          padding: 10px;
        }
        
        .smartpop-popup {
          padding: 15px;
          border-radius: 0;
        }
        
        .smartpop-heading {
          font-size: 18px;
        }
      }
      
      /* Reduced Motion */
      @media (prefers-reduced-motion: reduce) {
        .smartpop-overlay,
        .smartpop-popup,
        .smartpop-close,
        .smartpop-submit {
          transition: none !important;
        }
      }
      
      /* High DPI Displays */
      @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        .smartpop-popup {
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
      }
      
      /* Landscape on Mobile */
      @media (max-width: ${CONFIG.MOBILE_BREAKPOINT}px) and (orientation: landscape) {
        .smartpop-popup {
          max-height: 85vh;
          padding: 15px;
        }
        
        .smartpop-heading {
          font-size: 18px;
          margin-bottom: 10px;
        }
        
        .smartpop-description {
          font-size: 14px;
          margin-bottom: 15px;
        }
      }
      
      /* Safe Area for Devices with Notches */
      @supports (padding-top: env(safe-area-inset-top)) {
        .smartpop-overlay {
          padding-top: max(20px, env(safe-area-inset-top));
          padding-bottom: max(20px, env(safe-area-inset-bottom));
          padding-left: max(20px, env(safe-area-inset-left));
          padding-right: max(20px, env(safe-area-inset-right));
        }
      }
    `;
  }

  // === POPUP CREATION ===
  function createPopup(config) {
    const overlay = document.createElement('div');
    overlay.className = 'smartpop-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'smartpop-heading');
    
    const popup = document.createElement('div');
    popup.className = 'smartpop-popup';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'smartpop-close';
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', 'Close popup');
    
    const heading = document.createElement('h2');
    heading.className = 'smartpop-heading';
    heading.id = 'smartpop-heading';
    heading.textContent = config.heading;
    
    const description = document.createElement('p');
    description.className = 'smartpop-description';
    description.textContent = config.description || '';
    
    const form = document.createElement('form');
    form.className = 'smartpop-form';
    
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.className = 'smartpop-email';
    emailInput.placeholder = 'Enter your email address';
    emailInput.required = true;
    emailInput.setAttribute('aria-label', 'Email address');
    emailInput.setAttribute('autocomplete', 'email');
    
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'smartpop-submit';
    submitButton.textContent = config.buttonText || 'Get Discount';
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'smartpop-error';
    errorDiv.style.display = 'none';
    
    form.appendChild(emailInput);
    form.appendChild(submitButton);
    form.appendChild(errorDiv);
    
    popup.appendChild(closeButton);
    popup.appendChild(heading);
    if (config.description) {
      popup.appendChild(description);
    }
    popup.appendChild(form);
    
    overlay.appendChild(popup);
    
    return { overlay, popup, closeButton, form, emailInput, submitButton, errorDiv };
  }

  // === EMAIL VALIDATION ===
  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // === POPUP DISPLAY ===
  function showPopup(config) {
    if (hasPopupBeenShown(config.id)) {
      log('Popup already shown in this session', config.id);
      return;
    }

    const { overlay, popup, closeButton, form, emailInput, submitButton, errorDiv } = createPopup(config);
    
    // Add styles if not already added
    if (!document.getElementById('smartpop-styles')) {
      const style = document.createElement('style');
      style.id = 'smartpop-styles';
      style.textContent = getPopupStyles();
      document.head.appendChild(style);
    }
    
    // Close handlers
    function closePopup() {
      overlay.classList.remove('show');
      trackEvent(config.id, 'close');
      
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        document.body.style.overflow = '';
      }, CONFIG.ANIMATION_DURATION);
    }
    
    // Close button handler
    closeButton.addEventListener('click', closePopup);
    
    // Overlay click handler (close on backdrop click)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closePopup();
      }
    });
    
    // Escape key handler
    function handleEscape(e) {
      if (e.key === 'Escape') {
        closePopup();
        document.removeEventListener('keydown', handleEscape);
      }
    }
    document.addEventListener('keydown', handleEscape);
    
    // Form submission handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      
      // Clear previous errors
      errorDiv.style.display = 'none';
      emailInput.classList.remove('error');
      
      // Validate email
      if (!email) {
        errorDiv.textContent = 'Please enter your email address';
        errorDiv.style.display = 'block';
        emailInput.classList.add('error');
        emailInput.focus();
        return;
      }
      
      if (!validateEmail(email)) {
        errorDiv.textContent = 'Please enter a valid email address';
        errorDiv.style.display = 'block';
        emailInput.classList.add('error');
        emailInput.focus();
        return;
      }
      
      // Disable form
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
      
      try {
        // Track conversion
        await trackEvent(config.id, 'conversion');
        
        // Show success message
        const successDiv = document.createElement('div');
        successDiv.className = 'smartpop-success';
        
        const successHeading = document.createElement('h3');
        successHeading.className = 'smartpop-success-heading';
        successHeading.textContent = 'Thank you!';
        
        const successMessage = document.createElement('p');
        successMessage.textContent = 'Your email has been submitted successfully.';
        
        successDiv.appendChild(successHeading);
        successDiv.appendChild(successMessage);
        
        if (config.discountCode) {
          const discountDiv = document.createElement('div');
          discountDiv.className = 'smartpop-discount';
          discountDiv.textContent = `Use code: ${config.discountCode}`;
          successDiv.appendChild(discountDiv);
        }
        
        // Replace form with success message
        popup.removeChild(form);
        popup.appendChild(successDiv);
        
        // Auto-close after 3 seconds
        setTimeout(closePopup, 3000);
        
      } catch (error) {
        logError('Error submitting form', error);
        errorDiv.textContent = 'There was an error submitting your email. Please try again.';
        errorDiv.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = config.buttonText || 'Get Discount';
      }
    });
    
    // Add to page
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    
    // Show with animation
    requestAnimationFrame(() => {
      overlay.classList.add('show');
    });
    
    // Focus management
    setTimeout(() => {
      emailInput.focus();
    }, CONFIG.ANIMATION_DURATION);
    
    // Track view
    trackEvent(config.id, 'view');
    markPopupAsShown(config.id);
    
    log('Popup displayed', config);
  }

  // === TRIGGER HANDLERS ===
  
  // Delay Trigger
  function setupDelayTrigger(config) {
    const delay = config.triggerValue * 1000;
    log(`Setting up delay trigger: ${delay}ms`);
    
    const timer = setTimeout(() => {
      // Check if user is still on the page
      if (!document.hidden) {
        showPopup(config);
      }
    }, delay);
    
    // Clear timer if user leaves page
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearTimeout(timer);
      }
    });
  }
  
  // Scroll Trigger
  function setupScrollTrigger(config) {
    const threshold = config.triggerValue;
    log(`Setting up scroll trigger: ${threshold}%`);
    
    let triggered = false;
    
    const scrollHandler = throttle(() => {
      if (triggered) return;
      
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercentage = (scrollTop / scrollHeight) * 100;
      
      if (scrollPercentage >= threshold) {
        triggered = true;
        showPopup(config);
        window.removeEventListener('scroll', scrollHandler);
      }
    }, CONFIG.SCROLL_DEBOUNCE);
    
    window.addEventListener('scroll', scrollHandler, { passive: true });
  }
  
  // Exit Intent Trigger
  function setupExitIntentTrigger(config) {
    log('Setting up exit intent trigger');
    
    let triggered = false;
    
    function handleExitIntent() {
      if (triggered) return;
      triggered = true;
      showPopup(config);
      document.removeEventListener('mouseleave', handleExitIntent);
      document.removeEventListener('touchstart', handleTouchExit);
    }
    
    // Desktop exit intent
    if (!isTouchDevice()) {
      document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= CONFIG.EXIT_INTENT_THRESHOLD) {
          handleExitIntent();
        }
      });
    }
    
    // Mobile exit intent (scroll up quickly)
    if (isTouchDevice()) {
      let lastScrollY = window.scrollY;
      let scrollUpCount = 0;
      
      const handleTouchExit = throttle(() => {
        const currentScrollY = window.scrollY;
        if (currentScrollY < lastScrollY) {
          scrollUpCount++;
          if (scrollUpCount >= 3 && currentScrollY < 100) {
            handleExitIntent();
          }
        } else {
          scrollUpCount = 0;
        }
        lastScrollY = currentScrollY;
      }, 100);
      
      window.addEventListener('scroll', handleTouchExit, { passive: true });
    }
  }

  // === INITIALIZATION ===
  async function initSmartPop() {
    try {
      // Check if we're in admin
      if (isShopifyAdmin()) {
        log('Admin environment detected, skipping popup initialization');
        return;
      }
      
      // Check if page is loaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSmartPop);
        return;
      }
      
      log('Initializing SmartPop');
      
      // Fetch popup configuration
      const popups = await fetchPopupConfig();
      
      if (!popups || popups.length === 0) {
        log('No active popups found');
        return;
      }
      
      // Initialize each popup
      for (const popup of popups) {
        if (hasPopupBeenShown(popup.id)) {
          log('Skipping already shown popup', popup.id);
          continue;
        }
        
        switch (popup.triggerType) {
          case 'delay':
            setupDelayTrigger(popup);
            break;
          case 'scroll':
            setupScrollTrigger(popup);
            break;
          case 'exit':
            setupExitIntentTrigger(popup);
            break;
          default:
            logError('Unknown trigger type', popup.triggerType);
        }
      }
      
      log('SmartPop initialized successfully');
    } catch (error) {
      logError('Error initializing SmartPop', error);
    }
  }

  // === RESPONSIVE DESIGN HANDLERS ===
  
  // Handle orientation change
  window.addEventListener('orientationchange', debounce(() => {
    log('Orientation changed');
    // Recalculate popup positioning if needed
    const overlay = document.querySelector('.smartpop-overlay');
    if (overlay) {
      // Force reflow to handle orientation change
      overlay.style.display = 'none';
      overlay.offsetHeight; // Trigger reflow
      overlay.style.display = 'flex';
    }
  }, 100));
  
  // Handle resize
  window.addEventListener('resize', debounce(() => {
    log('Window resized');
    // Update mobile detection and adjust styles if needed
    const overlay = document.querySelector('.smartpop-overlay');
    if (overlay) {
      // Update classes based on new screen size
      overlay.classList.toggle('mobile', isMobile());
    }
  }, 100));

  // === ERROR HANDLING ===
  
  // Global error handler
  window.addEventListener('error', (e) => {
    if (e.filename && e.filename.includes('popup-script')) {
      logError('Script error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
      });
    }
  });
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (e) => {
    logError('Unhandled promise rejection', e.reason);
  });

  // === START INITIALIZATION ===
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmartPop);
  } else {
    initSmartPop();
  }

})();