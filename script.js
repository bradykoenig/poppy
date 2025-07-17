function loginWithDiscord() {
  const clientId = "1395218126211125259";
  const redirectUri = "https://poppypooperz.com/oauth-callback.html";
  const scope = "identify guilds";
  const responseType = "code";

  const discordOAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}`;

  window.location.href = discordOAuthUrl;
}

document.addEventListener("DOMContentLoaded", () => {
  const userInfoDiv = document.getElementById("user-info");
  const storedUser = localStorage.getItem("discordUser");

  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      userInfoDiv.innerHTML = `Logged in as <strong>${user.username}#${user.discriminator}</strong>`;
    } catch (e) {
      console.error("Error parsing stored user:", e);
      localStorage.removeItem("discordUser");
    }
  }
});

async function updatePresence() {
  const user = JSON.parse(localStorage.getItem("discordUser"));
  if (!user) return;

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  try {
    console.log("Presence update response:", await response.json());
    await fetch("https://us-central1-poppy-d5573.cloudfunctions.net/updatePresence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discordId: user.id,
        discordTag: `${user.username}#${user.discriminator}`,
        avatar: avatarUrl
      })
    });

    console.log("Presence updated.");
  } catch (err) {
    console.error("Presence update failed:", err);
  }
}

updatePresence();
setInterval(updatePresence, 60000); // update every minute

