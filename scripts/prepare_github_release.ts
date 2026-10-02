// PocketBun-only: prepares version metadata for an automatically tagged GitHub release.

export function planGitHubRelease(
  version: string,
  upstreamTag: string,
  changelog: string,
  tags: string[],
  date: string,
): { version: string; tag: string; changelog: string; changed: boolean } {
  const match = version.match(/^([0-9]+\.[0-9]+\.[0-9]+)-pocketbun\.([0-9]+)$/);
  if (!match || `v${match[1]}` !== upstreamTag) {
    throw new Error("Package version must use X.Y.Z-pocketbun.N and match pocketbase_tag.txt.");
  }
  const currentTag = `v${version}`;
  const heading = /^## Unreleased[ \t]*\r?\n/m.exec(changelog);
  const notesStart = heading ? heading.index + heading[0].length : 0;
  const nextHeading = heading ? /^## /m.exec(changelog.slice(notesStart)) : null;
  const notes = heading ? changelog.slice(notesStart, nextHeading ? notesStart + nextHeading.index : undefined).trim() : "";
  if (!notes) {
    // A retry after the version commit/tag was pushed should finish publishing
    // the same release instead of incrementing its revision again.
    if (tags.includes(currentTag) && changelog.includes(`## ${version} - `)) {
      return { version, tag: currentTag, changelog, changed: false };
    }
    throw new Error("Add release notes under ## Unreleased before generating a new release.");
  }
  if (/\bTBD\b/.test(notes)) {
    throw new Error("Replace TBD with release notes before generating a release.");
  }
  let revision = Number(match[2]);
  for (const tag of tags) {
    const prefix = `v${match[1]}-pocketbun.`;
    if (tag.startsWith(prefix) && /^[0-9]+$/.test(tag.slice(prefix.length))) {
      revision = Math.max(revision, Number(tag.slice(prefix.length)));
    }
  }
  if (!Number.isSafeInteger(revision + 1)) throw new Error("Invalid PocketBun revision.");
  const nextVersion = `${match[1]}-pocketbun.${revision + 1}`;
  const updated = changelog.replace(/^## Unreleased[ \t]*\r?\n/m, `## Unreleased\n\n## ${nextVersion} - ${date}\n`);
  return { version: nextVersion, tag: `v${nextVersion}`, changelog: updated, changed: true };
}

if (import.meta.main) {
  const packageJson = (await Bun.file("package.json").json()) as { version: string };
  const tagResult = Bun.spawnSync(["git", "tag", "--list"]);
  if (tagResult.exitCode !== 0) throw new Error("Unable to list existing release tags.");
  const tags = new TextDecoder().decode(tagResult.stdout).trim().split("\n").filter(Boolean);
  const release = planGitHubRelease(
    packageJson.version,
    (await Bun.file("pocketbase_tag.txt").text()).trim(),
    await Bun.file("CHANGELOG.md").text(),
    tags,
    new Date().toISOString().slice(0, 10),
  );
  if (release.changed) {
    packageJson.version = release.version;
    await Bun.write("package.json", JSON.stringify(packageJson, null, 2) + "\n");
    await Bun.write("CHANGELOG.md", release.changelog);
  }
  console.log(release.tag);
}
