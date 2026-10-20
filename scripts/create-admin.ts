/**
 * Creates (or resets) an administrator account.
 * Usage: npm run admin:create -- admin@example.org "Full Name"
 * Prints a temporary password that must be changed at first login.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { tempPassword } from "../src/lib/crypto";

const db = new PrismaClient();

async function main() {
  const [email, name = "System Admin"] = process.argv.slice(2);
  if (!email || !email.includes("@")) {
    console.error('Usage: npm run admin:create -- admin@example.org "Full Name"');
    process.exit(1);
  }
  const e = email.toLowerCase();
  const password = tempPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.upsert({
    where: { username: e },
    create: { username: e, email: e, name, role: "ADMIN", passwordHash, mustChangePassword: true },
    update: { role: "ADMIN", passwordHash, mustChangePassword: true, isActive: true, failedLogins: 0, lockedUntil: null },
  });
  console.log(`Admin ready: ${e}\nTemporary password: ${password}\n(Change it at first login.)`);
}

main().finally(() => db.$disconnect());
