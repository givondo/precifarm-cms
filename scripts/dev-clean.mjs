import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopPort } from "./lib/port.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = 3002;

console.log("Stopping any dev server on port 3002...");
stopPort(PORT);

const nextDir = path.join(root, ".next");

function removeNextCache() {
  if (!fs.existsSync(nextDir)) return;

  if (process.platform === "win32") {
    const literalPath = nextDir.replace(/'/g, "''");
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        execSync('powershell -NoProfile -Command "Start-Sleep -Milliseconds 800"', {
          stdio: "ignore",
        });
        execSync(
          `powershell -NoProfile -Command "Remove-Item -LiteralPath '${literalPath}' -Recurse -Force -ErrorAction Stop"`,
          { stdio: "ignore" }
        );
        console.log("Removed .next cache.");
        return;
      } catch {
        if (attempt === 3) {
          console.warn("Could not fully remove .next cache; starting dev server anyway.");
        }
      }
    }
    return;
  }

  try {
    fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    console.log("Removed .next cache.");
  } catch {
    console.warn("Could not fully remove .next cache; starting dev server anyway.");
  }
}

removeNextCache();

console.log(`Starting dev server on http://localhost:${PORT} ...`);
const child = spawn("npx", ["next", "dev", "--port", String(PORT), "--turbopack"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
