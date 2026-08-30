// Seeds a fixed local-dev teacher account. Schema changes here have been
// getting resolved by wiping .wrangler's local D1 state and reapplying
// migrations from scratch, which also wipes whatever account you'd created
// to test with. Running this after every `db:migrate:local` (see
// package.json -- it's chained automatically) means there's always a known
// login waiting rather than needing to re-signup by hand each time.
//
// Local dev only: always targets `--local`, and the fixed password below
// isn't a secret worth protecting. Idempotent -- the row has a fixed id, so
// rerunning just refreshes the password hash instead of erroring or
// duplicating.

import { execFileSync } from "node:child_process";
import { hashPassword } from "../src/lib/password.ts";

const SEED_USER_ID = "00000000-0000-0000-0000-000000000001";
const SEED_EMAIL = "teacher@tktk.test";
const SEED_PASSWORD = "password123";
const SEED_NAME = "Test Teacher";

async function main() {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const sql = `INSERT INTO users (id, password_hash, email, name, role)
VALUES ('${SEED_USER_ID}', '${passwordHash}', '${SEED_EMAIL}', '${SEED_NAME}', 'teacher')
ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash;`;

  execFileSync("npx", ["wrangler", "d1", "execute", "DB", "--local", "--command", sql], {
    stdio: "inherit",
  });

  console.log(`\nSeeded local dev account:\n  email:    ${SEED_EMAIL}\n  password: ${SEED_PASSWORD}\n`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
