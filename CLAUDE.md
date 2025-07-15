# SmartPop - Shopify Popup Tool Implementation Guide

## Project Overview
Build a Shopify app that creates trigger-based popups for email capture on customer store pages. The app provides an admin interface for popup management and analytics tracking.

## Technical Stack
- **Framework**: Shopify Remix App Template
- **Database**: Prisma ORM with SQLite (production ready, can upgrade to PostgreSQL)
- **Frontend**: React with Polaris design system
- **Backend**: Remix with built-in API routes
- **Authentication**: Shopify OAuth (handled by template)
- **Deployment**: Fly.io or Heroku
- **Script Delivery**: Static file served from app domain

## Architecture Overview

### Core Components
1. **Admin Dashboard**: Embedded Shopify app for popup management
2. **Popup Script**: JavaScript file injected into customer stores
3. **Database**: Stores popup configurations and analytics
4. **API Layer**: Handles popup configuration retrieval and event tracking
5. **Script Tag Management**: Automatically injects popup script into stores

### Data Flow
1. Merchant creates popup in admin dashboard
2. App stores popup configuration in database
3. App injects script tag into merchant's store
4. Script fetches popup configuration from app API
5. Script displays popup based on triggers
6. Events (views, conversions) tracked back to app database

## Project Setup Instructions

### Initial App Creation
Use Shopify CLI to create new app with these exact selections:
- Template: "Build a Remix app (recommended)"
- Language: "JavaScript"
- Create as new app: "Yes"
- App name: Use descriptive name like "smartpop-popup-tool"

