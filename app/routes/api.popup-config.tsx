import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getActivePopupsForShop } from "../models/popup.server";

// Cache configuration
const CACHE_DURATION = 5 * 60; // 5 minutes in seconds

// Helper function to validate shop domain
function validateShopDomain(shop: string): boolean {
  if (!shop || typeof shop !== 'string') {
    return false;
  }
  
  // Check for basic domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!domainRegex.test(shop)) {
    return false;
  }
  
  // Check for .myshopify.com or custom domain
  if (shop.endsWith('.myshopify.com') || shop.includes('.')) {
    return true;
  }
  
  return false;
}

// CORS headers for cross-origin requests
function getCORSHeaders(origin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
  
  // Allow requests from any .myshopify.com domain and localhost for development
  if (origin) {
    if (
      origin.endsWith('.myshopify.com') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('ngrok.io') ||
      origin.includes('vercel.app')
    ) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }
  
  return headers;
}

// Handle OPTIONS request for CORS preflight
export async function action({ request }: LoaderFunctionArgs) {
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCORSHeaders(origin || undefined);
    
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
  
  // Only allow GET requests
  return json(
    { error: 'Method not allowed' },
    { 
      status: 405,
      headers: {
        'Allow': 'GET, OPTIONS',
        ...getCORSHeaders()
      }
    }
  );
}

// Handle GET request for popup configuration
export async function loader({ request }: LoaderFunctionArgs) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCORSHeaders(origin || undefined);
  
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop');
    
    // Validate shop parameter
    if (!shop) {
      return json(
        { 
          error: 'Missing shop parameter',
          message: 'Shop parameter is required'
        },
        { 
          status: 400,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            ...corsHeaders
          }
        }
      );
    }
    
    if (!validateShopDomain(shop)) {
      return json(
        { 
          error: 'Invalid shop domain',
          message: 'Shop parameter must be a valid domain'
        },
        { 
          status: 400,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            ...corsHeaders
          }
        }
      );
    }
    
    // Get active popups for the shop
    try {
      const popups = await getActivePopupsForShop(shop);
      
      console.log(`Popup config requested for shop: ${shop}, found ${popups.length} active popups`);
      
      return json(
        popups,
        { 
          status: 200,
          headers: {
            'Cache-Control': `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}`,
            'Content-Type': 'application/json',
            'X-Popup-Count': popups.length.toString(),
            ...corsHeaders
          }
        }
      );
    } catch (error) {
      console.error('Error fetching popup config:', error);
      
      return json(
        { 
          error: 'Internal server error',
          message: 'Failed to fetch popup configuration'
        },
        { 
          status: 500,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            ...corsHeaders
          }
        }
      );
    }
  } catch (error) {
    console.error('Unexpected error in popup-config API:', error);
    
    return json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...corsHeaders
        }
      }
    );
  }
}