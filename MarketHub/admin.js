import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5tdmon0-6R_IABZyUo8QEfSKlTBrmLTo",
  authDomain: "markethub-prototype.firebaseapp.com",
  projectId: "markethub-prototype",
  storageBucket: "markethub-prototype.firebasestorage.app",
  messagingSenderId: "350124318634",
  appId: "1:350124318634:web:cb4401e9f84edcdd5995d3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const accessMessage = document.getElementById("access-message");
const dashboardContent = document.getElementById("dashboard-content");

const totalListings = document.getElementById("total-listings");
const totalConversations = document.getElementById("total-conversations");
const recentListingsCount = document.getElementById("recent-listings-count");
const totalReports = document.getElementById("total-reports");

const totalUsers = document.getElementById("total-users");

const usersLoading = document.getElementById("users-loading");
const usersTable = document.getElementById("users-table");
const usersTableBody = document.getElementById("users-table-body");
const usersEmpty = document.getElementById("users-empty");
const usersSearch = document.getElementById("users-search");

let allUsers = [];

const listingsLoading = document.getElementById("listings-loading");
const listingsTable = document.getElementById("listings-table");
const listingsTableBody = document.getElementById("listings-table-body");
const listingsEmpty = document.getElementById("listings-empty");
const listingsSearch = document.getElementById("listings-search");

const conversationsLoading = document.getElementById("conversations-loading");
const conversationsTable = document.getElementById("conversations-table");
const conversationsTableBody = document.getElementById("conversations-table-body");
const conversationsEmpty = document.getElementById("conversations-empty");

const reportsLoading = document.getElementById("reports-loading");
const reportsTable = document.getElementById("reports-table");
const reportsTableBody = document.getElementById("reports-table-body");
const reportsEmpty = document.getElementById("reports-empty");

let allListings = [];

function showAccessDenied() {
  accessMessage.style.display = "block";
  dashboardContent.style.display = "none";
}

function showDashboard() {
  accessMessage.style.display = "none";
  dashboardContent.style.display = "block";
}

function formatPrice(price) {
  if (price === undefined || price === null || price === "") return "—";

  const number = Number(price);

  if (Number.isNaN(number)) return String(price);

  return number.toLocaleString();
}

function formatDate(value) {
  if (!value) return "—";

  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleString();
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
  } catch {
    return "—";
  }
}