### Directory Structure After Setup
The generated app will have this structure that we'll modify:
- **app/routes/**: Contains all admin interface pages
- **app/models/**: Database interaction functions
- **public/**: Static files including popup script
- **prisma/**: Database schema and migrations
- **app/shopify.server.js**: Shopify API configuration

## Database Schema Design

### Popup Configuration Table
Stores all popup settings and metadata:
- **id**: Unique identifier (cuid)
- **shop**: Store domain (string)
- **title**: Admin-facing popup name (string)
- **isActive**: Enable/disable toggle (boolean, default true)
- **triggerType**: Trigger method - "delay", "scroll", or "exit" (string)
- **triggerValue**: Numeric value for trigger (integer)
  - For delay: seconds to wait
  - For scroll: percentage of page scrolled
  - For exit: not used (set to 0)
- **heading**: Popup title text (string)
- **description**: Popup body text (nullable string)
- **buttonText**: Call-to-action button text (string, default "Get Discount")
- **discountCode**: Optional discount code to offer (nullable string)
- **views**: Total popup displays (integer, default 0)
- **conversions**: Total email captures (integer, default 0)
- **createdAt**: Creation timestamp (datetime)
- **updatedAt**: Last modification timestamp (datetime)

### Analytics Tracking Table
Stores individual popup events:
- **id**: Unique identifier (cuid)
- **popupId**: Reference to popup configuration (string, foreign key)
- **event**: Event type - "view", "conversion", or "close" (string)
- **sessionId**: Anonymous session identifier (string)
- **timestamp**: Event occurrence time (datetime)
- **userAgent**: Browser information (nullable string)
- **referrer**: Page where event occurred (nullable string)

### Database Relationships
- Popup has many PopupAnalytics (one-to-many)
- PopupAnalytics belongs to Popup (foreign key relationship)
- Index on popupId and event for query performance

## Admin Interface Implementation

### Dashboard Page (app._index.jsx)
Primary landing page showing:
- Total active popups count
- Total views across all popups (last 30 days)
- Total conversions across all popups (last 30 days)
- Conversion rate percentage
- Quick action button to create new popup
- Recent activity list (last 10 popup events)

Uses Polaris components: Page, Layout, Card, DisplayText, Button, DataTable

### Popup List Page (app.popups._index.jsx)
Table view of all popups with:
- Popup title and status (active/inactive)
- Trigger type and value display
- Views and conversions for each popup
- Conversion rate calculation
- Action buttons: Edit, Delete, Toggle Active Status
- Create New Popup button
- Bulk actions: Enable/Disable selected popups

Table pagination for stores with many popups
Search functionality by popup title

### Popup Creation Page (app.popups.new.jsx)
Form for creating new popup with validation:
- **Basic Information Section**:
  - Title field (required, max 100 characters)
  - Active status toggle (default enabled)
- **Trigger Settings Section**:
  - Trigger type selection (radio buttons: Delay, Scroll Percentage, Exit Intent)
  - Conditional trigger value field:
    - Delay: number input for seconds (1-60 range)
    - Scroll: number input for percentage (10-90 range)
    - Exit Intent: no additional field needed
- **Content Section**:
  - Heading text (required, max 60 characters)
  - Description text (optional, max 200 characters)
  - Button text (required, default "Get Discount", max 30 characters)
  - Discount code (optional, alphanumeric only)

Form validation handles required fields, character limits, and numeric ranges
Success/error toast notifications after form submission

### Popup Edit Page (app.popups.$id.jsx)
Identical form to creation page but pre-populated with existing data
Additional analytics section showing:
- Total views and conversions
- Daily breakdown for last 30 days (chart or table)
- Top performing days
- Conversion rate trends

Delete functionality with confirmation modal

## Popup Script Implementation

### Script File Structure (public/popup-script.js)
Self-contained JavaScript file that:
- Executes immediately when loaded
- Checks for Shopify admin environment and exits if detected
- Fetches popup configuration from app API
- Initializes appropriate trigger listeners
- Handles popup display and form submission
- Tracks all events back to app

### Admin Detection Logic
Comprehensive checks to prevent popups in Shopify admin:
- Hostname check for admin.shopify.com
- URL path check for /admin/ routes
- Parent frame detection for embedded admin
- DOM element check for Shopify admin indicators
- Fail-safe approach: block if uncertain

### Trigger Implementation Details

#### Delay Trigger
- Uses setTimeout with specified delay in seconds
- Checks if user is still on page before showing
- Respects user navigation away from page

#### Scroll Percentage Trigger
- Attaches scroll event listener to window
- Calculates scroll percentage: (scrollTop / (scrollHeight - clientHeight)) * 100
- Debounced to prevent excessive calculations
- Triggers once when threshold reached

#### Exit Intent Trigger
- Tracks mouse movement near top edge of viewport
- Detects rapid upward mouse movement indicating intent to leave
- Uses mouseleave event on document
- Prevents multiple triggers in same session

### Popup Display Logic
- Creates popup HTML dynamically
- Applies CSS styling for modal overlay
- Centers popup on screen with responsive positioning
- Includes close button (X) with touch-friendly sizing
- Implements comprehensive mobile optimization
- Prevents body scrolling when popup open
- Includes accessibility features (focus management, ARIA labels)

### Mobile Optimization and Responsive Design
Popups automatically adapt to different screen sizes and devices:

#### Responsive Breakpoints
- **Desktop (1024px+)**: Standard modal centered on screen, 500px max width
- **Tablet (768px-1023px)**: Reduced width to 90% of screen, maintained centering
- **Mobile (320px-767px)**: Full-width popup with padding, optimized for thumb interaction
- **Small Mobile (320px-479px)**: Minimal padding, larger touch targets

#### Mobile-Specific Adaptations
- **Touch-Friendly Elements**: All interactive elements minimum 44px touch target
- **Viewport Positioning**: Popup positioned to avoid virtual keyboard overlap
- **Swipe Gestures**: Optional swipe-down to dismiss on mobile devices
- **Orientation Handling**: Automatic reflow on device rotation
- **Safe Area Respect**: Accounts for notches and bottom indicators on modern devices

#### Input Field Optimization
- **Email Input**: Uses HTML5 email input type for mobile keyboard optimization
- **Field Sizing**: Larger input fields on mobile for easier interaction
- **Validation**: Real-time validation with mobile-friendly error messages
- **Focus Management**: Proper focus handling when virtual keyboard appears
- **Autocomplete**: Enables email autocomplete for faster form completion

#### Performance on Mobile
- **Minimal CSS**: Optimized CSS payload for faster loading on slower connections
- **Touch Events**: Uses touch events instead of click for better responsiveness
- **Smooth Animations**: Hardware-accelerated animations for smooth performance
- **Reduced Motion**: Respects user's reduced motion preferences
- **Memory Usage**: Minimal DOM manipulation to preserve mobile device memory

#### Mobile Trigger Adjustments
- **Scroll Trigger**: Adjusted sensitivity for mobile scrolling patterns
- **Exit Intent**: Modified for mobile (detects scroll-up instead of mouse movement)
- **Delay Trigger**: Shorter default delays on mobile due to different browsing patterns
- **Touch Considerations**: Prevents accidental triggers during normal scrolling

#### Cross-Device Testing Requirements
- **iOS Safari**: Full compatibility with iOS Safari quirks and limitations
- **Android Chrome**: Optimized for Android Chrome and WebView
- **Mobile Firefox**: Tested on mobile Firefox for Android
- **Edge Mobile**: Compatibility with Microsoft Edge mobile browser
- **Tablet Browsers**: Specific handling for tablet-sized screens in both orientations

### Email Form Handling
- Validates email format before submission
- Submits via fetch API to app tracking endpoint
- Shows loading state during submission
- Displays success message with discount code (if provided)
- Handles error states gracefully
- Prevents duplicate submissions

### Session Management
- Generates unique session ID for tracking
- Stores in sessionStorage to persist across page loads
- Respects session boundaries for analytics
- Prevents showing same popup multiple times per session

## API Endpoints Design

### Popup Configuration Endpoint
**Route**: /api/popup-config
**Method**: GET
**Parameters**: shop (query parameter)
**Response**: JSON array of active popup configurations
**Security**: Validates shop parameter, only returns active popups
**Caching**: Includes cache headers for performance

### Event Tracking Endpoint
**Route**: /api/track-event
**Method**: POST
**Body**: JSON with popupId, event type, sessionId, optional metadata
**Response**: Success/error status
**Validation**: Validates popup ID exists, event type is valid
**Rate Limiting**: Prevents spam tracking requests

### Popup Analytics Endpoint (Admin Only)
**Route**: /api/popups/$id/analytics
**Method**: GET
**Authentication**: Requires valid Shopify session
**Response**: Aggregated analytics data for specific popup
**Filters**: Date range, event type filtering

## Script Tag Management

### Automatic Injection
When popup is created or app is installed:
- Uses Shopify GraphQL Admin API scriptTagCreate mutation
- Injects script pointing to popup-script.js on app domain
- Script URL includes app domain and version parameter
- Handles authentication via app's Shopify session

### Script Tag Updates
When popup configuration changes:
- Script remains the same (no re-injection needed)
- Configuration fetched dynamically by script
- Immediate updates without merchant intervention

### Cleanup on Uninstall
App uninstall webhook handler:
- Removes all script tags created by app
- Uses GraphQL scriptTagDelete mutation
- Cleans up database records for uninstalled shop

## Security Implementation

### Data Protection
- All popup configurations scoped to shop domain
- Analytics data anonymized (no personal information stored)
- Email addresses not stored in app database (handled by merchant)
- Input sanitization on all form fields

### API Security
- CORS properly configured for script domain
- Rate limiting on public endpoints
- Input validation and sanitization
- SQL injection prevention via Prisma ORM

### Admin Interface Security
- Shopify OAuth handles all authentication
- CSRF protection via Remix built-in features
- Session management handled by Shopify app framework
- Data access scoped to authenticated shop only

## Development Workflow

### Local Development Setup
After app creation, development server provides:
- Hot reloading for code changes
- Automatic database migrations
- Shopify Partner Dashboard integration
- Secure tunneling for testing

### Database Management
Prisma provides migration system:
- Schema changes tracked in migration files
- Development database automatically updated
- Production migrations run on deployment

### Testing Strategy
- Test popup triggers on different devices and screen sizes
- Verify admin detection across various Shopify themes
- Test email form submission and validation on mobile and desktop
- Verify analytics tracking accuracy across devices
- Cross-browser compatibility testing (Chrome, Safari, Firefox, Edge)
- **Mobile-Specific Testing**:
  - Touch interaction testing on iOS and Android devices
  - Virtual keyboard behavior and popup positioning
  - Orientation change handling (portrait to landscape)
  - Performance testing on slower mobile connections
  - Battery usage optimization verification
  - Safe area compliance on devices with notches
  - Accessibility testing with mobile screen readers

## Deployment Configuration

### Environment Variables Required
- SHOPIFY_API_KEY: From Partner Dashboard
- SHOPIFY_API_SECRET: From Partner Dashboard
- DATABASE_URL: Production database connection
- APP_URL: Deployed app domain for script tags

### Production Database Setup
For Fly.io deployment:
- Can use managed PostgreSQL
- Requires database URL in environment
- Automatic migrations on deployment

For Heroku deployment:
- Heroku Postgres add-on recommended
- DATABASE_URL automatically provided
- Migrations run via release phase

### CDN Considerations
Popup script should be served with:
- Proper cache headers for performance
- CORS headers for cross-domain access
- Compression enabled
- Version parameter for cache busting

## Performance Optimization

### Script Loading
- Popup script loads asynchronously without blocking page render
- Minimal initial payload optimized for mobile connections
- Configuration fetched only when needed to reduce data usage
- Debounced event handlers for scroll triggers, optimized for mobile scrolling
- **Mobile Performance Optimizations**:
  - Compressed script delivery with gzip/brotli compression
  - Reduced DOM queries and manipulation for better mobile performance
  - Lazy loading of CSS styles until popup trigger occurs
  - Efficient event listener management to preserve mobile battery life
  - Optimized for 3G/4G connections with retry logic for failed requests

### Database Queries
- Indexes on frequently queried fields
- Pagination for large datasets
- Aggregated analytics calculated efficiently
- Connection pooling for production

### Admin Interface
- Lazy loading for analytics data
- Optimistic updates for better UX
- Proper loading states throughout
- Error boundaries for graceful degradation

## Error Handling Strategy

### Script Errors
- Graceful degradation if API unavailable
- Console logging in development mode only
- Silent failure in production to avoid customer impact
- Retry logic for failed API requests

### Admin Interface Errors
- Form validation with clear error messages
- API error handling with user-friendly messages
- Loading states for all async operations
- Fallback UI for failed data loads

### Database Errors
- Transaction handling for data consistency
- Proper error logging for debugging
- Graceful handling of constraint violations
- Backup and recovery procedures documented

## Analytics and Reporting

### Metrics Tracked
- Popup views (each time popup displayed)
- Conversions (email form submissions)
- Close events (user dismisses popup)
- Session duration before popup trigger
- Device and browser information

### Reporting Features
- Daily, weekly, monthly aggregations
- Conversion rate calculations
- Comparative performance between popups
- Trend analysis over time
- Export functionality for external analysis

### Privacy Compliance
- No personally identifiable information stored
- Anonymous session tracking only
- GDPR compliant data handling
- Option for merchants to disable analytics

## Maintenance and Monitoring

### Health Checks
- Database connectivity monitoring
- API endpoint availability checks
- Script delivery verification
- Error rate monitoring

### Updates and Versioning
- Backward compatible API changes
- Versioned popup script for rollback capability
- Automatic dependency updates
- Security patch management

### Support and Debugging
- Comprehensive logging for troubleshooting
- Debug mode for detailed script behavior
- Admin interface for viewing raw analytics
- Documentation for common issues
s