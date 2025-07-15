import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link as RemixLink } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Badge,
  DataTable,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getPopupStats, getRecentActivity } from "../models/popup.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    // Get dashboard statistics
    const stats = await getPopupStats(shop);
    const recentActivity = await getRecentActivity(shop);

    return json({
      stats,
      recentActivity,
    });
  } catch (error) {
    // Return default values if database is not set up yet
    return json({
      stats: {
        activePopups: 0,
        totalViews: 0,
        totalConversions: 0,
      },
      recentActivity: [],
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Actions can be added here for future functionality
  return json({ success: true });
};

export default function Index() {
  const { stats, recentActivity } = useLoaderData<typeof loader>();
  
  const conversionRate = stats.totalViews > 0 
    ? ((stats.totalConversions / stats.totalViews) * 100).toFixed(1)
    : "0.0";

  const recentActivityRows = recentActivity.map(activity => [
    activity.popupTitle,
    activity.event,
    new Date(activity.timestamp).toLocaleDateString(),
    new Date(activity.timestamp).toLocaleTimeString(),
  ]);

  return (
    <Page>
      <TitleBar title="SmartPop Dashboard">
        <RemixLink to="/app/popups/new">
          <Button variant="primary">Create New Popup</Button>
        </RemixLink>
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              {/* Statistics Cards */}
              <Layout>
                <Layout.Section variant="oneThird">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">
                        Active Popups
                      </Text>
                      <Text as="p" variant="displayLarge">
                        {stats.activePopups}
                      </Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>
                <Layout.Section variant="oneThird">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">
                        Total Views (30 days)
                      </Text>
                      <Text as="p" variant="displayLarge">
                        {stats.totalViews.toLocaleString()}
                      </Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>
                <Layout.Section variant="oneThird">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">
                        Total Conversions (30 days)
                      </Text>
                      <Text as="p" variant="displayLarge">
                        {stats.totalConversions.toLocaleString()}
                      </Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>
              </Layout>

              {/* Conversion Rate Card */}
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Conversion Rate
                  </Text>
                  <InlineStack gap="200" align="start">
                    <Text as="p" variant="displayLarge">
                      {conversionRate}%
                    </Text>
                    <Badge tone={parseFloat(conversionRate) > 5 ? "success" : parseFloat(conversionRate) > 2 ? "attention" : "critical"}>
                      {parseFloat(conversionRate) > 5 ? "Excellent" : parseFloat(conversionRate) > 2 ? "Good" : "Needs Improvement"}
                    </Badge>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* Quick Actions */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Quick Actions
                  </Text>
                  <InlineStack gap="300">
                    <RemixLink to="/app/popups/new">
                      <Button variant="primary">Create New Popup</Button>
                    </RemixLink>
                    <RemixLink to="/app/popups">
                      <Button>View All Popups</Button>
                    </RemixLink>
                  </InlineStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              {/* Recent Activity */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Recent Activity
                  </Text>
                  {recentActivity.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text"]}
                      headings={["Popup", "Event", "Date", "Time"]}
                      rows={recentActivityRows}
                      truncate
                    />
                  ) : (
                    <Text as="p" variant="bodyMd" tone="subdued">
                      No recent activity
                    </Text>
                  )}
                </BlockStack>
              </Card>

              {/* Performance Tips */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Performance Tips
                  </Text>
                  <List>
                    <List.Item>
                      Exit intent popups typically have higher conversion rates
                    </List.Item>
                    <List.Item>
                      Keep popup text concise and compelling
                    </List.Item>
                    <List.Item>
                      Test different trigger timings for optimal results
                    </List.Item>
                    <List.Item>
                      Monitor your conversion rate regularly
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
