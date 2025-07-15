import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <html>
        <head>
          <title>Error {error.status}</title>
          <Meta />
          <Links />
        </head>
        <body>
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            fontFamily: 'system-ui, sans-serif' 
          }}>
            <h1>Error {error.status}</h1>
            <p>{error.statusText || 'An error occurred'}</p>
            {error.data && <p>{error.data}</p>}
            <a href="/app" style={{ 
              color: '#006fbb', 
              textDecoration: 'none',
              padding: '0.5rem 1rem',
              border: '1px solid #006fbb',
              borderRadius: '4px',
              display: 'inline-block',
              marginTop: '1rem'
            }}>
              Go to Dashboard
            </a>
          </div>
          <Scripts />
        </body>
      </html>
    );
  }

  return (
    <html>
      <head>
        <title>Application Error</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          fontFamily: 'system-ui, sans-serif' 
        }}>
          <h1>Application Error</h1>
          <p>Something went wrong. Please try again.</p>
          <a href="/app" style={{ 
            color: '#006fbb', 
            textDecoration: 'none',
            padding: '0.5rem 1rem',
            border: '1px solid #006fbb',
            borderRadius: '4px',
            display: 'inline-block',
            marginTop: '1rem'
          }}>
            Go to Dashboard
          </a>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
