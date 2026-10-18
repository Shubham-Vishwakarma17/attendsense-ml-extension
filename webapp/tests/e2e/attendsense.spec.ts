import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  assertCleanRuntime,
  createLecture,
  expectNoPageOverflow,
  login,
  logout,
  monitorRuntime,
  navigateClient
} from "./helpers";

const teacherEmail = "teacher@demo.local";
const studentEmail = "student@demo.local";
const seededLecture = "Machine Learning Foundations";
const fixturePath = path.join(import.meta.dirname, "fixtures", "session.json");

test("authentication, role routing, history, and unknown routes are safe", async ({ page }, testInfo) => {
  const runtime = monitorRuntime(page);

  await page.goto("/teacher");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, teacherEmail);
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole("heading", { name: "Lecture overview" })).toBeVisible();

  await navigateClient(page, "/student");
  await expect(page).toHaveURL(/\/teacher$/);
  await navigateClient(page, "/unknown-route");
  await expect(page).toHaveURL(/\/teacher$/);

  await logout(page);
  await login(page, studentEmail);
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "Your assigned lectures" })).toBeVisible();

  await navigateClient(page, "/teacher");
  await expect(page).toHaveURL(/\/student$/);
  await navigateClient(page, "/unknown-route");
  await expect(page).toHaveURL(/\/student$/);

  await logout(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/login$/);

  await assertCleanRuntime(runtime, testInfo);
});

