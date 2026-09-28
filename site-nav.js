import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5tdmon0-6R_IABZyUo8QEfSKlTBrmLTo",
  authDomain: "markethub-prototype.firebaseapp.com",
  projectId: "markethub-prototype",
  storageBucket: "markethub-prototype.firebasestorage.app",
  messagingSenderId: "350124318634",
  appId: "1:350124318634:web:cb4401e9f84edcdd5995d3",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const accountMenu = document.getElementById("account-menu");
const accountMenuToggle = document.getElementById("account-menu-toggle");
const accountMenuDropdown = document.getElementById("account-menu-dropdown");
const accountMenuEmail = document.getElementById("account-menu-email");
const accountMenuLogout = document.getElementById("account-menu-logout");
const accountAvatarImage = document.getElementById("account-avatar-image");
const accountAvatarPlaceholder = document.getElementById("account-avatar-placeholder");
const authButton = document.getElementById("auth-button");
const userStatus = document.getElementById("user-status");

accountMenuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  const hidden = accountMenuDropdown?.classList.toggle("hidden");
  accountMenuToggle.setAttribute("aria-expanded", String(!hidden));
});

document.addEventListener("click", (event) => {
  if (accountMenu && !accountMenu.contains(event.target)) {
    accountMenuDropdown?.classList.add("hidden");
    accountMenuToggle?.setAttribute("aria-expanded", "false");
  }
});

accountMenuLogout?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

authButton?.addEventListener("click", () => {
  if (!auth.currentUser && !document.getElementById("auth-modal")) window.location.href = "index.html?login=1";
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    accountMenu?.classList.add("hidden");
    if (authButton) authButton.classList.remove("hidden");
    if (userStatus) userStatus.textContent = "Browsing as guest";
    return;
  }

  accountMenu?.classList.remove("hidden");
  if (authButton) authButton.classList.add("hidden");
  if (userStatus) userStatus.textContent = user.email || "Signed in";
  if (accountMenuEmail) accountMenuEmail.textContent = user.email || "";

  if (user.photoURL && accountAvatarImage) {
    accountAvatarImage.src = user.photoURL;
    accountAvatarImage.classList.remove("hidden");
    accountAvatarPlaceholder?.classList.add("hidden");
  } else {
    accountAvatarImage?.classList.add("hidden");
    accountAvatarPlaceholder?.classList.remove("hidden");
  }
});

const categoryDropdown = document.querySelector(".top-nav-dropdown");
const categoryDropdownToggle = document.querySelector(".top-nav-dropdown-toggle");
categoryDropdownToggle?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  categoryDropdown?.classList.toggle("open");
});
document.addEventListener("click", (event) => {
  if (categoryDropdown && !categoryDropdown.contains(event.target)) categoryDropdown.classList.remove("open");
});
categoryDropdown?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => categoryDropdown.classList.remove("open")));