function getTime(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

async function isAdmin(user) {
  if (!user) return false;

  try {
    const adminRef = doc(db, "admins", user.uid);
    const adminSnap = await getDoc(adminRef);

    return adminSnap.exists() && adminSnap.data().role === "admin";
  } catch (error) {
    console.error("Admin verification failed:", error);
    return false;
  }
}

function renderListings(listings) {
  listingsTableBody.innerHTML = "";

  if (listings.length === 0) {
    listingsTable.style.display = "none";
    listingsEmpty.style.display = "block";
    return;
  }

  listingsEmpty.style.display = "none";

  listings.forEach((listing) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <strong>${escapeHtml(listing.title || "Untitled listing")}</strong>
        <div class="listing-id">${escapeHtml(listing.id)}</div>
      </td>
      <td>${escapeHtml(formatPrice(listing.price))}</td>
      <td>${escapeHtml(listing.category || "—")}</td>
      <td>${escapeHtml(listing.location || "—")}</td>
      <td>${escapeHtml(listing.sellerName || "—")}</td>
      <td>${escapeHtml(formatDate(listing.createdAt))}</td>
      <td>
        <div class="listing-actions">
          <button
            type="button"
            class="view-listing-button"
            data-listing-id="${escapeHtml(listing.id)}"
          >
            View
          </button>
          <button
            type="button"
            class="delete-listing-button"
            data-listing-id="${escapeHtml(listing.id)}"
          >
            Remove
          </button>
        </div>
      </td>
    `;

    row.querySelector(".view-listing-button").addEventListener("click", () => {
      window.location.href =
        `product.html?id=${encodeURIComponent(listing.id)}&from=admin`;
    });

    row.querySelector(".delete-listing-button").addEventListener("click", () => {
      removeListing(listing);
    });

    listingsTableBody.appendChild(row);
  });

  listingsTable.style.display = "table";
}

async function loadListings() {
  listingsLoading.style.display = "block";
  listingsTable.style.display = "none";
  listingsEmpty.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "listings"));

    allListings = snapshot.docs.map((listingDoc) => ({
      id: listingDoc.id,
      ...listingDoc.data()
    }));

    allListings.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

    totalListings.textContent = allListings.length;
    recentListingsCount.textContent = Math.min(allListings.length, 10);

    renderListings(allListings);

    listingsLoading.style.display = "none";
  } catch (error) {
    console.error("Could not load listings:", error);

    totalListings.textContent = "Error";
    recentListingsCount.textContent = "Error";
    listingsLoading.textContent =
      "Could not load listings. Check the browser console for details.";
  }
}

function filterListings() {
  const query = listingsSearch.value.trim().toLowerCase();

  if (!query) {
    renderListings(allListings);
    return;
  }

  const filtered = allListings.filter((listing) => {
    const searchableText = [
      listing.title,
      listing.category,
      listing.location,
      listing.sellerName,
      listing.ownerId,
      listing.id
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  renderListings(filtered);
}

async function removeListing(listing) {
  if (!listing?.id) return;

  const title = listing.title || "this listing";

  const confirmed = confirm(
    `Remove "${title}" from PZ Online?\n\nThis permanently deletes the listing from Firestore.`
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "listings", listing.id));

    allListings = allListings.filter((item) => item.id !== listing.id);

    totalListings.textContent = allListings.length;
    recentListingsCount.textContent = Math.min(allListings.length, 10);

    filterListings();

    alert("Listing removed successfully.");
  } catch (error) {
    console.error("Could not remove listing:", error);
    alert(
      "The listing could not be removed. Make sure the updated Firestore rules have been published."
    );
  }
}

async function loadConversations() {
  conversationsLoading.style.display = "block";
  conversationsTable.style.display = "none";
  conversationsEmpty.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "conversations"));

    const conversations = snapshot.docs.map((conversationDoc) => ({
      id: conversationDoc.id,
      ...conversationDoc.data()
    }));

    conversations.sort(
      (a, b) =>
        getTime(b.lastMessageAt || b.createdAt) -
        getTime(a.lastMessageAt || a.createdAt)
    );

    totalConversations.textContent = conversations.length;
    conversationsTableBody.innerHTML = "";

    const recentConversations = conversations.slice(0, 10);

    if (recentConversations.length === 0) {
      conversationsLoading.style.display = "none";
      conversationsEmpty.style.display = "block";
      return;
    }

    recentConversations.forEach((conversation) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${escapeHtml(conversation.listingTitle || "Listing")}</td>
        <td>${escapeHtml(conversation.buyerEmail || "—")}</td>
        <td>${escapeHtml(conversation.sellerName || "—")}</td>
        <td>${escapeHtml(conversation.lastMessage || "No messages yet")}</td>
        <td><span class="status">Active</span></td>
      `;

      conversationsTableBody.appendChild(row);
    });

    conversationsLoading.style.display = "none";
    conversationsTable.style.display = "table";
  } catch (error) {
    console.error("Could not load conversations:", error);
    totalConversations.textContent = "Error";
    conversationsLoading.textContent =
      "Conversations could not be loaded. Check the browser console for details.";
  }
}

function renderUsers(users) {
  usersTableBody.innerHTML = "";

  if (users.length === 0) {
    usersTable.style.display = "none";
    usersEmpty.style.display = "block";
    return;
  }

  usersEmpty.style.display = "none";

  users.forEach((user) => {
    const row = document.createElement("tr");
    const name = user.displayName || "—";
    const provider =
      user.provider === "google.com" ? "Google" : "Email & password";

    row.innerHTML = `
      <td>${escapeHtml(name)}<div class="listing-id">${escapeHtml(user.id)}</div></td>
      <td>${escapeHtml(user.email || "—")}</td>
      <td>${escapeHtml(provider)}</td>
      <td>${user.emailVerified ? "Yes" : "No"}</td>
      <td>${escapeHtml(formatDate(user.createdAt))}</td>
      <td>${escapeHtml(formatDate(user.lastLoginAt))}</td>
    `;

    usersTableBody.appendChild(row);
  });

  usersTable.style.display = "table";
}

