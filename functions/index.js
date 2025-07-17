const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

const CLIENT_ID = "1395218126211125259";
const CLIENT_SECRET = "3pCcUvTR2Z0mPmzAOPHUKTGOzTMbWPk2";
const REDIRECT_URI = "https://poppypooperz.com/oauth-callback.html";

// Helper to fetch Roblox User ID
async function getRobloxUserId(username) {
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
    });

    const data = await res.json();
    return data?.data?.[0]?.id || null;
  } catch (err) {
    console.error("Error fetching Roblox ID:", err);
    return null;
  }
}

// Discord OAuth2 exchange
exports.exchangeCode = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const code = req.body.code;
    if (!code) return res.status(400).json({ error: "Missing authorization code" });

    try {
      const params = new URLSearchParams();
      params.append("client_id", CLIENT_ID);
      params.append("client_secret", CLIENT_SECRET);
      params.append("grant_type", "authorization_code");
      params.append("code", code);
      params.append("redirect_uri", REDIRECT_URI);
      params.append("scope", "identify guilds");

      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) return res.status(401).json({ error: "Token exchange failed", details: tokenData });

      const access_token = tokenData.access_token;

      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const user = await userRes.json();

      const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const guilds = await guildsRes.json();

      if (!user.id || !Array.isArray(guilds)) {
        return res.status(500).json({ error: "Incomplete user or guild data", user, guilds });
      }

      res.json({ access_token, user, guilds });

    } catch (err) {
      console.error("OAuth error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// Save avatars
exports.saveAvatars = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

      const { discordId, discordTag, robloxUsername, minecraftUsername } = req.body;
      if (!discordId || !discordTag) return res.status(400).json({ message: "Missing Discord ID or Tag" });

      const robloxUserId = robloxUsername ? await getRobloxUserId(robloxUsername) : null;

      const userRef = db.collection("avatarCatalog").doc(discordId);
      await userRef.set({
        discordId,
        discordTag,
        robloxUsername: robloxUsername || null,
        robloxUserId,
        minecraftUsername: minecraftUsername || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ message: "Avatars saved successfully!" });
    } catch (error) {
      console.error("Error saving avatars:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  });
});

exports.getRobloxId = functions.https.onRequest(async (req, res) => {
  try {
    const username = req.query.username;
    if (!username) return res.status(400).json({ error: "Username required" });

    const robloxRes = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username] })
    });

    const data = await robloxRes.json();
    const user = data.data && data.data.length > 0 ? data.data[0] : null;

    if (user) {
      res.json({ id: user.id });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    console.error("Roblox lookup failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Get avatars
exports.getAvatars = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const snapshot = await db.collection("avatarCatalog").orderBy("updatedAt", "desc").get();
      const entries = snapshot.docs.map(doc => doc.data());
      return res.status(200).json(entries);
    } catch (error) {
      console.error("Error fetching avatars:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  });
});
