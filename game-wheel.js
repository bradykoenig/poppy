import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBOCaso0cw72WxrObQTOlcwSXzEVV2HP7U",
  authDomain: "poppy-d5573.firebaseapp.com",
  projectId: "poppy-d5573"
});

const db = getFirestore(app);
const canvas = document.getElementById("wheel-canvas");
const ctx = canvas.getContext("2d");

let games = [];
let currentGame = null;
let isSpinning = false;
let angle = 0;
let spinVelocity = 0;
let targetAngle = 0;

const spinRef = doc(db, "gameWheelMeta", "spinResult");

function debug(msg) {
  const d = document.getElementById("debug");
  if (d) d.textContent = "🔧 DEBUG: " + msg;
}

// 🔄 Sync Game List
onSnapshot(collection(db, "gameWheel"), (snap) => {
  games = [];
  snap.forEach(doc => games.push({ id: doc.id, ...doc.data() }));
  drawWheel();
});

// 🔄 Sync Spin Result
onSnapshot(spinRef, (snap) => {
  const result = snap.data();
  if (!result || !result.game) return;

  const index = games.findIndex(g => g.id === result.id);
  if (index === -1) return;

  currentGame = result;
  debug(`🎯 Spin result updated! Index: ${index}`);
  spinToIndex(index);
});

window.submitGame = async function () {
  const input = document.getElementById("gameInput");
  const name = input.value.trim();
  const user = JSON.parse(localStorage.getItem("discordUser"));

  if (!name || !user) return debug("⚠️ Enter a game and be logged in.");

  try {
    await addDoc(collection(db, "gameWheel"), {
      game: name,
      user: `${user.username}#${user.discriminator}`
    });
    input.value = "";
    debug("✅ Game added.");
  } catch (err) {
    console.error(err);
    debug("❌ Failed to add game.");
  }
};

window.spinWheel = async function () {
  if (games.length === 0 || isSpinning) {
    debug("❌ Can't spin yet");
    return;
  }
  const index = Math.floor(Math.random() * games.length);
  await setDoc(spinRef, games[index]);
};

window.removeGame = async function () {
  if (!currentGame) return;
  await deleteDoc(doc(db, "gameWheel", currentGame.id));
  await setDoc(spinRef, {});
  currentGame = null;
};

window.keepGame = async function () {
  await setDoc(spinRef, {});
  currentGame = null;
};

// 🎨 Drawing & Spinning
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
  const segAngle = (2 * Math.PI) / games.length;

  for (let i = 0; i < games.length; i++) {
    const start = angle + i * segAngle;
    const end = start + segAngle;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = `hsl(${(i * 360) / games.length}, 70%, 60%)`;
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(start + segAngle / 2);
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

function spinToIndex(index) {
  const segAngle = (2 * Math.PI) / games.length;
  const stopAngle = (3 * Math.PI / 2) - (index * segAngle) + (segAngle / 2);
  const extra = 6 * 2 * Math.PI;
  targetAngle = stopAngle + extra;
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
    drawWheel();

    document.getElementById("selectedGame").textContent =
      `🎯 Selected: ${currentGame.game} (by ${currentGame.user})`;
    document.getElementById("postSpinActions").style.display = "flex";
    return;
  }

  drawWheel();
  requestAnimationFrame(animateSpin);
}
