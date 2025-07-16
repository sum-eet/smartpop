import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

console.log("🔍 Shopify app config:", {
  hasApiKey: !!process.env.SHOPIFY_API_KEY,
  hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
  hasAppUrl: !!process.env.SHOPIFY_APP_URL,
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  apiKey: process.env.SHOPIFY_API_KEY?.substring(0, 10) + "...",
  appUrl: process.env.SHOPIFY_APP_URL,
  scopes: process.env.SCOPES?.split(","),
  apiVersion: ApiVersion.January25
});

const prismaSessionStorage = new PrismaSessionStorage(prisma);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "https://smartpop.vercel.app",
  authPathPrefix: "/auth",
  sessionStorage: prismaSessionStorage,
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: true,
  useOnlineTokens: true,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
