import { earnCoins } from "../economy.js";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"];
const TRUMP = "♠";

function freshDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function rankValue(rank) {
  return RANKS.indexOf(rank);
}

function cardBeats(challenger, incumbent, leadSuit) {
  const cIsTrump = challenger.suit === TRUMP;
  const iIsTrump = incumbent.suit === TRUMP;
  if (cIsTrump && !iIsTrump) return true;
  if (!cIsTrump && iIsTrump) return false;
  if (challenger.suit !== incumbent.suit) {
    return challenger.suit === leadSuit && incumbent.suit !== leadSuit;
  }
  return rankValue(challenger.rank) > rankValue(incumbent.rank);
}

function cardLabel(c) {
  return `${c.rank}${c.suit}`;
}

function cardColor(c) {
  return c.suit === "♥" || c.suit === "♦" ? "#d8395b" : "#1b1b1b";
}

export function mountCardGame(root, { onClose } = {}) {
  const HAND_SIZE = 6;
  const deck = freshDeck();
  const state = {
    player: deck.slice(0, HAND_SIZE),
    ai: deck.slice(HAND_SIZE, HAND_SIZE * 2),
    tricks: { player: 0, ai: 0 },
    trickNum: 0,
    leader: "player",
    leadCard: null,
    log: "Your lead — pick a card.",
    over: false,
  };

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>♠ Spades on the Yard</h3>
      <div class="game-score">You: <b id="score-player">0</b> &nbsp;·&nbsp; AI: <b id="score-ai">0</b> &nbsp;·&nbsp; Trick <span id="trick-num">1</span>/${HAND_SIZE}</div>
      <div class="trick-area" id="trick-area"></div>
      <div class="game-log" id="game-log"></div>
      <div class="hand" id="player-hand"></div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Leave table</button>
    </div>`;

  const handEl = root.querySelector("#player-hand");
  const trickEl = root.querySelector("#trick-area");
  const logEl = root.querySelector("#game-log");
  const scorePlayerEl = root.querySelector("#score-player");
  const scoreAiEl = root.querySelector("#score-ai");
  const trickNumEl = root.querySelector("#trick-num");

  function render() {
    scorePlayerEl.textContent = state.tricks.player;
    scoreAiEl.textContent = state.tricks.ai;
    trickNumEl.textContent = Math.min(state.trickNum + 1, HAND_SIZE);
    logEl.textContent = state.log;

    trickEl.innerHTML = "";
    if (state.leadCard) {
      const who = state.leader === "player" ? "You" : "AI";
      trickEl.appendChild(makeCardEl(state.leadCard, false, `${who} led`));
    }

    handEl.innerHTML = "";
    const leadSuit = state.leadCard ? state.leadCard.suit : null;
    const mustFollow = leadSuit && state.player.some((c) => c.suit === leadSuit);
    state.player.forEach((c, idx) => {
      const legal = !leadSuit || !mustFollow || c.suit === leadSuit;
      const el = makeCardEl(c, true);
      if (!legal || state.over) el.classList.add("disabled");
      else el.addEventListener("click", () => playPlayerCard(idx));
      handEl.appendChild(el);
    });
  }

  function makeCardEl(card, interactive, tag) {
    const el = document.createElement("div");
    el.className = "game-card" + (interactive ? " interactive" : "");
    el.style.color = cardColor(card);
    el.innerHTML = `<span>${cardLabel(card)}</span>${tag ? `<small>${tag}</small>` : ""}`;
    return el;
  }

  function aiRespondTo(playerCard) {
    const leadSuit = playerCard.suit;
    const following = state.ai.filter((c) => c.suit === leadSuit);
    const pool = following.length ? following : state.ai;
    let choice;
    const winners = pool.filter((c) => cardBeats(c, playerCard, leadSuit));
    if (winners.length) {
      choice = winners.sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];
    } else {
      choice = pool.sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];
    }
    return choice;
  }

  function aiLead() {
    const nonTrump = state.ai.filter((c) => c.suit !== TRUMP);
    const pool = nonTrump.length ? nonTrump : state.ai;
    return pool.sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];
  }

  function removeCard(hand, card) {
    const i = hand.indexOf(card);
    hand.splice(i, 1);
  }

  function finishTrick(winnerSide, playerCard, aiCard) {
    state.tricks[winnerSide]++;
    state.trickNum++;
    state.leadCard = null;
    state.leader = winnerSide;
    state.log = `${winnerSide === "player" ? "You" : "AI"} won that trick with ${cardLabel(
      winnerSide === "player" ? playerCard : aiCard
    )}.`;

    if (state.trickNum >= HAND_SIZE) {
      state.over = true;
      const win = state.tricks.player > state.tricks.ai;
      const tie = state.tricks.player === state.tricks.ai;
      state.log = tie
        ? `Push — ${state.tricks.player} tricks each. Run it back.`
        : win
        ? `You took the table, ${state.tricks.player}-${state.tricks.ai}!`
        : `AI ran the table, ${state.tricks.ai}-${state.tricks.player}. Run it back.`;
      render();
      if (win) {
        earnCoins(15, "spades win").then((r) => {
          if (r.ok) logEl.textContent += ` +15 🪙 (${r.balance} total)`;
        });
      }
      handEl.innerHTML = "";
      const again = document.createElement("button");
      again.className = "btn btn-primary";
      again.style.cssText = "margin-top:8px;width:100%;";
      again.textContent = "Play again";
      again.addEventListener("click", () => mountCardGame(root, { onClose }));
      root.querySelector(".game-modal").insertBefore(again, root.querySelector(".close"));
      return;
    }

    setTimeout(() => {
      if (state.leader === "ai") aiLeadsNext();
      else render();
    }, 500);
  }

  function aiLeadsNext() {
    const card = aiLead();
    removeCard(state.ai, card);
    state.leadCard = card;
    state.log = "AI led — follow if you can.";
    render();
  }

  function playPlayerCard(idx) {
    const leadSuit = state.leadCard ? state.leadCard.suit : null;
    const mustFollow = leadSuit && state.player.some((c) => c.suit === leadSuit);
    const card = state.player[idx];
    if (leadSuit && mustFollow && card.suit !== leadSuit) return;

    if (!state.leadCard) {
      removeCard(state.player, card);
      state.leadCard = card;
      state.leader = "player";
      state.log = "You led — waiting on AI...";
      render();
      setTimeout(() => {
        const aiCard = aiRespondTo(card);
        removeCard(state.ai, aiCard);
        const playerWon = !cardBeats(aiCard, card, card.suit);
        finishTrick(playerWon ? "player" : "ai", card, aiCard);
      }, 600);
    } else {
      removeCard(state.player, card);
      const lead = state.leadCard;
      const playerWon = cardBeats(card, lead, lead.suit);
      finishTrick(playerWon ? "player" : "ai", card, lead);
    }
  }

  root.querySelector(".close").addEventListener("click", () => onClose?.());
  render();
}
