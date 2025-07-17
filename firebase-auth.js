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

// Persist session if token is saved
const storedToken = localStorage.getItem("firebaseToken");
if (storedToken) {
  setPersistence(auth, browserLocalPersistence).then(() =>
    signInWithCustomToken(auth, storedToken)
  ).catch(console.error);
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ Firebase signed in:", user.uid);
  } else {
    console.warn("❌ Not signed into Firebase");
  }
});

export { auth, db };
