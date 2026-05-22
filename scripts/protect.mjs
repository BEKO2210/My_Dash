#!/usr/bin/env node
// Toggle the appearance/config protection used by scripts/protect-guard.mjs.
//
//   npm run protect          # protection ON  (Claude can't change protected files)
//   npm run unprotect        # protection OFF (asks for PIN; or pass it: ... 0000)
//
// PIN defaults to 0000, override with MC_PIN. This is a local speed-bump against
// accidental changes — not real security.

import { existsSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const PIN = (process.env.MC_PIN || "0000").trim();
const lockFile = path.join(process.cwd(), ".mc-protect");
const mode = process.argv[2];

function lock() {
  writeFileSync(lockFile, `protected ${new Date().toISOString()}\n`);
  console.log("🔒 Schutz AKTIV — geschützte Aussehen/Config-Dateien sind für Claude gesperrt.");
  console.log("   Ausschalten:  npm run unprotect");
}

function unlock(pin) {
  if (pin.trim() !== PIN) {
    console.error("✗ Falscher PIN.");
    process.exit(1);
  }
  if (existsSync(lockFile)) rmSync(lockFile);
  console.log("🔓 Schutz AUS — Änderungen sind wieder erlaubt.");
}

if (mode === "lock") {
  lock();
} else if (mode === "unlock") {
  const provided = process.argv[3];
  if (provided !== undefined) {
    unlock(provided);
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("PIN: ", (answer) => {
      rl.close();
      unlock(answer);
    });
  }
} else {
  console.log("Nutzung: npm run protect  |  npm run unprotect");
  process.exit(1);
}
