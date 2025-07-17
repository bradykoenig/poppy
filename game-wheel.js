import {
  getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBOCaso0cw72WxrObQTOlcwSXzEVV2HP7U",
  authDomain: "poppy-d5573.firebaseapp.com",
  projectId: "poppy-d5573"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elements
const canvas = document.getElementById("wheel-canvas");
const ctx = canvas.getContext("2d");
const gameListDiv = document.getElementById("game-list");
const winnerOverlay = document.getElementById("winnerOverlay");
const winnerText = document.getElementById("winnerText");
const closeWinner = document.getElementById("closeWinner");

let angle = 0;
let targetAngle = 0;
let isSpinning = false;
let games = [];

const spinRef = doc(db, "gameWheelMeta", "spinResult");

// 🔄 Live updates
onSnapshot(collection(db, "gameWheel"), (snapshot) => {
  games = [];
  snapshot.forEach(doc => {
    games.push({ id: doc.id, ...doc.data() });
  });
  drawWheel();
  updateGameList();
});

onSnapshot(spinRef, (docSnap) => {
  const result = docSnap.data();
  if (!result || !result.game) return;

  const index = games.findIndex(g => g.id === result.id);
  if (index !== -1) spinToIndex(index);
});

// ➕ Submit Game
window.submitGame = async function () {
  const input = document.getElementById("gameInput");
  const name = input.value.trim();
  if (!name) return;

  try {
    await addDoc(collection(db, "gameWheel"), {
      game: name,
      user: "anonymous"
    });
    input.value = "";
  } catch (e) {
    console.error("Failed to add game:", e);
  }
};

// 🎲 Spin
window.spinWheel = async function () {
  if (isSpinning || games.length === 0) return;

  const index = Math.floor(Math.random() * games.length);
  const selected = games[index];

  try {
    await setDoc(spinRef, selected);
  } catch (e) {
    console.error("Failed to spin:", e);
  }
};

// 🧠 Draw Wheel
function drawWheel() {
  const radius = canvas.width / 2;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const segmentAngle = (2 * Math.PI) / games.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  games.forEach((g, i) => {
    const start = angle + i * segmentAngle;
    const end = start + segmentAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = `hsl(${(i * 360) / games.length}, 80%, 50%)`;
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + segmentAngle / 2);
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(g.game, radius - 10, 0);
    ctx.restore();
  });

  // Draw arrow
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(cx - 10, 0);
  ctx.lineTo(cx + 10, 0);
  ctx.lineTo(cx, 20);
  ctx.fill();
}

// 🌀 Spin Logic
function spinToIndex(index) {
  const segmentAngle = (2 * Math.PI) / games.length;
  const stopAngle = (3 * Math.PI / 2) - index * segmentAngle + segmentAngle / 2;
  const extraSpins = 6 * 2 * Math.PI;
  targetAngle = stopAngle + extraSpins;

  isSpinning = true;
  animateSpin();
}

function animateSpin() {
  if (!isSpinning) return;

  const speed = 0.1;
  angle += speed;

  if (angle >= targetAngle) {
    angle = targetAngle % (2 * Math.PI);
    isSpinning = false;
    drawWheel();

    // 🎉 Show winner
    const segmentAngle = (2 * Math.PI) / games.length;
    const index = Math.floor(((3 * Math.PI / 2 - angle + 2 * Math.PI) % (2 * Math.PI)) / segmentAngle);
    const winner = games[index];
    showWinnerPopup(winner?.game || "Unknown Game");

    return;
  }

  drawWheel();
  requestAnimationFrame(animateSpin);
}

// 🗑️ Delete by Clicking a Segment (no prompt)
canvas.addEventListener("click", async (e) => {
  if (isSpinning || games.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - canvas.width / 2;
  const y = e.clientY - rect.top - canvas.height / 2;
  const clickAngle = Math.atan2(y, x) - angle;
  const normalized = (clickAngle + 2 * Math.PI) % (2 * Math.PI);
  const segmentAngle = (2 * Math.PI) / games.length;
  const index = Math.floor(normalized / segmentAngle);

  const game = games[index];
  try {
    await deleteDoc(doc(db, "gameWheel", game.id));
  } catch (err) {
    console.error("Failed to remove game:", err);
  }
});

// 🧾 Sidebar Game List (no prompt)
function updateGameList() {
  gameListDiv.innerHTML = "";
  games.forEach(game => {
    const item = document.createElement("div");
    item.className = "game-item";

    const name = document.createElement("span");
    name.textContent = game.game;

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "🗑️";
    del.onclick = async () => {
      try {
        await deleteDoc(doc(db, "gameWheel", game.id));
      } catch (err) {
        console.error("Failed to delete game:", err);
      }
    };

    item.appendChild(name);
    item.appendChild(del);
    gameListDiv.appendChild(item);
  });
}

// 🎉 Winner Overlay
function showWinnerPopup(gameName) {
  winnerText.textContent = `🎉 ${gameName} was picked!`;
  winnerOverlay.classList.remove("hidden");
}

closeWinner.onclick = () => {
  winnerOverlay.classList.add("hidden");
};
