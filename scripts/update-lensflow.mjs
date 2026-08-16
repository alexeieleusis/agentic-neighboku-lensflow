#!/usr/bin/env node
// Updates the eslint-plugin-lensflow git dependency to the latest commit on
// lens-flow's main branch. See docs/CONVENTIONS.md ("Updating
// eslint-plugin-lensflow") for the failure modes this works around.
//
// Usage: node scripts/update-lensflow.mjs [--dry-run]
//   LENS_FLOW_CLONE_PATH env var overrides the local clone path
//   (default: ~/development/lens-flow).

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "alexeieleusis/lens-flow";
const REPO_SSH_REMOTE = `git@github.com:${REPO}.git`;
const PATH_FRAGMENT = "path:/eslint-lensflow-plugin";
const PACKAGE_NAME = "eslint-plugin-lensflow";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

function readText(path) {
  return readFileSync(path, "utf8");
}

function writeText(path, content) {
  if (dryRun) {
    console.log(`[dry-run] would write ${path}`);
    return;
  }
  writeFileSync(path, content);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return result;
}

function fail(message) {
  console.error(`\nupdate-lensflow: ${message}`);
  process.exit(1);
}

// --- 1. Resolve the target commit from the local lens-flow clone ---

const clonePath = process.env.LENS_FLOW_CLONE_PATH ?? join(homedir(), "development", "lens-flow");
if (!existsSync(clonePath)) {
  fail(
    `expected a lens-flow clone at ${clonePath}. Clone it or set LENS_FLOW_CLONE_PATH.`,
  );
}

const remoteUrl = execFileSync("git", ["remote", "get-url", "origin"], {
  cwd: clonePath,
  encoding: "utf8",
}).trim();
if (remoteUrl !== REPO_SSH_REMOTE && !remoteUrl.endsWith(`${REPO}.git`)) {
  fail(
    `${clonePath}'s origin (${remoteUrl}) is not ${REPO} — refusing to trust it for a commit SHA.`,
  );
}

console.log(`Fetching origin in ${clonePath}...`);
execFileSync("git", ["fetch", "origin"], { cwd: clonePath, stdio: "inherit" });

const newSha = execFileSync("git", ["rev-parse", "origin/main"], {
  cwd: clonePath,
  encoding: "utf8",
}).trim();

// --- 2. Compare against what's currently pinned ---

const packageJsonPath = join(repoRoot, "package.json");
const workspaceYamlPath = join(repoRoot, "pnpm-workspace.yaml");
const lockYamlPath = join(repoRoot, "pnpm-lock.yaml");

let packageJson = readText(packageJsonPath);
const depLineRe = new RegExp(
  `("${PACKAGE_NAME}":\\s*"github:${REPO}#)([0-9a-f]{40})(&${PATH_FRAGMENT}")`,
);
const depMatch = packageJson.match(depLineRe);
if (!depMatch) {
  fail(`could not find the ${PACKAGE_NAME} git dependency line in package.json.`);
}
const oldSha = depMatch[2];

if (oldSha === newSha) {
  console.log(`Already up to date: ${PACKAGE_NAME} is pinned to ${newSha}.`);
  process.exit(0);
}

console.log(`Updating ${PACKAGE_NAME}: ${oldSha} -> ${newSha}`);

// --- 3. Independently compute the tarball's real integrity ---
// Worked around here: pnpm's own integrity refresh (`pnpm install
// --update-checksums`) has repeatedly failed to correct a stale
// `resolution.integrity` for this gitHosted tarball dependency, retrying and
// failing identically even after `pnpm store prune`. Downloading straight
// from codeload.github.com (the same host pnpm fetches from) and hashing it
// ourselves sidesteps that bug. See docs/CONVENTIONS.md for the full story.

const tarballUrl = `https://codeload.github.com/${REPO}/tar.gz/${newSha}`;
console.log(`Downloading ${tarballUrl} to compute its integrity...`);
const tarballResponse = await fetch(tarballUrl);
if (!tarballResponse.ok) {
  fail(`GET ${tarballUrl} returned ${tarballResponse.status}.`);
}
const tarballBuffer = Buffer.from(await tarballResponse.arrayBuffer());
const computedIntegrity = `sha512-${createHash("sha512").update(tarballBuffer).digest("base64")}`;

// --- 4. Edit package.json and pnpm-workspace.yaml ---

packageJson = packageJson.replace(depLineRe, `$1${newSha}$3`);
writeText(packageJsonPath, packageJson);

