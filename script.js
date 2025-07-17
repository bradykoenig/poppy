function loginWithDiscord() {
  const clientId = "1395218126211125259";
  const redirectUri = "https://poppypooperz.com/oauth-callback.html";
  const scope = "identify guilds";

  const discordOAuthUrl = `https://discord.com/oauth2/authorize?client_id=1395218126211125259&response_type=code&redirect_uri=https%3A%2F%2Fpoppypooperz.com%2Foauth-callback.html&scope=identify+guilds`;

  window.location.href = discordOAuthUrl;
}

document.addEventListener("DOMContentLoaded", () => {
  const userInfoDiv = document.getElementById("user-info");
  const storedUser = localStorage.getItem("discordUser");

  if (storedUser) {
    const user = JSON.parse(storedUser);
    userInfoDiv.innerHTML = `Logged in as <strong>${user.username}#${user.discriminator}</strong>`;
  }
});
