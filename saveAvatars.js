import { db, doc, setDoc } from "./firebaseConfig.js";

export async function saveAvatars(uid, data) {
  try {
    await setDoc(doc(db, "users", uid), {
      ...data,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error("Error saving avatars:", error);
  }
}
