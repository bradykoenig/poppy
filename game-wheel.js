import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, onSnapshot, setDoc, addDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOCaso0cw72WxrObQTOlcwSXzEVV2HP7U",
  authDomain: "poppy-d5573.firebaseapp.com",
  projectId: "poppy-d5573"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");

let games = [];
let currentGame = null;
let isSpinning = false;
let angle = 0;
let targetAngle = 0;
let spinVelocity = 0;

const spinDocRef = doc(db, "gameWheelMeta", "spinResult");

function debug(msg) {
  document.getElementById("debug").textContent = msg;
}

function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (games.length === 0) {
    ctx.fillStyle = "#fff";
    ctx.font = "20px Outfit";
    ctx.fillText("No games yet!", 130, 200);
    return;
  }

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 200;
  const angleStep = (2 * Math.PI) / games.length;

  for (let i = 0; i < games.length; i++) {
    const start = angle + i * angleStep;
    const end = start + angleStep;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = `hsl(${(i * 360) / games.length}, 70%, 50%)`;
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + angleStep / 2);
    ctx.fillStyle = "#fff";
    ctx.font = "14px Outfit";
    ctx.textAlign = "right";
    ctx.fillText(games[i].game, radius - 10, 0);
    ctx.restore();
  }

  // Arrow
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(cx - 10, 0);
  ctx.lineTo(cx + 10, 0);
  ctx.lineTo(cx, 20);
  ctx.fill();
}

// Animation loop
function spinToIndex(index) {
  const seg = (2 * Math.PI) / games.length;
  const stop = (3 * Math.PI / 2) - (index * seg) + seg / 2;
  const extra = 5 * 2 * Math.PI;
  targetAngle = stop + extra;

  spinVelocity = 0.3;
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

    document.getElementById("selectedGame").textContent =
      `🎯 Selected: ${currentGame.game} (by ${currentGame.user})`;
    document.getElementById("postSpinActions").style.display = "flex";
  }

  drawWheel();
  if (isSpinning) requestAnimationFrame(animateSpin);
}

// Real-time sync
onSnapshot(collection(db, "gameWheel"), (snap) => {
  games = [];
  snap.forEach(doc => games.push({ id: doc.id, ...doc.data() }));
  drawWheel();
});

onSnapshot(spinDocRef, (snap) => {
  const data = snap.data();
  if (!data || !data.id) {
    currentGame = null;
    document.getElementById("selectedGame").textContent = "";
    document.getElementById("postSpinActions").style.display = "none";
    return;
  }

  const index = games.findIndex(g => g.id === data.id);
  if (index !== -1) {
    currentGame = data;
    spinToIndex(index);
  }
});

// Buttons
document.getElementById("submitBtn").onclick = async () => {
  const input = document.getElementById("gameInput");
  const name = input.value.trim();
  const user = JSON.parse(localStorage.getItem("discordUser"));

  if (!user || !user.username) return debug("⚠️ Login required");
  if (!name) return debug("⚠️ Game name required");

  try {
    await addDoc(collection(db, "gameWheel"), {
      game: name,
      user: `${user.username}#${user.discriminator}`
    });
    input.value = "";
    debug("✅ Game added!");
  } catch (err) {
    console.error("Error adding game:", err);
    debug("❌ Failed to add.");
  }
};

document.getElementById("spinBtn").onclick = async () => {
  if (isSpinning || games.length === 0) return debug("❌ Can't spin yet");
  const index = Math.floor(Math.random() * games.length);
  const game = games[index];
  try {
    await setDoc(spinDocRef, game);
    debug("🎯 Spin initiated");
  } catch (err) {
    console.error("Spin error:", err);
    debug("❌ Spin failed");
  }
};

document.getElementById("removeBtn").onclick = async () => {
  if (!currentGame) return;
  try {
    await deleteDoc(doc(db, "gameWheel", currentGame.id));
    await setDoc(spinDocRef, {});
  } catch (err) {
    console.error("Remove failed:", err);
  }
};

document.getElementById("keepBtn").onclick = async () => {
  await setDoc(spinDocRef, {});
};
