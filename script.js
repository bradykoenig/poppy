// Discord login redirect
function loginWithDiscord() {
  const clientId = "1395218126211125259";
  const redirectUri = "https://poppypooperz.com/oauth-callback.html";
  const scope = "identify guilds";
  const responseType = "code";

  const discordOAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}`;

  window.location.href = discordOAuthUrl;
}

// Load user info from localStorage
document.addEventListener("DOMContentLoaded", () => {
  const userInfoDiv = document.getElementById("user-info");
  const storedUser = localStorage.getItem("discordUser");

  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      userInfoDiv.innerHTML = `Logged in as <strong>${user.username}#${user.discriminator}</strong>`;
    } catch (e) {
      console.error("Error parsing stored user:", e);
      localStorage.removeItem("discordUser");
    }
  }
});

// Firebase presence tracking (client-side)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// 🔥 Your Firebase config here:
const firebaseConfig = {
  apiKey: "AIzaSyBOCaso0cw72WxrObQTOlcwSXzEVV2HP7U",
  authDomain: "poppy-d5573.firebaseapp.com",
  projectId: "poppy-d5573",
  // You can add storageBucket, messagingSenderId, appId if needed
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Presence updater
async function updatePresenceClient(user) {
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  try {
    const ref = doc(db, "presence", user.id);
    await setDoc(ref, {
      discordTag: `${user.username}#${user.discriminator}`,
      avatar: avatarUrl,
      lastSeen: serverTimestamp(),
      visits: increment(1)
    }, { merge: true });

    console.log("✅ Presence updated");
  } catch (err) {
    console.error("❌ Failed to update presence:", err);
  }
}

// Initial and interval presence updates
const stored = localStorage.getItem("discordUser");
if (stored) {
  try {
    const discordUser = JSON.parse(stored);
    updatePresenceClient(discordUser);
    setInterval(() => updatePresenceClient(discordUser), 60000);
  } catch (err) {
    console.error("Invalid Discord user:", err);
  }
}
