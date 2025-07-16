import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  // Check if this is an embedded app request
  if (url.searchParams.get("embedded") === "1") {
    // This is an embedded app request, redirect to the app route
    return redirect("/app");
  }
  
  // For non-embedded requests, authenticate first
  try {
    await authenticate.admin(request);
    return redirect("/app");
  } catch (error) {
    // If authentication fails, redirect to auth
    return redirect("/auth");
  }
};