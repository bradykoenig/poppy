const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const corsHandler = cors({ origin: true });
const { fetch } = require("undici");
const axios = require("axios");

const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const os = require("os");
const path = require("path");
const fs = require("fs");

cloudinary.config({
  cloud_name: "dks4wgyhr",
  api_key: "269264416417747",
  api_secret: "vYmo7YyNbhvgwhTs-GsdnA53IT0"
});

const upload = multer({ storage: multer.memoryStorage() });

admin.initializeApp();
const db = admin.firestore();

// Get Roblox User ID from username
async function getRobloxUserId(username) {
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username] })
  });

  if (!response.ok) throw new Error(`Roblox username lookup failed: ${response.status}`);
  const json = await response.json();
  const user = json.data?.[0];

  if (!user || !user.id) {
    console.warn("Roblox user not found or missing ID for:", username);
    return null;
  }

  return user.id;
}


// Get Roblox Avatar Image with retry logic
async function getAvatarImageUrl(userId, retries = 5) {
  const avatar3DUrl = `https://thumbnails.roblox.com/v1/users/avatar-3d?userIds=${userId}&format=png&isCircular=false&size=720x720`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(avatar3DUrl);
    const json = await response.json();
    const data = json.data?.[0];

    if (data?.state === "Completed" && data.imageUrl) {
      return data.imageUrl;
    }

    await new Promise(res => setTimeout(res, 1000));
  }

  // Fallback to avatar headshot
  const fallbackUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=png&isCircular=false`;
  const fallbackRes = await fetch(fallbackUrl);
  const fallbackJson = await fallbackRes.json();
  return fallbackJson.data?.[0]?.imageUrl || null;
}

exports.uploadMedia = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).send("Only POST allowed");

    const busboy = require("busboy");
    const bb = busboy({ headers: req.headers });

    let fields = {};
    let fileBuffer;

    bb.on("file", (name, file, info) => {
      file.on("data", (data) => {
        fileBuffer = data;
      });
    });

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("close", async () => {
      try {
        const type = fields.type || "image";
        const uploadResult = await cloudinary.uploader.upload_stream(
          {
            resource_type: type === "video" ? "video" : "image"
          },
          async (err, result) => {
            if (err) {
              console.error("Cloudinary error:", err);
              return res.status(500).json({ error: "Upload failed" });
            }

            // Save metadata to Firestore
            await admin.firestore().collection("media").add({
              url: result.secure_url,
              type,
              uploaderId: fields.uploaderId,
              uploaderTag: fields.uploaderTag,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              likes: 0,
              likedBy: []
            });

            return res.status(200).json({ message: "Upload successful" });
          }
        );

        const stream = require("stream");
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);
        bufferStream.pipe(uploadResult);
      } catch (err) {
        console.error("Upload error:", err);
        return res.status(500).json({ error: "Something went wrong" });
      }
    });

    req.pipe(bb);
  });
});

// Cloud Function: Get Roblox Avatar
exports.getRobloxAvatar = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const username = req.query.username;
      if (!username) {
        res.set("Access-Control-Allow-Origin", "*");
        return res.status(400).json({ error: "Missing username" });
      }

      const userId = await getRobloxUserId(username);
      if (!userId) {
        res.set("Access-Control-Allow-Origin", "*");
        return res.status(404).json({ error: "User not found" });
      }

      const imageUrl = await getAvatarImageUrl(userId);
      if (!imageUrl) {
        res.set("Access-Control-Allow-Origin", "*");
        return res.status(202).json({ message: "Avatar not ready yet" });
      }

      res.set("Access-Control-Allow-Origin", "*");
      return res.status(200).json({ imageUrl });
    } catch (err) {
      console.error("Error in getRobloxAvatar:", err);
      res.set("Access-Control-Allow-Origin", "*");
      return res.status(500).json({ error: err.message });
    }
  });
});



exports.discordLogin = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        console.error("❌ No access token provided");
        return res.status(400).json({ error: "Missing access token" });
      }

      const userRes = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const discordUser = userRes.data;
      const uid = discordUser.id; // plain string

      console.log("✅ Discord user:", discordUser);

      // Try to update first
      try {
        await admin.auth().createUser({
          uid: discordUser.id,
          displayName: `${discordUser.username}#${discordUser.discriminator}`,
          photoURL: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        });

        console.log("✅ Firebase user updated");
      } catch (err) {
        if (err.code === "auth/user-not-found") {
          await admin.auth().createUser({
            uid,
            displayName: `${discordUser.username}#${discordUser.discriminator}`,
            photoURL: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          });
          console.log("✅ Firebase user created");
        } else {
          console.error("❌ Failed to create/update user:", err);
          throw err;
        }
      }

      const firebaseToken = await admin.auth().createCustomToken(uid);
      console.log("✅ Firebase token created:", firebaseToken.substring(0, 20) + "...");
      return res.json({ firebaseToken });
    } catch (err) {
      console.error("❌ discordLogin error:", err);
      return res.status(500).json({ error: "Token generation failed" });
    }
  });
});