let workspaceYaml = readText(workspaceYamlPath);
const allowBuildsRe = new RegExp(
  `("${PACKAGE_NAME}@https://codeload\\.github\\.com/${REPO}/tar\\.gz/)${oldSha}(#${PATH_FRAGMENT}":\\s*true)`,
);
if (!allowBuildsRe.test(workspaceYaml)) {
  fail(`could not find the ${PACKAGE_NAME} allowBuilds line in pnpm-workspace.yaml.`);
}
workspaceYaml = workspaceYaml.replace(allowBuildsRe, `$1${newSha}$2`);
writeText(workspaceYamlPath, workspaceYaml);

if (dryRun) {
  console.log("[dry-run] stopping before pnpm install.");
  process.exit(0);
}

// --- 5. Let pnpm resolve everything else, then make sure the lockfile ends up
// with a correct, present integrity for this entry no matter which path pnpm
// took to get there ---

function pnpmInstall() {
  return run("pnpm", ["install"], { cwd: repoRoot });
}

const resolutionPrefix = `resolution: \\{gitHosted: true, `;
const resolutionSuffix = `path: /eslint-lensflow-plugin, tarball: https://codeload\\.github\\.com/${REPO}/tar\\.gz/${newSha}\\}`;
const withIntegrityRe = new RegExp(`(${resolutionPrefix}integrity: )sha512-[A-Za-z0-9+/=]+(, ${resolutionSuffix})`);
const withoutIntegrityRe = new RegExp(`(${resolutionPrefix})(${resolutionSuffix})`);

// Returns true if it changed the lockfile, false if it was already correct.
function ensureLockfileIntegrity() {
  const lock = readText(lockYamlPath);
  if (withIntegrityRe.test(lock)) {
    if (lock.match(withIntegrityRe)[0].includes(computedIntegrity)) {
      return false;
    }
    writeText(lockYamlPath, lock.replace(withIntegrityRe, `$1${computedIntegrity}$2`));
    return true;
  }
  if (withoutIntegrityRe.test(lock)) {
    writeText(lockYamlPath, lock.replace(withoutIntegrityRe, `$1integrity: ${computedIntegrity}, $2`));
    return true;
  }
  fail(`could not find the ${PACKAGE_NAME}@${newSha} resolution entry in pnpm-lock.yaml.`);
}

let result = pnpmInstall();
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.status !== 0) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const isIntegrityFailure =
    output.includes("ERR_PNPM_TARBALL_INTEGRITY") && output.includes(tarballUrl);
  if (!isIntegrityFailure) {
    fail("pnpm install failed for a reason other than the known tarball-integrity bug (see output above).");
  }

  const gotMatch = output.match(/Got "sha512-([A-Za-z0-9+/=]+)"/);
  if (gotMatch && `sha512-${gotMatch[1]}` !== computedIntegrity) {
    fail(
      "pnpm's reported checksum doesn't match what we independently downloaded and hashed. " +
        "This is not the known stale-lockfile bug — treat it as a possible supply-chain issue " +
        "and investigate before proceeding.",
    );
  }

  console.log(
    "\nHit the known stale-integrity bug — patching pnpm-lock.yaml with the independently verified checksum and retrying.",
  );
  ensureLockfileIntegrity();

  result = pnpmInstall();
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) {
    fail("pnpm install still failed after patching the lockfile integrity (see output above).");
  }
} else if (ensureLockfileIntegrity()) {
  // pnpm resolved from an already-warm local store without writing (or with a
  // stale) integrity for this entry. Re-run so the lockfile we commit is the
  // one pnpm itself has validated against our independently computed checksum.
  console.log("\nFilled in a missing/stale lockfile checksum — re-running pnpm install to confirm it.");
  result = pnpmInstall();
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) {
    fail("pnpm install failed after filling in the lockfile checksum (see output above).");
  }
}

// --- 6. Clean up any stray old-SHA allowBuilds line pnpm may have added ---

const lockText = readText(lockYamlPath);
if (!lockText.includes(oldSha)) {
  const staleKeyRe = new RegExp(
    `\\n\\s*"${PACKAGE_NAME}@https://codeload\\.github\\.com/${REPO}/tar\\.gz/${oldSha}#${PATH_FRAGMENT}":.*`,
  );
  let workspace = readText(workspaceYamlPath);
  if (staleKeyRe.test(workspace)) {
    workspace = workspace.replace(staleKeyRe, "");
    writeText(workspaceYamlPath, workspace);
    console.log("Removed a stray allowBuilds line left over from the old commit.");
  }
}

console.log(`\n${PACKAGE_NAME} updated to ${newSha}.`);
