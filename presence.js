import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOCaso0cw72WxrObQTOlcwSXzEVV2HP7U",
  authDomain: "poppy-d5573.firebaseapp.com",
  projectId: "poppy-d5573"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function updatePresenceClient(user) {
  if (!user) return;

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const ref = doc(db, "presence", user.id);
  return setDoc(ref, {
    discordTag: `${user.username}#${user.discriminator}`,
    avatar: avatarUrl,
    lastSeen: serverTimestamp(),
    visits: increment(1)
  }, { merge: true }).then(() => {
    console.log("✅ Presence updated");
  }).catch(err => {
    console.error("❌ Failed to update presence:", err);
  });
}

const stored = localStorage.getItem("discordUser");
if (stored) {
  try {
    const user = JSON.parse(stored);
    updatePresenceClient(user);
    setInterval(() => updatePresenceClient(user), 60000);
  } catch (err) {
    console.error("Invalid Discord user:", err);
  }
}
