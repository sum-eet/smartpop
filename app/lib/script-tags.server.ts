import { authenticate } from "../shopify.server";

const SCRIPT_TAG_SRC = "https://smartpop.vercel.app/popup-script.js";

// GraphQL mutation to create script tag
const CREATE_SCRIPT_TAG = `
  mutation scriptTagCreate($input: ScriptTagInput!) {
    scriptTagCreate(input: $input) {
      scriptTag {
        id
        src
        displayScope
        cache
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL mutation to delete script tag
const DELETE_SCRIPT_TAG = `
  mutation scriptTagDelete($id: ID!) {
    scriptTagDelete(id: $id) {
      deletedScriptTagId
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL query to list script tags
const GET_SCRIPT_TAGS = `
  query scriptTags($first: Int!) {
    scriptTags(first: $first) {
      edges {
        node {
          id
          src
          displayScope
          cache
          createdAt
        }
      }
    }
  }
`;

export async function createScriptTag(request: Request) {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🔧 Creating script tag:", SCRIPT_TAG_SRC);
    
    const response = await admin.graphql(CREATE_SCRIPT_TAG, {
      variables: {
        input: {
          src: SCRIPT_TAG_SRC,
          displayScope: "ONLINE_STORE",
          cache: false
        }
      }
    });
    
    const result = await response.json();
    
    if (result.data?.scriptTagCreate?.userErrors?.length > 0) {
      const errors = result.data.scriptTagCreate.userErrors;
      console.error("❌ Script tag creation errors:", errors);
      throw new Error(`Script tag creation failed: ${errors.map((e: any) => e.message).join(", ")}`);
    }
    
    const scriptTag = result.data?.scriptTagCreate?.scriptTag;
    
    if (!scriptTag) {
      console.error("❌ No script tag returned from creation");
      throw new Error("Failed to create script tag");
    }
    
    console.log("✅ Script tag created successfully:", scriptTag.id);
    return scriptTag;
    
  } catch (error) {
    console.error("💥 Error creating script tag:", error);
    throw error;
  }
}

export async function deleteScriptTag(request: Request, scriptTagId: string) {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("🗑️ Deleting script tag:", scriptTagId);
    
    const response = await admin.graphql(DELETE_SCRIPT_TAG, {
      variables: {
        id: scriptTagId
      }
    });
    
    const result = await response.json();
    
    if (result.data?.scriptTagDelete?.userErrors?.length > 0) {
      const errors = result.data.scriptTagDelete.userErrors;
      console.error("❌ Script tag deletion errors:", errors);
      throw new Error(`Script tag deletion failed: ${errors.map((e: any) => e.message).join(", ")}`);
    }
    
    const deletedId = result.data?.scriptTagDelete?.deletedScriptTagId;
    
    if (!deletedId) {
      console.error("❌ No script tag ID returned from deletion");
      throw new Error("Failed to delete script tag");
    }
    
    console.log("✅ Script tag deleted successfully:", deletedId);
    return deletedId;
    
  } catch (error) {
    console.error("💥 Error deleting script tag:", error);
    throw error;
  }
}

export async function getScriptTags(request: Request) {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("📋 Fetching script tags");
    
    const response = await admin.graphql(GET_SCRIPT_TAGS, {
      variables: {
        first: 50
      }
    });
    
    const result = await response.json();
    const scriptTags = result.data?.scriptTags?.edges?.map((edge: any) => edge.node) || [];
    
    console.log("📋 Found script tags:", scriptTags.length);
    return scriptTags;
    
  } catch (error) {
    console.error("💥 Error fetching script tags:", error);
    throw error;
  }
}

export async function ensureScriptTagExists(request: Request) {
  try {
    const scriptTags = await getScriptTags(request);
    
    // Check if our script tag already exists
    const existingTag = scriptTags.find((tag: any) => tag.src === SCRIPT_TAG_SRC);
    
    if (existingTag) {
      console.log("✅ Script tag already exists:", existingTag.id);
      return existingTag;
    }
    
    // Create new script tag if it doesn't exist
    const newTag = await createScriptTag(request);
    return newTag;
    
  } catch (error) {
    console.error("💥 Error ensuring script tag exists:", error);
    throw error;
  }
}

export async function removeAllScriptTags(request: Request) {
  try {
    const scriptTags = await getScriptTags(request);
    
    // Filter for our script tags
    const ourScriptTags = scriptTags.filter((tag: any) => tag.src === SCRIPT_TAG_SRC);
    
    console.log("🗑️ Removing script tags:", ourScriptTags.length);
    
    const deletionPromises = ourScriptTags.map((tag: any) => 
      deleteScriptTag(request, tag.id)
    );
    
    await Promise.all(deletionPromises);
    
    console.log("✅ All script tags removed successfully");
    
  } catch (error) {
    console.error("💥 Error removing script tags:", error);
    throw error;
  }
}