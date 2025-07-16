import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  addDocumentResponseHeaders(request, responseHeaders);
  
  // Add CSP headers for Shopify app embedding
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com https://cdn.jsdelivr.net https://app-bridge.shopifycloud.com",
    "style-src 'self' 'unsafe-inline' https://cdn.shopify.com https://fonts.googleapis.com https://app-bridge.shopifycloud.com",
    "font-src 'self' https://cdn.shopify.com https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.shopify.com https://app-bridge.shopifycloud.com https://cdn.shopify.com wss://app-bridge.shopifycloud.com https://*.shopify.com https://*.myshopify.com",
    "frame-ancestors https://*.shopify.com https://admin.shopify.com https://*.myshopify.com https://shopify.com",
    "frame-src 'self' https://*.shopify.com https://admin.shopify.com https://*.myshopify.com https://app-bridge.shopifycloud.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.shopify.com https://*.myshopify.com"
  ];
  
  responseHeaders.set("Content-Security-Policy", cspDirectives.join("; "));
  
  // Don't set X-Frame-Options when embedded - let CSP handle it
  // X-Frame-Options can conflict with frame-ancestors directive
  if (!request.headers.get("sec-fetch-dest")?.includes("iframe")) {
    responseHeaders.set("X-Frame-Options", "SAMEORIGIN");
  }
  
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? '')
    ? "onAllReady"
    : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
      />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      }
    );

    // Automatically timeout the React renderer after 6 seconds, which ensures
    // React has enough time to flush down the rejected boundary contents
    setTimeout(abort, streamTimeout + 1000);
  });
}
