import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { removeAllScriptTags } from "../lib/script-tags.server";
import { cleanupShopData } from "../models/popup.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("App uninstall webhook received");
  
  try {
    const { topic, shop, session, admin } = await authenticate.webhook(request);
    
    if (topic !== "APP_UNINSTALLED") {
      console.error("Invalid webhook topic:", topic);
      return new Response("Invalid webhook topic", { status: 400 });
    }
    
    console.log(`Processing app uninstall for shop: ${shop}`);
    
    // Remove all SmartPop script tags
    try {
      await removeAllScriptTags(request);
      console.log("✅ Successfully removed all script tags during uninstall");
    } catch (error) {
      console.error("❌ Error removing script tags during uninstall:", error);
    }
    
    // Clean up shop data (popups and analytics)
    try {
      await cleanupShopData(shop);
      console.log(`Successfully cleaned up data for shop: ${shop}`);
    } catch (error) {
      console.error("Error cleaning up shop data:", error);
    }
    
    console.log(`App uninstall processing completed for shop: ${shop}`);
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing app uninstall webhook:", error);
    
    // Return 200 to acknowledge webhook receipt even if processing failed
    // This prevents Shopify from retrying the webhook
    return new Response("Error processing webhook", { status: 200 });
  }
};