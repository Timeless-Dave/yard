import { collection, doc, getDoc, setDoc, deleteDoc, query, where, orderBy, getDocs, serverTimestamp } from "firebase/firestore";
import { db, ONLINE } from "../firebase.js";
import { getState } from "../auth.js";
import { unlockAchievement } from "../achievements.js";
import { esc } from "../text.js";

export function mountPlotClaim(root, { letters, onClose } = {}) {
  if (!letters) {
    root.innerHTML = `
      <div class="modal">
        <h3>🏠 Divine Nine Plot Lines</h3>
        <p>Walk up to one of the five plot houses on the Yard (ΑΦΑ, ΔΣΘ, ΚΑΨ, ΟΦΒ, ΖΦΒ) and press E to claim that specific one.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🏠 Claim ${letters} Plot</h3>
        <p>Claim a Divine Nine plot house, join the membership roster, and sign up for Probate Night — the public stepping reveal for new members. Online play isn't switched on for this copy of The Yard yet.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  const authState = getState();
  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🏠 ${letters} Plot</h3>
      <div class="auth-status" id="pc-status">Checking...</div>
      <button class="btn btn-primary" id="pc-action" style="width:100%;display:none;"></button>

      <h3 style="margin-top:18px;font-size:15px;">👥 Roster</h3>
      <div class="corkboard-sub" id="pc-roster-sub">Loading...</div>
      <div class="leaderboard-list" id="pc-roster" style="max-height:120px;"></div>
      <button class="btn btn-secondary" id="pc-join" style="width:100%;margin-top:8px;display:none;"></button>

      <h3 style="margin-top:18px;font-size:15px;">🎉 Probate Night</h3>
      <p class="corkboard-sub">The public stepping reveal where new members are introduced to the Yard.</p>
      <div class="leaderboard-list" id="pc-probate" style="max-height:100px;"></div>
      <button class="btn btn-secondary" id="pc-probate-signup" style="width:100%;margin-top:8px;display:none;">Sign up for Probate Night</button>

      <button class="btn btn-secondary close" style="width:100%;margin-top:12px;">Close</button>
    </div>`;

  const statusEl = root.querySelector("#pc-status");
  const actionBtn = root.querySelector("#pc-action");
  const rosterSubEl = root.querySelector("#pc-roster-sub");
  const rosterEl = root.querySelector("#pc-roster");
  const joinBtn = root.querySelector("#pc-join");
  const probateEl = root.querySelector("#pc-probate");
  const probateBtn = root.querySelector("#pc-probate-signup");

  async function refreshPlot() {
    const snap = await getDoc(doc(db, "plotClaims", letters));
    if (!snap.exists()) {
      statusEl.textContent = "This plot is unclaimed.";
      if (authState.user) {
        actionBtn.textContent = "Claim this plot";
        actionBtn.style.display = "block";
        actionBtn.onclick = async () => {
          try {
            await setDoc(doc(db, "plotClaims", letters), {
              userId: authState.user.uid,
              displayName: getState().profile?.display_name || "Golden Lion",
              claimedAt: serverTimestamp(),
            });
            unlockAchievement("plot_owner");
            refreshPlot();
          } catch (e) {
            statusEl.textContent = "Couldn't claim: " + e.message;
          }
        };
      } else {
        actionBtn.style.display = "none";
        statusEl.textContent += " Join the Yard (Sign up/Log in) to claim it.";
      }
      return;
    }
    const data = snap.data();
    const mine = authState.user && data.userId === authState.user.uid;
    statusEl.textContent = mine ? "You hold this plot." : `Claimed by ${data.displayName}.`;
    if (mine) {
      actionBtn.textContent = "Release this plot";
      actionBtn.style.display = "block";
      actionBtn.onclick = async () => {
        await deleteDoc(doc(db, "plotClaims", letters));
        refreshPlot();
      };
    } else {
      actionBtn.style.display = "none";
    }
  }

  async function refreshRoster() {
    const q = query(collection(db, "orgMembers"), where("letters", "==", letters), orderBy("joinedAt", "asc"));
    const snap = await getDocs(q);
    const members = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rosterSubEl.textContent = `${members.length} member${members.length === 1 ? "" : "s"} on the roster.`;
    rosterEl.innerHTML = members.length
      ? ""
      : '<div style="opacity:0.5;font-size:12px;text-align:center;padding:8px;">No members yet.</div>';
    members.forEach((m) => {
      const row = document.createElement("div");
      row.className = "lb-row";
      row.innerHTML = `<span class="lb-rank">👤</span><span class="lb-name">${esc(m.displayName)}</span><span></span>`;
      rosterEl.appendChild(row);
    });

    if (!authState.user) {
      joinBtn.style.display = "none";
      return;
    }
    const mine = members.find((m) => m.id === authState.user.uid);
    const myMembershipSnap = await getDoc(doc(db, "orgMembers", authState.user.uid));
    const myMembership = myMembershipSnap.exists() ? myMembershipSnap.data() : null;

    joinBtn.style.display = "block";
    if (mine) {
      joinBtn.textContent = "Leave this org";
      joinBtn.disabled = false;
      joinBtn.onclick = async () => {
        await deleteDoc(doc(db, "orgMembers", authState.user.uid));
        refreshRoster();
        refreshProbate();
      };
    } else if (myMembership) {
      joinBtn.textContent = `Already a member of ${myMembership.letters}`;
      joinBtn.disabled = true;
    } else {
      joinBtn.disabled = false;
      joinBtn.textContent = `Join ${letters}`;
      joinBtn.onclick = async () => {
        try {
          await setDoc(doc(db, "orgMembers", authState.user.uid), {
            letters,
            displayName: getState().profile?.display_name || "Golden Lion",
            joinedAt: serverTimestamp(),
          });
          refreshRoster();
          refreshProbate();
        } catch (e) {
          alert("Couldn't join: " + e.message);
        }
      };
    }
  }

  async function refreshProbate() {
    const q = query(collection(db, "probateSignups"), where("letters", "==", letters), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    const signups = snap.docs.map((d) => d.data());
    probateEl.innerHTML = signups.length
      ? ""
      : '<div style="opacity:0.5;font-size:12px;text-align:center;padding:8px;">No one signed up yet.</div>';
    signups.forEach((s) => {
      const row = document.createElement("div");
      row.className = "lb-row";
      row.innerHTML = `<span class="lb-rank">🎙️</span><span class="lb-name">${esc(s.displayName)}</span><span></span>`;
      probateEl.appendChild(row);
    });

    if (!authState.user) {
      probateBtn.style.display = "none";
      return;
    }
    const already = signups.some((s) => s.userId === authState.user.uid);
    const membership = await getDoc(doc(db, "orgMembers", authState.user.uid));
    const isMember = membership.exists() && membership.data().letters === letters;
    probateBtn.style.display = "block";
    probateBtn.disabled = already || !isMember;
    probateBtn.textContent = already
      ? "You're signed up"
      : isMember
        ? "Sign up for Probate Night"
        : `Join ${letters} to sign up for Probate Night`;
    probateBtn.onclick = async () => {
      try {
        await setDoc(doc(db, "probateSignups", `${letters}_${authState.user.uid}`), {
          userId: authState.user.uid,
          letters,
          displayName: getState().profile?.display_name || "Golden Lion",
          createdAt: serverTimestamp(),
        });
        refreshProbate();
      } catch (e) {
        alert("Couldn't sign up: " + e.message);
      }
    };
  }

  refreshPlot();
  refreshRoster();
  refreshProbate();
  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
