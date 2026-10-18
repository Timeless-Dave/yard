import { collection, doc, addDoc, getDoc, setDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, ONLINE } from "../firebase.js";
import { getState } from "../auth.js";
import { unlockAchievement } from "../achievements.js";

export function mountVoting(root, { onClose } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🏆 Vote: Mr. / Miss UAPB Homecoming</h3>
        <p>Nominate and vote for this year's Homecoming King & Queen — one vote per category, change it any time before the polls close. Connect Firebase (see <code>firebase/README.md</code>) to turn this on.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  const authState = getState();
  let category = "king";
  let unsubscribe = null;

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🏆 Homecoming Court</h3>
      <div class="auth-tabs">
        <button class="auth-tab active" data-cat="king">King</button>
        <button class="auth-tab" data-cat="queen">Queen</button>
      </div>
      <div class="leaderboard-list" id="vote-list">Loading...</div>
      <div class="corkboard-form" style="margin-top:10px;">
        <input id="vote-nominee" type="text" maxlength="30" placeholder="Nominate someone new" />
        <button class="btn btn-primary" id="vote-nominate" style="width:100%;">Add nominee</button>
      </div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const listEl = root.querySelector("#vote-list");
  const nomineeInput = root.querySelector("#vote-nominee");

  async function myVote() {
    if (!authState.user) return null;
    const snap = await getDoc(doc(db, "votes", `${authState.user.uid}_${category}`));
    return snap.exists() ? snap.data().candidateId : null;
  }

  function renderRows(candidates, mine) {
    listEl.innerHTML = "";
    if (!candidates.length) {
      listEl.innerHTML = '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">No nominees yet — add the first one below.</div>';
      return;
    }
    candidates.forEach((c) => {
      const row = document.createElement("div");
      row.className = "lb-row" + (c.id === mine ? " lb-me" : "");
      row.innerHTML = `
        <span class="lb-rank">${c.voteCount || 0}</span>
        <span class="lb-name">${c.name}</span>
        <button class="btn ${c.id === mine ? "btn-primary" : "btn-secondary"}" style="padding:6px 12px;font-size:12px;">
          ${c.id === mine ? "Your vote" : "Vote"}
        </button>`;
      row.querySelector("button").addEventListener("click", async () => {
        if (!authState.user) {
          alert("Join the Yard first (Sign up / Log in) to vote.");
          return;
        }
        try {
          await setDoc(doc(db, "votes", `${authState.user.uid}_${category}`), {
            userId: authState.user.uid,
            category,
            candidateId: c.id,
            createdAt: serverTimestamp(),
          });
          unlockAchievement("voter");
        } catch (e) {
          alert("Couldn't vote: " + e.message);
        }
      });
      listEl.appendChild(row);
    });
  }

  function watch() {
    if (unsubscribe) unsubscribe();
    listEl.innerHTML = "Loading...";
    const q = query(collection(db, "candidates"), where("category", "==", category), orderBy("voteCount", "desc"));
    unsubscribe = onSnapshot(q, async (snap) => {
      const candidates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const mine = await myVote();
      renderRows(candidates, mine);
    });
  }

  root.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      root.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      category = tab.dataset.cat;
      watch();
    });
  });

  root.querySelector("#vote-nominate").addEventListener("click", async () => {
    const name = nomineeInput.value.trim();
    if (!name) return;
    if (!authState.user) {
      alert("Join the Yard first (Sign up / Log in) to nominate someone.");
      return;
    }
    try {
      await addDoc(collection(db, "candidates"), {
        category,
        name,
        nominatedBy: authState.user.uid,
        voteCount: 0,
        createdAt: serverTimestamp(),
      });
      nomineeInput.value = "";
    } catch (e) {
      alert("Couldn't nominate: " + e.message);
    }
  });

  root.querySelector(".close").addEventListener("click", () => {
    if (unsubscribe) unsubscribe();
    onClose?.();
  });

  watch();
}
