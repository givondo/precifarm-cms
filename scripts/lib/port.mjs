import { execSync } from "node:child_process";

export function stopPortWindows(port) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const pids = out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line));
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`Stopped process ${pid} on port ${port}.`);
      } catch {
        // Process may already have exited.
      }
    }
  } catch {
    // No listeners on port.
  }
}

export function stopPort(port) {
  if (process.platform === "win32") {
    stopPortWindows(port);
    return;
  }
  try {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "ignore" });
  } catch {
    // No process to kill.
  }
}
