// Firestore security rules, tested against the real rules engine in the
// Firestore emulator. Run via `npm run test:emulator`.
import { readFileSync } from "node:fs";
import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-yard-rules",
    // RULES_FILE lets mutation checks swap in a deliberately broken copy.
    firestore: { rules: readFileSync(process.env.RULES_FILE || "firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(() => env?.cleanup());

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
const as = (uid, claims) => env.authenticatedContext(uid, claims).firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    for (const [uid, name] of [
      ["alice", "Alice"],
      ["bob", "Bob"],
      ["mod", "Mod"],
    ]) {
      await setDoc(doc(db, "users", uid), { display_name: name, color: "#f4b223", created_at: Timestamp.now() });
    }
    await setDoc(doc(db, "storeItems", "gold-trim-fit"), { name: "Gold Trim Fit", kind: "cosmetic", meta: { color: "#ffd84d" }, active: true });
  });
});

// A public post, written the only way rules accept: same batch as a
// rateLimits bump.
function post(db, uid, path, data) {
  const batch = writeBatch(db);
  batch.set(doc(db, ...path), { ...data, createdAt: serverTimestamp(), hidden: false, reportCount: 0 });
  batch.set(doc(db, "rateLimits", uid), { lastPostAt: serverTimestamp() });
  return batch.commit();
}
const chat = (db, uid, name, msg = "hey yard", id = "m1") => post(db, uid, ["chatMessages", id], { userId: uid, name, msg });

describe("coin economy is client-unwritable", () => {
  it.each([
    ["wallets", "alice", { balance: 999999, lifetimeEarned: 999999 }],
    ["earnLog", "alice", { day: "2026-01-01", earnedToday: 0 }],
    ["purchases", "p1", { userId: "alice", itemId: "gold-trim-fit", provider: "coins" }],
  ])("denies writing %s", async (col, id, data) => {
    await assertFails(setDoc(doc(as("alice"), col, id), data));
  });

  it("denies granting yourself inventory or transaction history", async () => {
    await assertFails(setDoc(doc(as("alice"), "inventory", "alice", "items", "gold-trim-fit"), { acquiredAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as("alice"), "walletTransactions", "alice", "entries", "e1"), { delta: 500 }));
  });

  it("lets anyone read wallets (leaderboard) but only you read your own inventory", async () => {
    await seed((db) => setDoc(doc(db, "inventory", "alice", "items", "gold-trim-fit"), { acquiredAt: Timestamp.now() }));
    await assertSucceeds(getDoc(doc(as("bob"), "wallets", "alice")));
    await assertSucceeds(getDoc(doc(as("alice"), "inventory", "alice", "items", "gold-trim-fit")));
    await assertFails(getDoc(doc(as("bob"), "inventory", "alice", "items", "gold-trim-fit")));
  });
});

