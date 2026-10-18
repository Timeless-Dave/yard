import { earnCoins } from "../economy.js";
import { playSuccess, playFail } from "../sound.js";
import { unlockAchievement } from "../achievements.js";

function freshSet() {
  const tiles = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) tiles.push({ a: i, b: j });
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

function sideFor(tile, ends) {
  if (ends.left === null) return "start";
  if (tile.a === ends.right || tile.b === ends.right) return "right";
  if (tile.a === ends.left || tile.b === ends.left) return "left";
  return null;
}

function pipSum(hand) {
  return hand.reduce((s, t) => s + t.a + t.b, 0);
}

export function mountDominoes(root, { onClose } = {}) {
  const set = freshSet();
  const state = {
    player: set.slice(0, 7),
    ai: set.slice(7, 14),
    boneyard: set.slice(14),
    ends: { left: null, right: null },
    chain: [],
    turn: "player",
    passStreak: 0,
    log: "Place any tile to open the line.",
    over: false,
  };

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🁢 Dominoes on the Block</h3>
      <div class="game-score">Your hand: <b id="dom-count">7</b> &nbsp;·&nbsp; Boneyard: <b id="dom-bone">${state.boneyard.length}</b></div>
      <div class="dom-chain" id="dom-chain"></div>
      <div class="game-log" id="dom-log"></div>
      <div class="hand" id="dom-hand"></div>
      <div id="dom-actions"></div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Leave the block</button>
    </div>`;

  const chainEl = root.querySelector("#dom-chain");
  const handEl = root.querySelector("#dom-hand");
  const logEl = root.querySelector("#dom-log");
  const countEl = root.querySelector("#dom-count");
  const boneEl = root.querySelector("#dom-bone");
  const actionsEl = root.querySelector("#dom-actions");

  function tileEl(tile, interactive) {
    const el = document.createElement("div");
    el.className = "game-card dom-tile" + (interactive ? " interactive" : "");
    el.innerHTML = `<span>${tile.a}|${tile.b}</span>`;
    return el;
  }

  function render() {
    countEl.textContent = state.player.length;
    boneEl.textContent = state.boneyard.length;
    logEl.textContent = state.log;

    chainEl.innerHTML = "";
    state.chain.forEach((t) => chainEl.appendChild(tileEl(t, false)));
    if (!state.chain.length) chainEl.innerHTML = '<span style="opacity:0.5;font-size:12px;">— empty line —</span>';

    handEl.innerHTML = "";
    state.player.forEach((tile, idx) => {
      const side = sideFor(tile, state.ends);
      const el = tileEl(tile, true);
      if (!side || state.over || state.turn !== "player") el.classList.add("disabled");
      else el.addEventListener("click", () => playerPlay(idx, side));
      handEl.appendChild(el);
    });

    actionsEl.innerHTML = "";
    if (!state.over && state.turn === "player") {
      const hasMove = state.player.some((t) => sideFor(t, state.ends));
      if (!hasMove) {
        const btn = document.createElement("button");
        btn.className = "btn btn-primary";
        btn.style.cssText = "width:100%;margin-top:8px;";
        if (state.boneyard.length) {
          btn.textContent = "Draw from the boneyard";
          btn.addEventListener("click", drawPlayer);
        } else {
          btn.textContent = "Pass";
          btn.addEventListener("click", () => passTurn("player"));
        }
        actionsEl.appendChild(btn);
      }
    }
  }

  function drawPlayer() {
    const tile = state.boneyard.pop();
    state.player.push(tile);
    state.log = `Drew ${tile.a}|${tile.b} from the boneyard.`;
    render();
  }

  function playerPlay(idx, side) {
    const tile = state.player[idx];
    place(tile, side, "player");
    state.player.splice(idx, 1);
    state.passStreak = 0;
    if (checkWin("player")) return;
    state.turn = "ai";
    state.log = "AI thinking...";
    render();
    setTimeout(aiTurn, 700);
  }

  function place(tile, side, who) {
    if (side === "start") {
      state.ends.left = tile.a;
      state.ends.right = tile.b;
      state.chain = [tile];
    } else if (side === "left") {
      const exposed = tile.a === state.ends.left ? tile.b : tile.a;
      state.ends.left = exposed;
      state.chain.unshift(tile);
    } else {
      const exposed = tile.a === state.ends.right ? tile.b : tile.a;
      state.ends.right = exposed;
      state.chain.push(tile);
    }
    state.log = `${who === "player" ? "You" : "AI"} played ${tile.a}|${tile.b}.`;
  }

  function aiTurn() {
    let idx = state.ai.findIndex((t) => t.a === t.b && sideFor(t, state.ends));
    if (idx === -1) idx = state.ai.findIndex((t) => sideFor(t, state.ends));
    if (idx !== -1) {
      const tile = state.ai[idx];
      const side = sideFor(tile, state.ends);
      place(tile, side, "ai");
      state.ai.splice(idx, 1);
      state.passStreak = 0;
      if (checkWin("ai")) return;
      state.turn = "player";
      render();
      return;
    }
    if (state.boneyard.length) {
      const tile = state.boneyard.pop();
      state.ai.push(tile);
      setTimeout(aiTurn, 400);
      return;
    }
    passTurn("ai");
  }

  function passTurn(who) {
    state.passStreak++;
    state.log = `${who === "player" ? "You" : "AI"} can't play and the boneyard's dry.`;
    if (state.passStreak >= 2) return blockedEnd();
    state.turn = who === "player" ? "ai" : "player";
    render();
    if (state.turn === "ai") setTimeout(aiTurn, 700);
  }

  function checkWin(who) {
    const hand = who === "player" ? state.player : state.ai;
    if (hand.length === 0) {
      state.over = true;
      const won = who === "player";
      state.log = won ? "Domino! You cleared your hand." : "AI dropped last tile. Domino — you lose this one.";
      finish();
      won ? playSuccess() : playFail();
      if (won) unlockAchievement("domino_king");
      if (won) {
        earnCoins("dominoes_win").then((r) => {
          if (r.ok) logEl.textContent += ` +${r.amount} 🪙 (${r.balance} total)`;
        });
      }
      return true;
    }
    return false;
  }

  function blockedEnd() {
    state.over = true;
    const pSum = pipSum(state.player);
    const aSum = pipSum(state.ai);
    const won = pSum < aSum;
    state.log =
      pSum === aSum
        ? `Blocked — tied at ${pSum} pips. Push.`
        : won
        ? `Blocked — you win on pips, ${pSum} to ${aSum}.`
        : `Blocked — AI wins on pips, ${aSum} to ${pSum}.`;
    finish();
    if (pSum !== aSum) won ? playSuccess() : playFail();
    if (won) unlockAchievement("domino_king");
    if (won) {
      earnCoins("dominoes_blocked_win").then((r) => {
        if (r.ok) logEl.textContent += ` +${r.amount} 🪙 (${r.balance} total)`;
      });
    }
  }

  function finish() {
    render();
    const again = document.createElement("button");
    again.className = "btn btn-primary";
    again.style.cssText = "margin-top:8px;width:100%;";
    again.textContent = "Run it back";
    again.addEventListener("click", () => mountDominoes(root, { onClose }));
    root.querySelector(".game-modal").insertBefore(again, root.querySelector(".close"));
  }

  root.querySelector(".close").addEventListener("click", () => onClose?.());
  render();
}
