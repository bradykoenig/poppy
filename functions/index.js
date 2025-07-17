const functions = require("firebase-functions");
const fetch = require("node-fetch");
const cors = require("cors")({ origin: true });

// Optional: Control cost/spike limits
functions.setGlobalOptions({ maxInstances: 10 });

// Discord app credentials (DO NOT expose these on frontend)
const CLIENT_ID = "1395218126211125259";
const CLIENT_SECRET = "3pCcUvTR2Z0mPmzAOPHUKTGOzTMbWPk2";
const REDIRECT_URI = "https://poppypooperz.com/oauth-callback.html";

exports.exchangeCode = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const code = req.body.code;
    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    try {
      // Exchange code for access token
      const params = new URLSearchParams();
      params.append("client_id", CLIENT_ID);
      params.append("client_secret", CLIENT_SECRET);
      params.append("grant_type", "authorization_code");
      params.append("code", code);
      params.append("redirect_uri", REDIRECT_URI);
      params.append("scope", "identify guilds");

      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        return res.status(401).json({ error: "Token exchange failed", details: tokenData });
      }

      const accessToken = tokenData.access_token;

      // Fetch user info
      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const user = await userRes.json();

      // Fetch guilds
      const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const guilds = await guildsRes.json();

      res.json({ user, guilds });
    } catch (err) {
      console.error("OAuth error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});
