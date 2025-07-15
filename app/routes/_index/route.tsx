import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>SmartPop - Shopify Popup Tool</h1>
        <p className={styles.text}>
          Create beautiful trigger-based popups for email capture on your Shopify store.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Easy Setup</strong>. Create popups in minutes with our intuitive admin interface and automatic script injection.
          </li>
          <li>
            <strong>Multiple Triggers</strong>. Show popups based on time delay, scroll percentage, or exit intent detection.
          </li>
          <li>
            <strong>Mobile Optimized</strong>. Responsive popups that work perfectly on all devices and screen sizes.
          </li>
        </ul>
      </div>
    </div>
  );
}
