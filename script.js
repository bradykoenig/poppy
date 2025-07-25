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
