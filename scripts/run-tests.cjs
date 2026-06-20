const { spawnSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const path = require("node:path");

const srcDir = path.resolve(__dirname, "..", "src");
const testFiles = readdirSync(srcDir)
  .filter((fileName) => fileName.endsWith(".test.ts"))
  .sort()
  .map((fileName) => path.join(srcDir, fileName));

if (testFiles.length === 0) {
  console.error("No test files found in src/.");
  process.exit(1);
}

const tsxCliPath = require.resolve("tsx/cli");
const result = spawnSync(
  process.execPath,
  [tsxCliPath, "--test", ...testFiles],
  {
    stdio: "inherit",
    shell: false,
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
