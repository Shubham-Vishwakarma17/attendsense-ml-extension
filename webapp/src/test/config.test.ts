// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

describe("Firebase configuration", () => {
  it("keeps deployment project selection out of source control", () => {
    expect(readFileSync(resolve(root, ".firebaserc.example"), "utf8")).toContain("your-firebase-project-id");
    expect(() => readFileSync(resolve(root, ".firebaserc"), "utf8")).toThrow();
  });
  it("declares Firestore rules and hosting paths", () => {
    const firebase = JSON.parse(readFileSync(resolve(root, "firebase.json"), "utf8"));
    expect(firebase.firestore.rules).toBe("firestore.rules");
    expect(firebase.hosting.public).toBe("webapp/dist");
  });
  it("uses presentation-ready browser metadata and an SVG favicon", () => {
    const html = readFileSync(resolve(root, "webapp/index.html"), "utf8");
    expect(html).toContain("AttendSense | Participation Analytics");
    expect(html).toContain('rel="icon" type="image/svg+xml" href="/favicon.svg"');
    expect(html).toContain('name="theme-color" content="#3158cc"');
    expect(readFileSync(resolve(root, "webapp/public/favicon.svg"), "utf8")).toContain(">AS<");
  });
  it("leaves the extension manifest permissions unchanged and narrow", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "extension/manifest.json"), "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect([...manifest.permissions].sort()).toEqual(["activeTab", "storage"]);
    expect(manifest.content_scripts[0].matches).toEqual(["https://meet.google.com/*"]);
  });
  it("uses a collection listener for teachers and an exact UID document listener for students", () => {
    const source = readFileSync(resolve(root, "webapp/src/services/firebaseRepository.ts"), "utf8");
    expect(source).toContain('subscribeToLectureSubmissions(lectureId: string');
    expect(source).toContain('onSnapshot(collection(this.db, "lectures", lectureId, "submissions")');
    expect(source).toContain('subscribeToStudentSubmission(lectureId: string, studentUid: string');
    expect(source).toContain('onSnapshot(doc(this.db, "lectures", lectureId, "submissions", studentUid)');
  });
});
