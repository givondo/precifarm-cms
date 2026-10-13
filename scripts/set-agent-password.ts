/**
 * Sets (or rotates) a CMS agent password as a scrypt hash in the runtime store.
 * The password is read from the environment so it never appears in shell history.
 *
 * Usage:
 *   AGENT_EMAIL=admin@precifarm.com NEW_AGENT_PASSWORD='...' DATABASE_URL=... \
 *     npx tsx scripts/set-agent-password.ts
 */
import { mutateStore } from "../src/db";
import { hashPassword } from "../src/lib/security/password";

async function main() {
  const email = process.env.AGENT_EMAIL?.trim().toLowerCase();
  const password = process.env.NEW_AGENT_PASSWORD ?? "";
  if (!email) throw new Error("AGENT_EMAIL is required.");
  if (password.length < 12) throw new Error("NEW_AGENT_PASSWORD must be at least 12 characters.");

  const hash = hashPassword(password);
  let found = false;
  await mutateStore((store) => {
    const agent = store.agents.find((a) => a.email.trim().toLowerCase() === email);
    if (agent) {
      agent.password = hash;
      found = true;
    }
  });
  if (!found) throw new Error(`No agent found with email ${email}.`);
  console.log(`Password updated for ${email}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
