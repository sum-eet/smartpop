import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, Link as RemixLink } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Badge,
  ButtonGroup,
  TextField,
  InlineStack,
  BlockStack,
  Modal,
  Text,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { 
  getAllPopups, 
  togglePopupActive, 
  deletePopup,
  hasActivePopups
} from "../models/popup.server";
import { ensureScriptTagExists } from "../lib/script-tags.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search") || "";
  
  const popups = await getAllPopups(shop, searchQuery);
  
  return json({ popups, searchQuery });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const formData = await request.formData();
  const action = formData.get("action");
  const popupId = formData.get("popupId");
  
  if (!popupId || typeof popupId !== "string") {
    return json({ error: "Invalid popup ID" }, { status: 400 });
  }
  
  try {
    switch (action) {
      case "toggle":
        await togglePopupActive(popupId, shop);
        
        // Check if there are any active popups and ensure script tag exists
        const hasActive = await hasActivePopups(shop);
        if (hasActive) {
          try {
            await ensureScriptTagExists(request);
            console.log("✅ Script tag ensured after popup toggle");
          } catch (error) {
            console.error("❌ Failed to ensure script tag after toggle:", error);
          }
        }
        
        return json({ success: true });
      case "delete":
        await deletePopup(popupId, shop);
        return json({ success: true });
      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    return json({ error: "Operation failed" }, { status: 500 });
  }
};

export default function PopupsIndex() {
  const { popups, searchQuery } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const shopify = useAppBridge();
  
  const [search, setSearch] = useState(searchQuery);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    popup: any;
  }>({ isOpen: false, popup: null });

  const handleSearch = (value: string) => {
    setSearch(value);
    const searchParams = new URLSearchParams();
    if (value) {
      searchParams.set("search", value);
    }
    submit(searchParams, { method: "get" });
  };

  const handleToggleActive = (popupId: string) => {
    const formData = new FormData();
    formData.append("action", "toggle");
    formData.append("popupId", popupId);
    submit(formData, { method: "post" });
    shopify.toast.show("Popup status updated");
  };

  const handleDeleteConfirm = () => {
    if (deleteModal.popup) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("popupId", deleteModal.popup.id);
      submit(formData, { method: "post" });
      shopify.toast.show("Popup deleted");
      setDeleteModal({ isOpen: false, popup: null });
    }
  };

  const getTriggerDisplay = (triggerType: string, triggerValue: number) => {
    switch (triggerType) {
      case "delay":
        return `${triggerValue}s delay`;
      case "scroll":
        return `${triggerValue}% scroll`;
      case "exit":
        return "Exit intent";
      default:
        return "Unknown";
    }
  };

  const getConversionRate = (views: number, conversions: number) => {
    if (views === 0) return "0.0%";
    return `${((conversions / views) * 100).toFixed(1)}%`;
  };

  const rows = popups.map((popup) => [
    popup.title,
    <Badge tone={popup.isActive ? "success" : "critical"}>
      {popup.isActive ? "Active" : "Inactive"}
    </Badge>,
    getTriggerDisplay(popup.triggerType, popup.triggerValue),
    popup.views.toLocaleString(),
    popup.conversions.toLocaleString(),
    getConversionRate(popup.views, popup.conversions),
    <ButtonGroup>
      <RemixLink to={`/app/popups/${popup.id}`}>
        <Button size="slim">Edit</Button>
      </RemixLink>
      <Button 
        size="slim" 
        tone={popup.isActive ? "critical" : "success"}
        onClick={() => handleToggleActive(popup.id)}
      >
        {popup.isActive ? "Disable" : "Enable"}
      </Button>
      <Button 
        size="slim" 
        tone="critical"
        onClick={() => setDeleteModal({ isOpen: true, popup })}
      >
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  const headings = [
    "Title",
    "Status",
    "Trigger",
    "Views",
    "Conversions",
    "Rate",
    "Actions",
  ];

  return (
    <Page>
      <TitleBar title="Popups">
        <RemixLink to="/app/popups/new">
          <Button variant="primary">Create New Popup</Button>
        </RemixLink>
      </TitleBar>
      
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <div style={{ width: "300px" }}>
                  <TextField
                    label=""
                    value={search}
                    onChange={handleSearch}
                    placeholder="Search popups..."
                    clearButton
                    onClearButtonClick={() => handleSearch("")}
                    autoComplete="off"
                  />
                </div>
                <RemixLink to="/app/popups/new">
                  <Button variant="primary">Create New Popup</Button>
                </RemixLink>
              </InlineStack>
              
              {popups.length > 0 ? (
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text", 
                    "text",
                    "numeric",
                    "numeric",
                    "numeric",
                    "text",
                  ]}
                  headings={headings}
                  rows={rows}
                  pagination={{
                    hasNext: false,
                    hasPrevious: false,
                  }}
                />
              ) : (
                <EmptyState
                  heading="No popups found"
                  action={{
                    content: "Create your first popup",
                    url: "/app/popups/new",
                  }}
                  secondaryAction={{
                    content: "Learn more",
                    url: "https://help.shopify.com",
                  }}
                  image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
                >
                  <Text as="p" variant="bodyMd">
                    {search 
                      ? `No popups match "${search}". Try adjusting your search.`
                      : "Create your first popup to start capturing emails and growing your business."
                    }
                  </Text>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, popup: null })}
        title="Delete Popup"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: handleDeleteConfirm,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setDeleteModal({ isOpen: false, popup: null }),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p" variant="bodyMd">
            Are you sure you want to delete "{deleteModal.popup?.title}"? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}