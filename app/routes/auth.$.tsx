import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log("🔍 Auth loader started", { 
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    const result = await authenticate.admin(request);
    
    console.log("🔍 Auth successful:", {
      hasResult: !!result,
      resultType: typeof result
    });
    
    return result;
  } catch (error) {
    console.error("💥 Auth loader error:", error);
    console.error("💥 Auth error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    throw error;
  }
};
