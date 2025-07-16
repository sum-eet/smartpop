import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log("🔍 App loader started", { url: request.url });
    console.log("🔍 Environment check:", {
      hasApiKey: !!process.env.SHOPIFY_API_KEY,
      hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
      hasAppUrl: !!process.env.SHOPIFY_APP_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      appUrl: process.env.SHOPIFY_APP_URL
    });

    const { session } = await authenticate.admin(request);
    
    console.log("🔍 Authentication successful:", {
      shop: session?.shop,
      hasSession: !!session,
      sessionId: session?.id
    });

    return { 
      apiKey: process.env.SHOPIFY_API_KEY || "",
      isEmbedded: true,
      shop: session?.shop
    };
  } catch (error) {
    console.error("💥 App loader error:", error);
    console.error("💥 Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    throw error;
  }
};

export default function App() {
  const { apiKey, isEmbedded, shop } = useLoaderData<typeof loader>();

  return (
    <AppProvider 
      isEmbeddedApp={isEmbedded} 
      apiKey={apiKey}
      shopOrigin={shop}
      forceRedirect={true}
    >
      <NavMenu>
        <Link to="/app" rel="home">
          Dashboard
        </Link>
        <Link to="/app/popups">Popups</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
