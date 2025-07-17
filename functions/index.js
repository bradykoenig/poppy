const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// Fix for node-fetch v3+ (ESM-only)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

functions.setGlobalOptions({ maxInstances: 10 });

const CLIENT_ID = "1395218126211125259";
const CLIENT_SECRET = "3pCcUvTR2Z0mPmzAOPHUKTGOzTMbWPk2";
const REDIRECT_URI = "https://poppypooperz.com/oauth-callback.html";

exports.saveAvatars = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const { discordId, discordTag, robloxUsername, minecraftUsername } = req.body;

    if (!discordId) return res.status(400).json({ error: "Missing Discord ID" });

    const docRef = admin.firestore().collection("avatars").doc(discordId);

    const avatarData = {
      discordTag,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Optional: Roblox avatar
    if (robloxUsername) {
      avatarData.roblox = {
        username: robloxUsername,
        avatar: `https://thumbnails.roblox.com/v1/users/avatar?usernames=${robloxUsername}&format=Png&size=150x150`
      };
    }

    // Optional: Minecraft avatar
    if (minecraftUsername) {
      avatarData.minecraft = {
        username: minecraftUsername,
        avatar: `https://minotar.net/helm/${minecraftUsername}/150.png`
      };
    }

    await docRef.set(avatarData, { merge: true });
    res.json({ message: "Avatars saved!" });
  });
});


exports.exchangeCode = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const code = req.body.code;
    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

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
      if (!tokenData.access_token) {
        console.error("Token exchange failed:", tokenData);
        return res.status(401).json({ error: "Token exchange failed", details: tokenData });
      }

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

      console.log("Final Response:");
      console.log({ access_token, user, guilds });

      res.json({ access_token, user, guilds });

    } catch (err) {
      console.error("OAuth error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});
