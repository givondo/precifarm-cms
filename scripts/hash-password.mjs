// Make the CMS_ADMIN_PASSWORD_HASH value for the hosted CMS (same format as the Command Centre).
//   node scripts/hash-password.mjs            (asks for the password, input hidden)
//   echo password | node scripts/hash-password.mjs --stdin
// Prints scrypt$N$r$p$salt$hash. Store it in Secret Manager; never commit it.
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

const N = 16384, r = 8, p = 1;

function hash(pw) {
  const salt = randomBytes(16);
  const h = scryptSync(pw.normalize("NFKC"), salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${h.toString("base64")}`;
}

function check(pw) {
  if (pw.length < 12) {
    console.error("Use at least 12 characters.");
    process.exit(1);
  }
  return pw;
}

async function readHidden(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  // Hide what is typed, but still show the prompts themselves.
  rl._writeToOutput = (s) => { if (s.includes(prompt) || s.includes("Again: ")) rl.output.write(s); };
  const a = await new Promise((res) => rl.question(prompt, res));
  rl.output.write("\n");
  const b = await new Promise((res) => rl.question("Again: ", res));
  rl.output.write("\n");
  rl.close();
  if (a !== b) {
    console.error("The two entries differ.");
    process.exit(1);
  }
  return a;
}

if (process.argv.includes("--stdin")) {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  console.log(hash(check(data.replace(/\r?\n$/, ""))));
} else {
  console.log(hash(check(await readHidden("CMS admin password: "))));
}
