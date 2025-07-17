import {
  collection, addDoc, onSnapshot, deleteDoc, doc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase-auth.js"; // ✅ Import shared instance

const canvas = document.getElementById("wheel-canvas");
const ctx = canvas.getContext("2d");
let games = [];
let currentGame = null;
let isSpinning = false;
let angle = 0;
let spinVelocity = 0;
let targetAngle = 0;

const spinResultRef = doc(db, "gameWheelMeta", "spinResult");
let latestSpinResult = null;

function debug(msg) {
  const debugBox = document.getElementById("debug");
  if (debugBox) debugBox.textContent = msg;
}

// Live game list sync
onSnapshot(collection(db, "gameWheel"), (snapshot) => {
  games = [];
  snapshot.forEach(doc => {
    games.push({ id: doc.id, ...doc.data() });
  });
  drawWheel();

  if (latestSpinResult && latestSpinResult.game) {
    const index = games.findIndex(g => g.id === latestSpinResult.id);
    if (index !== -1) {
      currentGame = latestSpinResult;
      spinToIndex(index);
    }
  }
});

// Listen for spin result
onSnapshot(spinResultRef, (docSnap) => {
  const result = docSnap.data();
  latestSpinResult = result;

  if (!result || !result.game) {
    currentGame = null;
    document.getElementById("selectedGame").textContent = "";
    document.getElementById("postSpinActions").style.display = "none";
  }
});

window.submitGame = async function () {
  const input = document.getElementById("gameInput");
  const name = input.value.trim();
  const user = JSON.parse(localStorage.getItem("discordUser"));

  if (!user) return debug("⚠️ You must be logged in with Discord.");
  if (!name) return debug("⚠️ Game name cannot be empty.");

  try {
    await addDoc(collection(db, "gameWheel"), {
      game: name,
      user: user.username + "#" + user.discriminator
    });
    debug("✅ Game added.");
    input.value = "";
  } catch (err) {
    console.error("Error adding game:", err);
    debug("❌ Failed to add game. Check console.");
  }
};

window.spinWheel = async function () {
  if (games.length === 0 || isSpinning) return;

  const index = Math.floor(Math.random() * games.length);
  const selected = games[index];

  try {
    await setDoc(spinResultRef, selected);
  } catch (err) {
    console.error("Error setting spin result:", err);
    debug("❌ Failed to spin. Check permissions.");
  }
};

window.removeGame = async function () {
  if (!currentGame) return;
  try {
    await deleteDoc(doc(db, "gameWheel", currentGame.id));
    await setDoc(spinResultRef, {});
  } catch (err) {
    console.error("Failed to remove game:", err);
  }
};

window.keepGame = async function () {
  await setDoc(spinResultRef, {});
};

// Wheel drawing logic
function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (games.length === 0) {
    ctx.fillStyle = "#fff";
    ctx.font = "20px Outfit";
    ctx.fillText("No games yet!", 130, 200);
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 200;
  const segmentAngle = (2 * Math.PI) / games.length;

  for (let i = 0; i < games.length; i++) {
    const startAngle = angle + i * segmentAngle;
    const endAngle = startAngle + segmentAngle;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = `hsl(${(i * 360) / games.length}, 70%, 50%)`;
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle + segmentAngle / 2);
    ctx.fillStyle = "#fff";
    ctx.font = "14px Outfit";
    ctx.textAlign = "right";
    ctx.fillText(games[i].game, radius - 10, 0);
    ctx.restore();
  }

  // Arrow
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(centerX - 10, 0);
  ctx.lineTo(centerX + 10, 0);
  ctx.lineTo(centerX, 20);
  ctx.fill();
}

// Spin animation
function spinToIndex(index) {
  if (games.length === 0 || index < 0) return;

  const segmentAngle = (2 * Math.PI) / games.length;
  const stopAngle = (3 * Math.PI / 2) - (index * segmentAngle) + (segmentAngle / 2);
  const extraSpins = 5 * 2 * Math.PI;
  targetAngle = stopAngle + extraSpins;

  spinVelocity = 0.2;
  isSpinning = true;
  requestAnimationFrame(animateSpin);
}

function animateSpin() {
  if (!isSpinning) return;

  angle += spinVelocity;
  spinVelocity *= 0.985;

  if (angle >= targetAngle) {
    angle = targetAngle % (2 * Math.PI);
    isSpinning = false;
    document.getElementById("selectedGame").textContent = `🎯 Selected: ${currentGame.game} (by ${currentGame.user})`;
    document.getElementById("postSpinActions").style.display = "flex";
  }

  drawWheel();
  if (isSpinning) {
    requestAnimationFrame(animateSpin);
  }
}
