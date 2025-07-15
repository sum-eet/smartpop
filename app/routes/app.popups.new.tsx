import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  RadioButton,
  Checkbox,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  FormLayout,
  Divider,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { createPopup } from "../models/popup.server";
import { ensureScriptTag } from "../utils/scriptTag.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  
  // Validation
  const errors: { [key: string]: string } = {};
  
  if (!data.title || typeof data.title !== "string" || data.title.length === 0) {
    errors.title = "Title is required";
  } else if (data.title.length > 100) {
    errors.title = "Title must be 100 characters or less";
  }
  
  if (!data.triggerType || typeof data.triggerType !== "string") {
    errors.triggerType = "Trigger type is required";
  }
  
  if (data.triggerType === "delay") {
    const triggerValue = parseInt(data.triggerValue as string);
    if (isNaN(triggerValue) || triggerValue < 1 || triggerValue > 60) {
      errors.triggerValue = "Delay must be between 1 and 60 seconds";
    }
  } else if (data.triggerType === "scroll") {
    const triggerValue = parseInt(data.triggerValue as string);
    if (isNaN(triggerValue) || triggerValue < 10 || triggerValue > 90) {
      errors.triggerValue = "Scroll percentage must be between 10 and 90";
    }
  }
  
  if (!data.heading || typeof data.heading !== "string" || data.heading.length === 0) {
    errors.heading = "Heading is required";
  } else if (data.heading.length > 60) {
    errors.heading = "Heading must be 60 characters or less";
  }
  
  if (data.description && typeof data.description === "string" && data.description.length > 200) {
    errors.description = "Description must be 200 characters or less";
  }
  
  if (!data.buttonText || typeof data.buttonText !== "string" || data.buttonText.length === 0) {
    errors.buttonText = "Button text is required";
  } else if (data.buttonText.length > 30) {
    errors.buttonText = "Button text must be 30 characters or less";
  }
  
  if (data.discountCode && typeof data.discountCode === "string") {
    if (!/^[a-zA-Z0-9]+$/.test(data.discountCode)) {
      errors.discountCode = "Discount code must be alphanumeric only";
    }
  }
  
  if (Object.keys(errors).length > 0) {
    return json({ errors, values: data }, { status: 400 });
  }
  
  try {
    // Create the popup
    await createPopup({
      shop,
      title: data.title as string,
      isActive: data.isActive === "true",
      triggerType: data.triggerType as string,
      triggerValue: data.triggerType === "exit" ? 0 : parseInt(data.triggerValue as string),
      heading: data.heading as string,
      description: data.description as string || null,
      buttonText: data.buttonText as string,
      discountCode: data.discountCode as string || null,
    });
    
    // Ensure script tag is installed
    const scriptTagResult = await ensureScriptTag(admin);
    if (!scriptTagResult.success) {
      console.error("Failed to ensure script tag:", scriptTagResult.error);
      // Don't fail the popup creation, just log the error
    }
    
    return redirect("/app/popups");
  } catch (error) {
    return json({ 
      errors: { general: "Failed to create popup. Please try again." }, 
      values: data 
    }, { status: 500 });
  }
};

