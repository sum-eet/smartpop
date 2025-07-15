import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
    return redirect("/app");
  } catch (error) {
    console.error("Authentication error:", error);
    throw new Response("Authentication failed", { status: 401 });
  }
};