// Cloud Function: Get Minecraft Avatar
exports.getMinecraftAvatar = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const username = req.query.username;
      if (!username) {
        res.set("Access-Control-Allow-Origin", "*");
        return res.status(400).json({ error: "Missing username" });
      }

      const uuidRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
      if (uuidRes.status === 204) {
        res.set("Access-Control-Allow-Origin", "*");
        return res.status(404).json({ error: "Minecraft username not found" });
      }

      const { id: uuid } = await uuidRes.json();
      const avatarUrl = `https://crafatar.com/renders/body/${uuid}?size=720`;

      const testRes = await fetch(avatarUrl);
      if (!testRes.ok) {
        res.set("Access-Control-Allow-Origin", "*");
        return res.status(404).json({ error: "Minecraft avatar not found" });
      }

      res.set("Access-Control-Allow-Origin", "*");
      return res.status(200).json({ imageUrl: avatarUrl });
    } catch (err) {
      console.error("Error in getMinecraftAvatar:", err);
      res.set("Access-Control-Allow-Origin", "*");
      return res.status(500).json({ error: err.message });
    }
  });
});


// Cloud Function: Save Discord + Avatar info
exports.saveAvatars = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // CORS Preflight
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

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

      res.set("Access-Control-Allow-Origin", "*");
      return res.status(200).json({ message: "Avatars saved successfully" });
    } catch (err) {
      console.error("Error in saveAvatars:", err);
      res.set("Access-Control-Allow-Origin", "*");
      return res.status(500).json({ error: err.message });
    }
  });
});


// Cloud Function: Get all avatars
exports.getAvatars = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    try {
      const snapshot = await db.collection("avatars").orderBy("timestamp", "desc").get();
      const data = snapshot.docs.map(doc => doc.data());

      res.set("Access-Control-Allow-Origin", "*");
      return res.status(200).json(data);
    } catch (err) {
      console.error("Error in getAvatars:", err);
      res.set("Access-Control-Allow-Origin", "*");
      return res.status(500).json({ error: err.message });
    }
  });
});


exports.saveQuote = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const { discordId, discordTag, quote } = req.body;

    if (!discordId || !quote) {
      return res.status(400).json({ message: "Missing data" });
    }

    try {
      const docRef = await db.collection("quotes").add({
        discordId,
        discordTag,
        quote,
        likes: 0,
        likedBy: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({
        message: "Quote saved successfully!",
        id: docRef.id
      });
    } catch (err) {
      console.error("Error saving quote:", err);
      return res.status(500).json({ message: "Server error while saving quote" });
    }
  });
});

exports.updateQuote = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const { id, quote } = req.body;
    if (!id || !quote) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    try {
      const ref = db.collection("quotes").doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, message: "Quote not found" });
      }

      await ref.update({ quote });
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error updating quote:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
});

exports.deleteQuote = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: "Missing ID" });
    }

    try {
      const ref = db.collection("quotes").doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, message: "Quote not found" });
      }

      await ref.delete();
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error deleting quote:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
});

exports.likeQuote = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const { id, userId } = req.body;
    if (!id || !userId) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    try {
      const ref = db.collection("quotes").doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, message: "Quote not found" });
      }

      const data = doc.data();
      const likedBy = data.likedBy || [];

      if (likedBy.includes(userId)) {
        return res.status(200).json({ success: true, message: "Already liked", newLikeCount: data.likes });
      }

      likedBy.push(userId);
      const newLikeCount = (data.likes || 0) + 1;

      await ref.update({ likes: newLikeCount, likedBy });

      res.status(200).json({ success: true, newLikeCount });
    } catch (err) {
      console.error("Error liking quote:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
});

exports.getQuotes = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const snapshot = await db.collection("quotes").orderBy("createdAt", "desc").get();
      const quotes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.().toISOString() || null
        };
      });
      res.status(200).json(quotes);
    } catch (err) {
      console.error("Error getting quotes:", err);
      res.status(500).json({ message: "Server error while fetching quotes" });
    }
  });
});


//OAuth Code Exchange
exports.exchangeCode = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") {
      // Handle preflight
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    try {
      if (!req.body || typeof req.body === "string") {
        req.body = JSON.parse(req.body || "{}");
      }

      const code = req.body.code;
      if (!code) return res.status(400).json({ error: "Missing authorization code" });

      const CLIENT_ID = "1395218126211125259";
      const CLIENT_SECRET = "3pCcUvTR2Z0mPmzAOPHUKTGOzTMbWPk2";
      const REDIRECT_URI = "https://poppypooperz.com/oauth-callback.html";

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

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("❌ Token exchange failed:", errText);
        return res.status(400).json({ error: "Token exchange failed", details: errText });
      }

      const tokenData = await tokenRes.json();
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

      res.set("Access-Control-Allow-Origin", "*"); // ✅ allow CORS for frontend
      return res.status(200).json({
        access_token,
        user,
        guilds
      });

    } catch (err) {
      console.error("OAuth error:", err);
      res.set("Access-Control-Allow-Origin", "*");
      return res.status(500).json({ error: "Internal server error", details: err.message });
    }
  });
});