export default function NewPopup() {
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  
  const [formData, setFormData] = useState({
    title: actionData?.values?.title || "",
    isActive: actionData?.values?.isActive === "true" || actionData?.values?.isActive === undefined,
    triggerType: actionData?.values?.triggerType || "delay",
    triggerValue: actionData?.values?.triggerValue || "5",
    heading: actionData?.values?.heading || "",
    description: actionData?.values?.description || "",
    buttonText: actionData?.values?.buttonText || "Get Discount",
    discountCode: actionData?.values?.discountCode || "",
  });
  
  const isSubmitting = navigation.state === "submitting";
  
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    submit(form, { method: "post" });
  };
  
  const handleFieldChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const getTriggerValuePlaceholder = () => {
    switch (formData.triggerType) {
      case "delay":
        return "5";
      case "scroll":
        return "50";
      default:
        return "";
    }
  };
  
  const getTriggerValueLabel = () => {
    switch (formData.triggerType) {
      case "delay":
        return "Seconds to wait";
      case "scroll":
        return "Scroll percentage";
      default:
        return "";
    }
  };
  
  const getTriggerValueHelpText = () => {
    switch (formData.triggerType) {
      case "delay":
        return "Enter a value between 1 and 60 seconds";
      case "scroll":
        return "Enter a value between 10 and 90 percent";
      default:
        return "";
    }
  };

  return (
    <Page
      backAction={{ content: "Popups", url: "/app/popups" }}
      title="Create New Popup"
    >
      <Layout>
        <Layout.Section>
          <form onSubmit={handleSubmit}>
            <FormLayout>
              {actionData?.errors?.general && (
                <Banner tone="critical">
                  <Text as="p" variant="bodyMd">
                    {actionData.errors.general}
                  </Text>
                </Banner>
              )}
              
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Basic Information
                  </Text>
                  <Divider />
                  
                  <TextField
                    label="Title"
                    value={formData.title}
                    onChange={(value) => handleFieldChange("title", value)}
                    error={actionData?.errors?.title}
                    helpText="Internal name for this popup (max 100 characters)"
                    maxLength={100}
                    showCharacterCount
                    requiredIndicator
                    autoComplete="off"
                  />
                  
                  <Checkbox
                    label="Active"
                    checked={formData.isActive}
                    onChange={(checked) => handleFieldChange("isActive", checked)}
                    helpText="Enable this popup to show on your store"
                  />
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Trigger Settings
                  </Text>
                  <Divider />
                  
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd">
                      Choose when to show this popup to visitors
                    </Text>
                    
                    <RadioButton
                      label="Time Delay"
                      helpText="Show popup after a specific number of seconds"
                      checked={formData.triggerType === "delay"}
                      id="delay"
                      name="triggerType"
                      onChange={() => handleFieldChange("triggerType", "delay")}
                    />
                    
                    <RadioButton
                      label="Scroll Percentage"
                      helpText="Show popup when user scrolls a certain percentage of the page"
                      checked={formData.triggerType === "scroll"}
                      id="scroll"
                      name="triggerType"
                      onChange={() => handleFieldChange("triggerType", "scroll")}
                    />
                    
                    <RadioButton
                      label="Exit Intent"
                      helpText="Show popup when user moves mouse toward browser controls"
                      checked={formData.triggerType === "exit"}
                      id="exit"
                      name="triggerType"
                      onChange={() => handleFieldChange("triggerType", "exit")}
                    />
                  </BlockStack>
                  
                  {formData.triggerType !== "exit" && (
                    <TextField
                      label={getTriggerValueLabel()}
                      type="number"
                      value={formData.triggerValue}
                      onChange={(value) => handleFieldChange("triggerValue", value)}
                      error={actionData?.errors?.triggerValue}
                      helpText={getTriggerValueHelpText()}
                      placeholder={getTriggerValuePlaceholder()}
                      min={formData.triggerType === "delay" ? 1 : 10}
                      max={formData.triggerType === "delay" ? 60 : 90}
                      autoComplete="off"
                    />
                  )}
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Content
                  </Text>
                  <Divider />
                  
                  <TextField
                    label="Heading"
                    value={formData.heading}
                    onChange={(value) => handleFieldChange("heading", value)}
                    error={actionData?.errors?.heading}
                    helpText="Main title text for your popup (max 60 characters)"
                    maxLength={60}
                    showCharacterCount
                    requiredIndicator
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Description"
                    value={formData.description}
                    onChange={(value) => handleFieldChange("description", value)}
                    error={actionData?.errors?.description}
                    helpText="Additional text to explain your offer (max 200 characters, optional)"
                    maxLength={200}
                    showCharacterCount
                    multiline={3}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Button Text"
                    value={formData.buttonText}
                    onChange={(value) => handleFieldChange("buttonText", value)}
                    error={actionData?.errors?.buttonText}
                    helpText="Call-to-action button text (max 30 characters)"
                    maxLength={30}
                    showCharacterCount
                    requiredIndicator
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Discount Code"
                    value={formData.discountCode}
                    onChange={(value) => handleFieldChange("discountCode", value)}
                    error={actionData?.errors?.discountCode}
                    helpText="Optional discount code to offer (alphanumeric only)"
                    placeholder="SAVE20"
                    autoComplete="off"
                  />
                </BlockStack>
              </Card>
              
              <InlineStack align="end" gap="300">
                <Button
                  url="/app/popups"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  submit
                  loading={isSubmitting}
                >
                  Create Popup
                </Button>
              </InlineStack>
            </FormLayout>
            
            {/* Hidden fields for form submission */}
            <input type="hidden" name="title" value={formData.title} />
            <input type="hidden" name="isActive" value={formData.isActive.toString()} />
            <input type="hidden" name="triggerType" value={formData.triggerType} />
            <input type="hidden" name="triggerValue" value={formData.triggerValue} />
            <input type="hidden" name="heading" value={formData.heading} />
            <input type="hidden" name="description" value={formData.description} />
            <input type="hidden" name="buttonText" value={formData.buttonText} />
            <input type="hidden" name="discountCode" value={formData.discountCode} />
          </form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}