async function loadUsers() {
  usersLoading.style.display = "block";
  usersTable.style.display = "none";
  usersEmpty.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "users"));

    allUsers = snapshot.docs.map((userDoc) => ({
      id: userDoc.id,
      ...userDoc.data()
    }));

    allUsers.sort(
      (a, b) => getTime(b.lastLoginAt || b.createdAt) - getTime(a.lastLoginAt || a.createdAt)
    );

    totalUsers.textContent = allUsers.length;

    renderUsers(allUsers);

    usersLoading.style.display = "none";
  } catch (error) {
    console.error("Could not load users:", error);
    totalUsers.textContent = "Error";
    usersLoading.textContent =
      "Could not load users. Check the browser console for details.";
  }
}

function filterUsers() {
  const query = usersSearch.value.trim().toLowerCase();

  if (!query) {
    renderUsers(allUsers);
    return;
  }

  const filtered = allUsers.filter((user) => {
    const searchableText = [
      user.displayName,
      user.email,
      user.provider,
      user.id
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  renderUsers(filtered);
}

usersSearch?.addEventListener("input", filterUsers);

async function loadReports() {
  reportsLoading.style.display = "block";
  reportsTable.style.display = "none";
  reportsEmpty.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "reports"));

    const reports = snapshot.docs.map((reportDoc) => ({
      id: reportDoc.id,
      ...reportDoc.data()
    }));

    reports.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

    totalReports.textContent = reports.filter(
      (report) => (report.status || "open").toLowerCase() === "open"
    ).length;

    reportsTableBody.innerHTML = "";

    if (reports.length === 0) {
      reportsLoading.style.display = "none";
      reportsEmpty.style.display = "block";
      return;
    }

    reports.forEach((report) => {
      const row = document.createElement("tr");
      const status = (report.status || "open").toLowerCase();

      row.innerHTML = `
        <td>
          <button
            type="button"
            class="admin-listing-link report-listing-link"
            data-listing-id="${escapeHtml(report.listingId || "")}"
          >
            ${escapeHtml(report.listingTitle || "Untitled listing")}
          </button>
        </td>
        <td>${escapeHtml(report.reason || "Other")}</td>
        <td>${escapeHtml(report.reporterEmail || report.reporterId || "—")}</td>
        <td>${escapeHtml(report.details || "—")}</td>
        <td>${escapeHtml(formatDate(report.createdAt))}</td>
        <td>
          <button type="button" class="report-status-toggle-button report-status ${status === "resolved" ? "resolved" : "open"}">
            ${escapeHtml(status)}
          </button>
        </td>
        <td>
          <button type="button" class="view-listing-button toggle-report-status-button">
            ${status === "resolved" ? "Reopen" : "Mark resolved"}
          </button>
        </td>
      `;

      const listingLink = row.querySelector(".report-listing-link");

      listingLink.addEventListener("click", () => {
        if (report.listingId) {
          window.location.href =
            `product.html?id=${encodeURIComponent(report.listingId)}&from=admin`;
        }
      });

      async function toggleReportStatus() {
        const newStatus = status === "resolved" ? "open" : "resolved";

        try {
          await updateDoc(doc(db, "reports", report.id), { status: newStatus });
          await loadReports();
        } catch (error) {
          console.error("Could not update report status:", error);
          alert("The report status could not be updated. Please try again.");
        }
      }

      row.querySelector(".toggle-report-status-button").addEventListener("click", toggleReportStatus);
      row.querySelector(".report-status-toggle-button").addEventListener("click", toggleReportStatus);

      reportsTableBody.appendChild(row);
    });

    reportsLoading.style.display = "none";
    reportsTable.style.display = "table";
  } catch (error) {
    console.error("Could not load reports:", error);
    totalReports.textContent = "Error";
    reportsLoading.textContent =
      "Reports could not be loaded. Check the browser console for details.";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

listingsSearch.addEventListener("input", filterListings);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showAccessDenied();
    return;
  }

  const admin = await isAdmin(user);

  if (!admin) {
    showAccessDenied();
    return;
  }

  showDashboard();

  await loadListings();
  await loadConversations();
  await loadReports();
  await loadUsers();
});
