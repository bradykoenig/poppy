const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// Convert Roblox username to userId
async function getRobloxUserId(username) {
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ usernames: [username] })
  });

  if (!response.ok) {
    throw new Error(`Roblox username lookup failed: ${response.status}`);
  }

  const json = await response.json();
  const user = json.data[0];
  return user ? user.id : null;
}

// Get Roblox avatar image URL
async function getAvatarImageUrl(userId) {
  const response = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-3d?userIds=${userId}&format=Png&isCircular=false&size=720x720`);
  if (!response.ok) {
    throw new Error(`Roblox avatar fetch failed: ${response.status}`);
  }

  const json = await response.json();
  const data = json.data[0];
  if (data && data.state === "Completed") {
    return data.imageUrl;
  }
  return null;
}

// Cloud Function: Get Roblox avatar URL from username
exports.getRobloxAvatar = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const username = req.query.username;
      if (!username) {
        return res.status(400).json({ error: "Missing username" });
      }

      const userId = await getRobloxUserId(username);
      if (!userId) {
        return res.status(404).json({ error: "User not found" });
      }

      const imageUrl = await getAvatarImageUrl(userId);
      if (!imageUrl) {
        return res.status(202).json({ message: "Avatar not ready yet" });
      }

      return res.status(200).json({ imageUrl });
    } catch (err) {
      console.error("Error in getRobloxAvatar:", err);
      return res.status(500).json({ error: err.message });
    }
  });
});

// Cloud Function: Get Minecraft avatar render by username
exports.getMinecraftAvatar = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const username = req.query.username;
      if (!username) {
        return res.status(400).json({ error: "Missing username" });
      }

      const avatarUrl = `https://minotar.net/render/${encodeURIComponent(username)}/720.png`;
      const test = await fetch(avatarUrl);
      if (!test.ok) {
        return res.status(404).json({ error: "Minecraft avatar not found" });
      }

      return res.status(200).json({ imageUrl: avatarUrl });
    } catch (err) {
      console.error("Error in getMinecraftAvatar:", err);
      return res.status(500).json({ error: err.message });
    }
  });
});

// Save usernames to Firestore
exports.saveAvatars = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { discordId, discordTag, robloxUsername, minecraftUsername } = req.body;

      if (!discordId || !discordTag) {
        return res.status(400).json({ error: "Missing Discord ID or tag" });
      }

      await db.collection("avatars").doc(discordId).set({
        discordId,
        discordTag,
        robloxUsername: robloxUsername || null,
        minecraftUsername: minecraftUsername || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({ message: "Avatars saved successfully" });
    } catch (err) {
      console.error("Error in saveAvatars:", err);
      return res.status(500).json({ error: err.message });
    }
  });
});

// Get saved avatars
exports.getAvatars = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const snapshot = await db.collection("avatars").orderBy("timestamp", "desc").get();
      const data = snapshot.docs.map(doc => doc.data());
      return res.status(200).json(data);
    } catch (err) {
      console.error("Error in getAvatars:", err);
      return res.status(500).json({ error: err.message });
    }
  });
});
