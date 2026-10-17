import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "extension/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.host_permissions, ["https://meet.google.com/*"]);
assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "storage"]);
assert.deepEqual(manifest.content_scripts.flatMap((script) => script.matches), ["https://meet.google.com/*"]);
const forbiddenPermissions = ["camera", "microphone", "history", "tabs", "webNavigation"];
assert.equal(manifest.permissions.some((permission) => forbiddenPermissions.includes(permission)), false);

const referencedFiles = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...manifest.content_scripts.flatMap((script) => script.js),
  "popup/popup.css",
  "popup/popup.js",
  "lib/session.js"
];

await Promise.all(referencedFiles.map((file) => access(resolve(root, "extension", file))));
console.log(`Manifest valid; verified ${referencedFiles.length} referenced files and minimum permissions.`);
