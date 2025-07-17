import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOCaso0cw72WxrObQTOlcwSXzEVV2HP7U",
  authDomain: "poppy-d5573.firebaseapp.com",
  projectId: "poppy-d5573"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Auto-login if token stored
const storedToken = localStorage.getItem("firebaseToken");
if (storedToken) {
  setPersistence(auth, browserLocalPersistence).then(() =>
    signInWithCustomToken(auth, storedToken)
  ).catch(console.error);
}

// DEBUG: Log state
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ Firebase signed in:", user.uid);
  } else {
    console.warn("❌ Not signed into Firebase");
  }
});
