import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { trackPopupEvent } from "../models/popup.server";

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

// Helper function to get client IP
function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

// Rate limiting function
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = `rate_limit:${ip}`;
  
  // Clean up expired entries
  if (rateLimitStore.has(key)) {
    const entry = rateLimitStore.get(key)!;
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
  
  const entry = rateLimitStore.get(key) || {
    count: 0,
    resetTime: now + RATE_LIMIT_WINDOW
  };
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0
    };
  }
  
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count
  };
}

// Validation function for event data
function validateEventData(data: any): {
  valid: boolean;
  errors: string[];
  cleanData?: any;
} {
  const errors: string[] = [];
  
  // Required fields
  if (!data.popupId || typeof data.popupId !== 'string') {
    errors.push('popupId is required and must be a string');
  }
  
  if (!data.event || typeof data.event !== 'string') {
    errors.push('event is required and must be a string');
  } else if (!['view', 'conversion', 'close'].includes(data.event)) {
    errors.push('event must be one of: view, conversion, close');
  }
  
  if (!data.sessionId || typeof data.sessionId !== 'string') {
    errors.push('sessionId is required and must be a string');
  }
  
  // Validate popupId format (should be a valid cuid)
  if (data.popupId && typeof data.popupId === 'string') {
    if (!/^[a-z0-9]{20,30}$/.test(data.popupId)) {
      errors.push('popupId format is invalid');
    }
  }
  
  // Validate sessionId format
  if (data.sessionId && typeof data.sessionId === 'string') {
    if (data.sessionId.length < 10 || data.sessionId.length > 100) {
      errors.push('sessionId length must be between 10 and 100 characters');
    }
  }
  
  // Optional fields validation
  if (data.userAgent && typeof data.userAgent !== 'string') {
    errors.push('userAgent must be a string');
  }
  
  if (data.referrer && typeof data.referrer !== 'string') {
    errors.push('referrer must be a string');
  }
  
  // Sanitize and limit string lengths
  const cleanData = {
    popupId: data.popupId?.toString().trim(),
    event: data.event?.toString().trim(),
    sessionId: data.sessionId?.toString().trim(),
    userAgent: data.userAgent?.toString().trim().substring(0, 500) || undefined,
    referrer: data.referrer?.toString().trim().substring(0, 500) || undefined,
  };
  
  return {
    valid: errors.length === 0,
    errors,
    cleanData: errors.length === 0 ? cleanData : undefined
  };
}

// CORS headers for cross-origin requests
function getCORSHeaders(origin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
export async function loader({ request }: ActionFunctionArgs) {
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCORSHeaders(origin || undefined);
    
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
  
  // Only allow POST requests
  return json(
    { error: 'Method not allowed' },
    { 
      status: 405,
      headers: {
        'Allow': 'POST, OPTIONS',
        ...getCORSHeaders()
      }
    }
  );
}

// Handle POST request for event tracking
export async function action({ request }: ActionFunctionArgs) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCORSHeaders(origin || undefined);
  
  try {
    // Check rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP);
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later'
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Date.now() + RATE_LIMIT_WINDOW).toString(),
            'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString(),
            ...corsHeaders
          }
        }
      );
    }
    
    // Parse request body
    let eventData;
    try {
      eventData = await request.json();
    } catch (error) {
      return json(
        { 
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        },
        { 
          status: 400,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            ...corsHeaders
          }
        }
      );
    }
    
    // Validate event data
    const validation = validateEventData(eventData);
    if (!validation.valid) {
      console.warn('Event validation failed:', {
        errors: validation.errors,
        data: eventData,
        ip: clientIP
      });
      
      return json(
        { 
          error: 'Validation failed',
          errors: validation.errors
        },
        { 
          status: 400,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            ...corsHeaders
          }
        }
      );
    }
    
    // Track the event
    try {
      await trackPopupEvent(validation.cleanData!);
      
      console.log('Event tracked successfully:', {
        popupId: validation.cleanData!.popupId,
        event: validation.cleanData!.event,
        sessionId: validation.cleanData!.sessionId,
        ip: clientIP
      });
      
      return json(
        { 
          success: true,
          message: 'Event tracked successfully'
        },
        { 
          status: 200,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            ...corsHeaders
          }
        }
      );
    } catch (error) {
      console.error('Error tracking event:', error);
      
      // Don't expose internal errors to client
      return json(
        { 
          error: 'Internal server error',
          message: 'Failed to track event'
        },
        { 
          status: 500,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            ...corsHeaders
          }
        }
      );
    }
  } catch (error) {
    console.error('Unexpected error in track-event API:', error);
    
    return json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      },
      { 
        status: 500,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          ...corsHeaders
        }
      }
    );
  }
}

// Cleanup function to remove expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW); // Clean up every minute