import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithCustomToken,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOCaso0cw72WxrObQTOlcwSXzEVV2HP7U",
  authDomain: "poppy-d5573.firebaseapp.com",
  projectId: "poppy-d5573"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 🔄 Try to log in with the saved custom token
const token = localStorage.getItem("firebaseToken");
if (token) {
  setPersistence(auth, browserLocalPersistence)
    .then(() => signInWithCustomToken(auth, token))
    .catch((err) => {
      console.error("❌ Failed to sign in with stored Firebase token:", err);
    });
} else {
  console.warn("⚠️ No Firebase token found in localStorage.");
}

// 🔍 Debug Firebase auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ Firebase signed in:", user.uid);
  } else {
    console.warn("❌ Not signed into Firebase");
  }
});

export { auth, db };