test("teacher can validate, create, inspect, update, and delete isolated demo lectures", async ({ page }, testInfo) => {
  const runtime = monitorRuntime(page);
  const title = "Playwright Systems Seminar";
  await login(page, teacherEmail);

  const summary = page.getByRole("region", { name: "Lecture summary" });
  await expect(summary).toContainText("Total lectures");
  await expect(summary).toContainText("Submissions");
  await expect(page.getByRole("heading", { name: seededLecture })).toBeVisible();

  await page.getByLabel("Lecture title").fill(title);
  await page.getByLabel("Google Meet URL").fill("https://example.com/not-meet");
  await page.getByLabel("Scheduled date and time").fill("2026-11-20T10:30");
  await page.getByLabel("Student emails").fill(studentEmail);
  await page.getByRole("button", { name: "Create lecture" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Use an HTTPS meet.google.com URL." })).toBeVisible();

  await page.getByLabel("Google Meet URL").fill("https://meet.google.com/abc-defg-hij");
  await page.getByLabel("Student emails").fill("not-an-email");
  await page.getByRole("button", { name: "Create lecture" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Invalid student email: not-an-email" })).toBeVisible();

  await page.getByLabel("Student emails").fill(" Student@Demo.Local, student@demo.local\nMIRA@DEMO.LOCAL ");
  await expect(page.getByText("2 valid unique students")).toBeVisible();
  await page.getByRole("button", { name: "Create lecture" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Lecture created." })).toBeVisible();

  const created = page.locator("article.lecture-row").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(created).toBeVisible();
  await created.getByText("Assigned students (2)").click();
  await expect(created.getByText(studentEmail, { exact: true })).toBeVisible();
  await expect(created.getByText("mira@demo.local", { exact: true })).toBeVisible();

  const status = created.getByLabel(`Status for ${title}`);
  for (const value of ["active", "completed", "scheduled"] as const) {
    await status.selectOption(value);
    await expect(status).toHaveValue(value);
  }

  await created.getByRole("link", { name: "View results" }).click();
  await expect(page).toHaveURL(/\/teacher\/lectures\/demo-lecture-\d+\/results$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("No submissions received yet.")).toBeVisible();
  await expect(page.getByText("Mira Student")).toHaveCount(0);
  const createdResultsUrl = page.url();

  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goBack();
  await expect(page).toHaveURL(createdResultsUrl);
  await page.goBack();
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goForward();
  await expect(page).toHaveURL(createdResultsUrl);
  await page.getByRole("link", { name: "Teacher dashboard" }).click();

  const seedRow = page.locator("article.lecture-row").filter({ has: page.getByRole("heading", { name: seededLecture }) });
  await seedRow.getByRole("link", { name: "View results" }).click();
  await expect(page.getByRole("table").getByText("Mira Student")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
  await page.getByRole("link", { name: "Back to dashboard" }).click();

  const disposable = page.locator("article.lecture-row").filter({ has: page.getByRole("heading", { name: title }) });
  page.once("dialog", (dialog) => dialog.accept());
  await disposable.getByRole("button", { name: "Delete" }).click();
  await expect(disposable).toHaveCount(0);
  await expect(seedRow).toBeVisible();

  await assertCleanRuntime(runtime, testInfo);
});

test("student upload, local inference, replacement, and teacher details stay lecture-scoped", async ({ page }, testInfo) => {
  const runtime = monitorRuntime(page);
  await login(page, studentEmail);

  const lecture = page.locator("article.student-lecture").filter({ has: page.getByRole("heading", { name: seededLecture }) });
  await expect(lecture).toBeVisible();
  await expect(lecture.getByText("active", { exact: true })).toBeVisible();
  await expect(lecture).toContainText("Dr. Asha Mehta");
  const meetLink = lecture.getByRole("link", { name: "Join Google Meet" });
  await expect(meetLink).toHaveAttribute("href", "https://meet.google.com/demo-demo-demo");
  await expect(meetLink).toHaveAttribute("target", "_blank");
  await expect(meetLink).toHaveAttribute("rel", "noreferrer");

  const upload = lecture.getByLabel(`Upload session for ${seededLecture}`);
  await upload.setInputFiles(fixturePath);
  await expect(lecture.getByRole("status").filter({ hasText: "Session validated locally." })).toBeVisible();
  await expect(lecture.getByRole("heading", { name: "Review prediction before submitting" })).toBeVisible();
  await expect(lecture.getByText("3 samples · 60s")).toBeVisible();
  await expect(lecture.locator(".review-summary").getByText("Active participation", { exact: true }).first()).toBeVisible();
  await expect(lecture.getByLabel("Class probabilities")).toBeVisible();
  await expect(lecture.getByText(/not evidence of real-world accuracy/i)).toBeVisible();
  await expect(lecture).not.toContainText("active_participation");
  await expect(lecture).not.toContainText("passive_listening");

  await lecture.getByRole("button", { name: "Submit to teacher" }).click();
  await expect(lecture.getByRole("status").filter({ hasText: "Submission saved." })).toBeVisible();
  await expect(lecture.getByText("Submitted", { exact: true })).toBeVisible();

  await upload.setInputFiles([]);
  await upload.setInputFiles(fixturePath);
  await expect(lecture.getByRole("button", { name: "Replace submission" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await lecture.getByRole("button", { name: "Replace submission" }).click();
  await expect(lecture.getByRole("status").filter({ hasText: "Submission saved." })).toBeVisible();

  await logout(page);
  await login(page, teacherEmail);
  const seedRow = page.locator("article.lecture-row").filter({ has: page.getByRole("heading", { name: seededLecture }) });
  await seedRow.getByRole("link", { name: "View results" }).click();
  await expect(page).toHaveURL(/\/teacher\/lectures\/demo-lecture\/results$/);
  await expect(page.getByRole("table").getByText("Aarav Student")).toBeVisible();
  await expect(page.getByRole("table").getByText("Mira Student")).toBeVisible();
  await expect(page.getByText("2 of 3 submitted")).toBeVisible();

  const aaravRow = page.getByRole("row").filter({ hasText: "Aarav Student" });
  await aaravRow.getByRole("link", { name: "Inspect submission" }).click();
  await expect(page).toHaveURL(/\/teacher\/lectures\/demo-lecture\/results\/demo-student-1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Aarav Student" })).toBeVisible();
  await expect(page.locator(".result-comparison section").first().getByText("Active participation", { exact: true })).toBeVisible();
  await expect(page.locator(".result-comparison section").nth(1).getByText("Active participation", { exact: true })).toBeVisible();
  for (const metric of ["Confidence", "Duration", "Samples", "Tab visible", "Window focused", "Recent interaction", "Mean idle"]) {
    await expect(page.locator(".detail-metrics").getByText(metric, { exact: true })).toBeVisible();
  }
  await expect(page.getByLabel("Class probabilities")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity timeline" })).toBeVisible();
  await expect(page.getByLabel("Session sample timeline")).toBeVisible();
  await expect(page.getByText(/3 recorded states/i)).toBeVisible();
  await expect(page.getByText(/Scientific boundary:/)).toBeVisible();

  await navigateClient(page, "/teacher/lectures/demo-lecture/results/unknown-student");
  await expect(page.getByRole("heading", { name: "Submission unavailable" })).toBeVisible();
  await navigateClient(page, "/teacher/lectures/unknown-lecture/results");
  await expect(page.getByRole("heading", { name: "Lecture unavailable" })).toBeVisible();

  await assertCleanRuntime(runtime, testInfo);
});

test("responsive layouts, independent cards, mobile results, and keyboard focus are accessible", async ({ page }, testInfo) => {
  const runtime = monitorRuntime(page);
  await login(page, teacherEmail);
  await createLecture(page, "Compact Demo Lecture", studentEmail);
  await logout(page);
  await login(page, studentEmail);

  const cards = page.locator("article.student-lecture");
  await expect(cards).toHaveCount(2);
  await page.setViewportSize({ width: 1440, height: 900 });
  const secondHeightBefore = (await cards.nth(1).boundingBox())?.height;
  await cards.nth(0).getByLabel(`Upload session for ${seededLecture}`).setInputFiles(fixturePath);
  await expect(cards.nth(0).getByRole("heading", { name: "Review prediction before submitting" })).toBeVisible();
  const firstBox = await cards.nth(0).boundingBox();
  const secondBox = await cards.nth(1).boundingBox();
  expect(firstBox?.y).toBe(secondBox?.y);
  expect(secondBox?.height).toBe(secondHeightBefore);
  expect(firstBox!.height).toBeGreaterThan(secondBox!.height);

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expectNoPageOverflow(page);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Join Google Meet" }).first()).toBeVisible();
    await expect(cards.nth(0).getByLabel(`Upload session for ${seededLecture}`)).toBeVisible();
    await expect(cards.nth(0).locator("ol")).toBeVisible();
  }

  await logout(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const focused = page.getByLabel("Email");
  for (let attempt = 0; attempt < 6 && !await focused.evaluate((element) => element === document.activeElement); attempt += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(focused).toBeFocused();
  const outline = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).not.toBe("none");
  expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Log in" })).toBeFocused();

  await login(page, teacherEmail);
  const seedRow = page.locator("article.lecture-row").filter({ has: page.getByRole("heading", { name: seededLecture }) });
  await seedRow.getByRole("link", { name: "View results" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".results-table")).toBeVisible();
  await expect(page.getByTestId("mobile-result-cards")).toBeHidden();
  await expectNoPageOverflow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".results-table")).toBeHidden();
  await expect(page.getByTestId("mobile-result-cards")).toBeVisible();
  await expect(page.getByTestId("mobile-result-cards").locator(".submission-badge.submitted")).toBeVisible();
  await expect(page.getByTestId("mobile-result-cards").locator(".submission-badge.pending").first()).toBeVisible();
  await expectNoPageOverflow(page);

  await assertCleanRuntime(runtime, testInfo);
});