describe("profiles", () => {
  it("can't create or edit someone else's profile", async () => {
    await assertFails(setDoc(doc(as("bob"), "users", "alice"), { display_name: "Gotcha", color: "#f4b223", created_at: serverTimestamp() }));
    await assertFails(updateDoc(doc(as("bob"), "users", "alice"), { display_name: "Gotcha" }));
  });

  it("rejects over-length names", async () => {
    await assertFails(updateDoc(doc(as("alice"), "users", "alice"), { display_name: "x".repeat(25) }));
    await assertSucceeds(updateDoc(doc(as("alice"), "users", "alice"), { display_name: "Alice B" }));
  });

  it("can't wear a paid cosmetic color you don't own", async () => {
    await assertFails(updateDoc(doc(as("alice"), "users", "alice"), { color: "#ffd84d", equippedItem: "gold-trim-fit" }));
    await assertFails(updateDoc(doc(as("alice"), "users", "alice"), { color: "#ffd84d" }));
  });

  it("can wear a cosmetic you own, only in that item's color", async () => {
    await seed((db) => setDoc(doc(db, "inventory", "alice", "items", "gold-trim-fit"), { acquiredAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(as("alice"), "users", "alice"), { color: "#000000", equippedItem: "gold-trim-fit" }));
    await assertSucceeds(updateDoc(doc(as("alice"), "users", "alice"), { color: "#ffd84d", equippedItem: "gold-trim-fit" }));
  });
});

describe("public chat", () => {
  it("accepts a normal post", async () => {
    await assertSucceeds(chat(as("alice"), "alice", "Alice"));
  });

  it("rejects a post that skips the rate limiter", async () => {
    const db = as("alice");
    await assertFails(
      setDoc(doc(db, "chatMessages", "m1"), { userId: "alice", name: "Alice", msg: "hi", createdAt: serverTimestamp(), hidden: false, reportCount: 0 })
    );
  });

  it("rate-limits: a second post within 3 seconds is rejected", async () => {
    const db = as("alice");
    await assertSucceeds(chat(db, "alice", "Alice", "one", "m1"));
    await assertFails(chat(db, "alice", "Alice", "two", "m2"));
  });

  it("rejects impersonation — name must match your own profile", async () => {
    await assertFails(chat(as("alice"), "alice", "Bob"));
    await assertFails(chat(as("alice"), "bob", "Bob"));
  });

  it("rejects pre-hidden, pre-reported, or oversized posts", async () => {
    const db = as("alice");
    const batch = writeBatch(db);
    batch.set(doc(db, "chatMessages", "m1"), { userId: "alice", name: "Alice", msg: "hi", createdAt: serverTimestamp(), hidden: true, reportCount: 0 });
    batch.set(doc(db, "rateLimits", "alice"), { lastPostAt: serverTimestamp() });
    await assertFails(batch.commit());
    await assertFails(chat(as("alice"), "alice", "Alice", "x".repeat(201)));
  });

  it("blocks banned players and signed-out visitors", async () => {
    await seed((db) => setDoc(doc(db, "bannedUsers", "alice"), { bannedAt: Timestamp.now() }));
    await assertFails(chat(as("alice"), "alice", "Alice"));
    await assertFails(chat(env.unauthenticatedContext().firestore(), "anon", "Anon"));
  });

  it("posts are immutable to clients", async () => {
    await chat(as("alice"), "alice", "Alice");
    await assertFails(updateDoc(doc(as("alice"), "chatMessages", "m1"), { msg: "edited" }));
    await assertFails(deleteDoc(doc(as("bob"), "chatMessages", "m1")));
  });

  it("hidden posts are unreadable except by moderators", async () => {
    await seed((db) =>
      setDoc(doc(db, "chatMessages", "bad"), { userId: "bob", name: "Bob", msg: "x", createdAt: Timestamp.now(), hidden: true, reportCount: 3 })
    );
    await assertFails(getDoc(doc(as("alice"), "chatMessages", "bad")));
    await assertSucceeds(getDoc(doc(as("mod", { admin: true }), "chatMessages", "bad")));
    await assertSucceeds(getDocs(query(collection(as("alice"), "chatMessages"), where("hidden", "==", false))));
    await assertFails(getDocs(collection(as("alice"), "chatMessages")));
  });
});

describe("reports", () => {
  beforeEach(() =>
    seed((db) => setDoc(doc(db, "chatMessages", "m1"), { userId: "bob", name: "Bob", msg: "x", createdAt: Timestamp.now(), hidden: false, reportCount: 0 }))
  );
  const report = (db, reporter, id = `chatMessages_m1_${reporter}`, extra = {}) =>
    setDoc(doc(db, "reports", id), {
      targetCollection: "chatMessages",
      targetId: "m1",
      reporterId: reporter,
      reason: "harassment",
      createdAt: serverTimestamp(),
      ...extra,
    });

  it("one report per player per item", async () => {
    await assertSucceeds(report(as("alice"), "alice"));
    await assertFails(report(as("alice"), "alice")); // second write is an update
  });

  it("can't file reports as someone else or with a forged id", async () => {
    await assertFails(report(as("alice"), "bob", "chatMessages_m1_bob"));
    await assertFails(report(as("alice"), "alice", "chatMessages_m1_somebody"));
  });

  it("can't report things that don't exist or aren't reportable", async () => {
    await assertFails(setDoc(doc(as("alice"), "reports", "chatMessages_nope_alice"), {
      targetCollection: "chatMessages", targetId: "nope", reporterId: "alice", reason: "spam", createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(as("alice"), "reports", "wallets_bob_alice"), {
      targetCollection: "wallets", targetId: "bob", reporterId: "alice", reason: "spam", createdAt: serverTimestamp(),
    }));
  });

  it("only moderators can read reports", async () => {
    await report(as("alice"), "alice");
    await assertFails(getDoc(doc(as("bob"), "reports", "chatMessages_m1_alice")));
    await assertSucceeds(getDoc(doc(as("mod", { admin: true }), "reports", "chatMessages_m1_alice")));
  });
});

describe("Homecoming voting", () => {
  beforeEach(() =>
    seed(async (db) => {
      const base = { nominatedBy: "bob", voteCount: 0, createdAt: Timestamp.now(), reportCount: 0 };
      await setDoc(doc(db, "candidates", "k1"), { ...base, category: "king", name: "Marcus", hidden: false });
      await setDoc(doc(db, "candidates", "k2"), { ...base, category: "king", name: "Hidden", hidden: true });
      await setDoc(doc(db, "candidates", "q1"), { ...base, category: "queen", name: "Kiana", hidden: false });
    })
  );
  const vote = (db, id, category, candidateId, userId = id.split("_")[0]) =>
    setDoc(doc(db, "votes", id), { userId, category, candidateId, createdAt: serverTimestamp() });

  it("one ballot per category, changeable", async () => {
    await assertSucceeds(vote(as("alice"), "alice_king", "king", "k1"));
    await assertSucceeds(vote(as("alice"), "alice_queen", "queen", "q1"));
  });

  it("can't vote as someone else", async () => {
    await assertFails(vote(as("alice"), "bob_king", "king", "k1"));
    await assertFails(vote(as("alice"), "alice_king", "king", "k1", "bob"));
  });

  it("can't cast a king vote for a queen nominee, or vote for hidden nominees", async () => {
    await assertFails(vote(as("alice"), "alice_king", "king", "q1"));
    await assertFails(vote(as("alice"), "alice_king", "king", "k2"));
  });

  it("ballots are private", async () => {
    await vote(as("alice"), "alice_king", "king", "k1");
    await assertSucceeds(getDoc(doc(as("alice"), "votes", "alice_king")));
    await assertFails(getDoc(doc(as("bob"), "votes", "alice_king")));
  });

  it("can't nominate with a pre-loaded vote count", async () => {
    await assertFails(
      post(as("alice"), "alice", ["candidates", "n1"], { category: "king", name: "Me", nominatedBy: "alice", voteCount: 500 })
    );
    await assertSucceeds(post(as("alice"), "alice", ["candidates", "n1"], { category: "king", name: "Me", nominatedBy: "alice", voteCount: 0 }));
  });
});

describe("plots, orgs, and Probate Night", () => {
  const claim = (db, uid, name, letters = "ΑΦΑ") =>
    setDoc(doc(db, "plotClaims", letters), { userId: uid, displayName: name, claimedAt: serverTimestamp() });

  it("first claim wins; nobody can take or release someone else's plot", async () => {
    await assertSucceeds(claim(as("alice"), "alice", "Alice"));
    await assertFails(claim(as("bob"), "bob", "Bob"));
    await assertFails(deleteDoc(doc(as("bob"), "plotClaims", "ΑΦΑ")));
    await assertSucceeds(deleteDoc(doc(as("alice"), "plotClaims", "ΑΦΑ")));
  });

  it("only the five real plot houses can be claimed", async () => {
    await assertFails(claim(as("alice"), "alice", "Alice", "FAKE"));
  });

  it("one org per player; Probate Night is members-only", async () => {
    const db = as("alice");
    const join = (letters) => setDoc(doc(db, "orgMembers", "alice"), { letters, displayName: "Alice", joinedAt: serverTimestamp() });
    const signup = (letters) =>
      setDoc(doc(db, "probateSignups", `${letters}_alice`), { userId: "alice", letters, displayName: "Alice", createdAt: serverTimestamp() });

    await assertFails(signup("ΑΦΑ"));
    await assertSucceeds(join("ΑΦΑ"));
    await assertFails(join("ΔΣΘ"));
    await assertFails(signup("ΔΣΘ"));
    await assertSucceeds(signup("ΑΦΑ"));
  });
});

describe("parties", () => {
  const host = (db, overrides = {}) => {
    const start = Date.now() + 60_000;
    return post(db, "alice", ["parties", "p1"], {
      hostId: "alice",
      hostName: "Alice",
      title: "Friday Kickback",
      vibe: "kickback",
      spot: "bell_tower_yard",
      startsAt: Timestamp.fromMillis(start),
      endsAt: Timestamp.fromMillis(start + 3 * 3600_000),
      rsvpCount: 0,
      ...overrides,
    });
  };

  it("accepts a normal party", async () => {
    await assertSucceeds(host(as("alice")));
  });

  it.each([
    ["a title over 40 characters", { title: "x".repeat(41) }],
    ["a fake RSVP count", { rsvpCount: 200 }],
    ["an unknown vibe", { vibe: "rave" }],
    ["a party longer than 4 hours", { endsAt: Timestamp.fromMillis(Date.now() + 6 * 3600_000) }],
    ["a party a month out", { startsAt: Timestamp.fromMillis(Date.now() + 30 * 86400_000), endsAt: Timestamp.fromMillis(Date.now() + 30 * 86400_000 + 3600_000) }],
    ["hosting as someone else", { hostId: "bob", hostName: "Bob" }],
  ])("rejects %s", async (_label, overrides) => {
    await assertFails(host(as("alice"), overrides));
  });

  it("RSVPs are your own and repeatable; only the host can cancel", async () => {
    await host(as("alice"));
    const rsvp = (db, uid, name) =>
      setDoc(doc(db, "partyRsvps", `p1_${uid}`), { partyId: "p1", userId: uid, displayName: name, createdAt: serverTimestamp() });
    await assertSucceeds(rsvp(as("bob"), "bob", "Bob"));
    await assertSucceeds(rsvp(as("bob"), "bob", "Bob"));
    await assertFails(rsvp(as("bob"), "alice", "Alice"));
    await assertFails(deleteDoc(doc(as("bob"), "parties", "p1")));
    await assertSucceeds(deleteDoc(doc(as("alice"), "parties", "p1")));
  });
});

describe("achievements", () => {
  const unlock = (db, uid, id) => setDoc(doc(db, "achievementProgress", uid, "unlocked", id), { earnedAt: serverTimestamp() });
  it("record your own unlock once; can't write anyone else's", async () => {
    await assertSucceeds(unlock(as("alice"), "alice", "voter"));
    await assertFails(unlock(as("alice"), "alice", "voter"));
    await assertFails(unlock(as("alice"), "bob", "voter"));
  });
});
