import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

// Script tag configuration
const SCRIPT_TAG_CONFIG = {
  src: process.env.SHOPIFY_APP_URL + "/popup-script.js",
  display_scope: "online_store" as const,
  cache: false,
};

// GraphQL mutations for script tag management
const CREATE_SCRIPT_TAG_MUTATION = `
  mutation scriptTagCreate($input: ScriptTagInput!) {
    scriptTagCreate(input: $input) {
      scriptTag {
        id
        src
        displayScope
        cache
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE_SCRIPT_TAG_MUTATION = `
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

const GET_SCRIPT_TAGS_QUERY = `
  query scriptTags($first: Int!) {
    scriptTags(first: $first) {
      edges {
        node {
          id
          src
          displayScope
          cache
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export interface ScriptTag {
  id: string;
  src: string;
  displayScope: string;
  cache: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptTagError {
  field: string;
  message: string;
}

export interface CreateScriptTagResult {
  scriptTag?: ScriptTag;
  userErrors: ScriptTagError[];
}

export interface DeleteScriptTagResult {
  deletedScriptTagId?: string;
  userErrors: ScriptTagError[];
}

/**
 * Creates a script tag in the Shopify store
 */
export async function createScriptTag(
  admin: AdminApiContext["admin"]
): Promise<CreateScriptTagResult> {
  try {
    const response = await admin.graphql(CREATE_SCRIPT_TAG_MUTATION, {
      variables: {
        input: SCRIPT_TAG_CONFIG,
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error("GraphQL errors creating script tag:", data.errors);
      return {
        userErrors: data.errors.map((error: any) => ({
          field: "graphql",
          message: error.message,
        })),
      };
    }

    const result = data.data?.scriptTagCreate;
    
    if (!result) {
      console.error("No result from script tag creation");
      return {
        userErrors: [
          {
            field: "general",
            message: "Failed to create script tag",
          },
        ],
      };
    }

    if (result.userErrors && result.userErrors.length > 0) {
      console.error("User errors creating script tag:", result.userErrors);
      return {
        userErrors: result.userErrors,
      };
    }

    console.log("Script tag created successfully:", result.scriptTag);
    return {
      scriptTag: result.scriptTag,
      userErrors: [],
    };
  } catch (error) {
    console.error("Error creating script tag:", error);
    return {
      userErrors: [
        {
          field: "general",
          message: "Failed to create script tag",
        },
      ],
    };
  }
}

/**
 * Deletes a script tag from the Shopify store
 */
export async function deleteScriptTag(
  admin: AdminApiContext["admin"],
  scriptTagId: string
): Promise<DeleteScriptTagResult> {
  try {
    const response = await admin.graphql(DELETE_SCRIPT_TAG_MUTATION, {
      variables: {
        id: scriptTagId,
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error("GraphQL errors deleting script tag:", data.errors);
      return {
        userErrors: data.errors.map((error: any) => ({
          field: "graphql",
          message: error.message,
        })),
      };
    }

    const result = data.data?.scriptTagDelete;
    
    if (!result) {
      console.error("No result from script tag deletion");
      return {
        userErrors: [
          {
            field: "general",
            message: "Failed to delete script tag",
          },
        ],
      };
    }

    if (result.userErrors && result.userErrors.length > 0) {
      console.error("User errors deleting script tag:", result.userErrors);
      return {
        userErrors: result.userErrors,
      };
    }

    console.log("Script tag deleted successfully:", result.deletedScriptTagId);
    return {
      deletedScriptTagId: result.deletedScriptTagId,
      userErrors: [],
    };
  } catch (error) {
    console.error("Error deleting script tag:", error);
    return {
      userErrors: [
        {
          field: "general",
          message: "Failed to delete script tag",
        },
      ],
    };
  }
}

/**
 * Gets all script tags from the Shopify store
 */
export async function getScriptTags(
  admin: AdminApiContext["admin"]
): Promise<ScriptTag[]> {
  try {
    const scriptTags: ScriptTag[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const response = await admin.graphql(GET_SCRIPT_TAGS_QUERY, {
        variables: {
          first: 50,
          ...(cursor && { after: cursor }),
        },
      });

      const data = await response.json();
      
      if (data.errors) {
        console.error("GraphQL errors getting script tags:", data.errors);
        break;
      }

      const result = data.data?.scriptTags;
      
      if (!result) {
        console.error("No result from script tags query");
        break;
      }

      scriptTags.push(...result.edges.map((edge: any) => edge.node));
      
      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor;
    }

    return scriptTags;
  } catch (error) {
    console.error("Error getting script tags:", error);
    return [];
  }
}

/**
 * Finds existing SmartPop script tags
 */
export async function findSmartPopScriptTags(
  admin: AdminApiContext["admin"]
): Promise<ScriptTag[]> {
  try {
    const allScriptTags = await getScriptTags(admin);
    
    // Filter for SmartPop script tags
    const smartPopScriptTags = allScriptTags.filter((scriptTag) => {
      return scriptTag.src.includes("popup-script.js") || 
             scriptTag.src.includes("smartpop");
    });

    return smartPopScriptTags;
  } catch (error) {
    console.error("Error finding SmartPop script tags:", error);
    return [];
  }
}

/**
 * Ensures a script tag exists for the store
 * Creates one if it doesn't exist, or updates if needed
 */
export async function ensureScriptTag(
  admin: AdminApiContext["admin"]
): Promise<{ success: boolean; scriptTag?: ScriptTag; error?: string }> {
  try {
    const existingScriptTags = await findSmartPopScriptTags(admin);
    
    // Check if we already have a script tag with the correct src
    const currentScriptTag = existingScriptTags.find(
      (tag) => tag.src === SCRIPT_TAG_CONFIG.src
    );

    if (currentScriptTag) {
      console.log("Script tag already exists:", currentScriptTag.id);
      return {
        success: true,
        scriptTag: currentScriptTag,
      };
    }

    // Remove any old script tags first
    for (const oldTag of existingScriptTags) {
      console.log("Removing old script tag:", oldTag.id);
      await deleteScriptTag(admin, oldTag.id);
    }

    // Create new script tag
    const createResult = await createScriptTag(admin);
    
    if (createResult.userErrors.length > 0) {
      return {
        success: false,
        error: createResult.userErrors[0].message,
      };
    }

    return {
      success: true,
      scriptTag: createResult.scriptTag,
    };
  } catch (error) {
    console.error("Error ensuring script tag:", error);
    return {
      success: false,
      error: "Failed to manage script tag",
    };
  }
}

/**
 * Removes all SmartPop script tags from the store
 */
export async function removeAllSmartPopScriptTags(
  admin: AdminApiContext["admin"]
): Promise<{ success: boolean; removedCount: number; error?: string }> {
  try {
    const existingScriptTags = await findSmartPopScriptTags(admin);
    
    if (existingScriptTags.length === 0) {
      console.log("No SmartPop script tags found to remove");
      return {
        success: true,
        removedCount: 0,
      };
    }

    let removedCount = 0;
    const errors: string[] = [];

    for (const scriptTag of existingScriptTags) {
      console.log("Removing script tag:", scriptTag.id);
      const deleteResult = await deleteScriptTag(admin, scriptTag.id);
      
      if (deleteResult.userErrors.length > 0) {
        errors.push(deleteResult.userErrors[0].message);
      } else {
        removedCount++;
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        removedCount,
        error: `Failed to remove some script tags: ${errors.join(", ")}`,
      };
    }

    console.log(`Successfully removed ${removedCount} script tags`);
    return {
      success: true,
      removedCount,
    };
  } catch (error) {
    console.error("Error removing script tags:", error);
    return {
      success: false,
      removedCount: 0,
      error: "Failed to remove script tags",
    };
  }
}

/**
 * Validates that the script tag URL is accessible
 */
export async function validateScriptTagUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      timeout: 5000,
    });
    
    return response.ok;
  } catch (error) {
    console.error("Error validating script tag URL:", error);
    return false;
  }
}