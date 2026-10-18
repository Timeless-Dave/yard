// Grants (or revokes) moderator access via a Firebase Auth custom claim.
// Moderators see the 🛡️ Moderation queue in their account menu.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json npm run set-admin -- someone@example.com
//   GOOGLE_APPLICATION_CREDENTIALS=... npm run set-admin -- someone@example.com --revoke
//
// The person must sign out and back in (or wait up to an hour) for it to apply.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [who, flag] = process.argv.slice(2);
if (!who) {
  console.error("Usage: npm run set-admin -- <email-or-uid> [--revoke]");
  process.exit(1);
}

initializeApp();
const auth = getAuth();
const user = who.includes("@") ? await auth.getUserByEmail(who) : await auth.getUser(who);
const admin = flag !== "--revoke";
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin });
console.log(`${admin ? "Granted" : "Revoked"} moderator access for ${user.email || user.uid}.`);
