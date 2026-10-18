import { expect, type Page, type Request, type TestInfo } from "@playwright/test";

export interface RuntimeMonitor {
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
}

export function monitorRuntime(page: Page): RuntimeMonitor {
  const report: RuntimeMonitor = { pageErrors: [], consoleErrors: [], failedRequests: [] };
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request: Request) => {
    report.failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown error"}`);
  });
  return report;
}

export async function assertCleanRuntime(report: RuntimeMonitor, testInfo: TestInfo) {
  await testInfo.attach("runtime-monitor.json", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json"
  });
  expect(report.pageErrors, "uncaught page errors").toEqual([]);
  expect(report.consoleErrors, "browser console errors").toEqual([]);
  expect(report.failedRequests, "failed network requests").toEqual([]);
}

export async function login(page: Page, email: string) {
  if (!new URL(page.url()).pathname.endsWith("/login")) await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo-password");
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function navigateClient(page: Page, pathname: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, pathname);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    return {
      clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((element) => element.getBoundingClientRect().right > clientWidth + 1)
        .map((element) => ({
          element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList].map((name) => `.${name}`).join("")}`,
          left: Math.round(element.getBoundingClientRect().left),
          right: Math.round(element.getBoundingClientRect().right),
          width: Math.round(element.getBoundingClientRect().width)
        }))
        .slice(0, 10)
    };
  });
  expect.soft(
    dimensions.scrollWidth,
    `page width ${dimensions.scrollWidth} exceeds viewport ${dimensions.clientWidth}; offenders: ${JSON.stringify(dimensions.offenders)}`
  ).toBeLessThanOrEqual(dimensions.clientWidth);
}

export async function createLecture(page: Page, title: string, studentEmails: string) {
  await page.getByLabel("Lecture title").fill(title);
  await page.getByLabel("Description").fill("Playwright isolated demo lecture");
  await page.getByLabel("Google Meet URL").fill("https://meet.google.com/abc-defg-hij");
  await page.getByLabel("Scheduled date and time").fill("2026-11-20T10:30");
  await page.getByLabel("Student emails").fill(studentEmails);
  await page.getByRole("button", { name: "Create lecture" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Lecture created." })).toBeVisible();
}
