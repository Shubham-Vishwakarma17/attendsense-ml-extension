import { expect, test } from "@playwright/test";

test("loads the login page and focuses email without submitting", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown error"}`);
  });

  const response = await page.goto("/", { waitUntil: "networkidle" });
  expect(response, "root navigation should return an HTTP response").not.toBeNull();
  expect(response?.ok(), `HTTP status was ${response?.status()}`).toBe(true);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("AttendSense Portal");

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText("Welcome to AttendSense");

  const email = page.getByLabel("Email");
  await expect(email).toBeVisible();
  await email.click();
  await expect(email).toBeFocused();
  await expect(email).toHaveValue("");

  console.log(JSON.stringify({
    httpStatus: response?.status(),
    currentUrl: page.url(),
    title: await page.title(),
    heading: await heading.textContent(),
    emailFocused: await email.evaluate((element) => element === document.activeElement),
    pageErrors,
    consoleErrors,
    failedRequests
  }));

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
