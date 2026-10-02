// PocketBun-only: pins automatic release numbering, changelog preservation, and retry behavior.

import { expect, test } from "bun:test";
import { planGitHubRelease } from "./prepare_github_release.ts";

const changelog =
  "# Changelog\n\n## Unreleased\n\n- New public API.\n\n## 0.40.4-pocketbun.0 - 2026-09-13\n\n- Previous release.\n";

test("increments only the PocketBun revision and preserves released notes", () => {
  const result = planGitHubRelease("0.40.4-pocketbun.0", "v0.40.4", changelog, [], "2026-10-03");
  expect(result.tag).toBe("v0.40.4-pocketbun.1");
  expect(result.changed).toBe(true);
  expect(result.changelog).toContain("## Unreleased\n\n## 0.40.4-pocketbun.1 - 2026-10-03\n\n- New public API.");
  expect(result.changelog.endsWith(changelog.slice(changelog.indexOf("## 0.40.4-pocketbun.0")))).toBe(true);
});

test("skips existing matching revisions and ignores other versions", () => {
  const result = planGitHubRelease(
    "0.40.4-pocketbun.0",
    "v0.40.4",
    changelog,
    ["v0.40.4-pocketbun.1", "v0.40.4-pocketbun.3", "v0.40.5", "v0.40.5-pocketbun.99"],
    "2026-10-03",
  );
  expect(result.tag).toBe("v0.40.4-pocketbun.4");
});

test("retries the same tagged release when Unreleased is empty", () => {
  const first = planGitHubRelease("0.40.4-pocketbun.0", "v0.40.4", changelog, [], "2026-10-03");
  const retry = planGitHubRelease(first.version, "v0.40.4", first.changelog, [first.tag], "2026-10-04");
  expect(retry.changed).toBe(false);
  expect(retry.tag).toBe(first.tag);
  expect(retry.changelog).toBe(first.changelog);
});

test("rejects empty or unfinished notes and upstream mismatches", () => {
  expect(() => planGitHubRelease("0.40.4-pocketbun.0", "v0.40.4", "# Changelog\n\n## Unreleased\n", [], "2026-10-03")).toThrow(
    "release notes",
  );
  expect(() =>
    planGitHubRelease("0.40.4-pocketbun.0", "v0.40.4", changelog.replace("New public API.", "TBD"), [], "2026-10-03"),
  ).toThrow("TBD");
  expect(() => planGitHubRelease("0.40.5-pocketbun.0", "v0.40.4", changelog, [], "2026-10-03")).toThrow("match");
  expect(() => planGitHubRelease("0.40.5", "v0.40.5", changelog, [], "2026-10-03")).toThrow("match");
});
