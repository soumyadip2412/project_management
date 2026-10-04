/**
 * Zero-dependency syntax gate for the backend.
 *
 * The backend has no build step, so a parse error in a rarely-imported module
 * stays invisible until the first request that touches it. This parses every
 * .js file under src/ and tests/ with `node --check` and fails on the first
 * error, which is cheap enough to run in CI on every push.
 *
 * This is NOT a linter. Prettier is installed but the codebase is not formatted
 * to it (57 files differ), so gating on `prettier --check` would mean a
 * repo-wide reformat. Introducing ESLint is a separate, deliberate decision.
 */
import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOTS = ["src", "tests"];
const SKIP = new Set(["node_modules", ".git", "logs", "public"]);

async function collect(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out; // directory absent — nothing to check
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await collect(full, out);
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

const files = (await Promise.all(ROOTS.map((r) => collect(r)))).flat();

if (files.length === 0) {
  console.error("syntax-check: no files found — check the ROOTS list.");
  process.exit(1);
}

const failures = [];
await Promise.all(
  files.map(async (file) => {
    try {
      await run(process.execPath, ["--check", file]);
    } catch (err) {
      failures.push({ file, message: err.stderr?.trim() || err.message });
    }
  })
);

if (failures.length > 0) {
  for (const { file, message } of failures) {
    console.error(`\n✖ ${relative(process.cwd(), file)}\n${message}`);
  }
  console.error(`\nsyntax-check: ${failures.length} of ${files.length} file(s) failed to parse.`);
  process.exit(1);
}

console.log(`syntax-check: ${files.length} file(s) parsed cleanly.`);
