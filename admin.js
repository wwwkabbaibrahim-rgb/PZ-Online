import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
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

const $ = (id) => document.getElementById(id);

const accessMessage = $("access-message");
const dashboardContent = $("dashboard-content");

const totalListings = $("total-listings");
const totalConversations = $("total-conversations");
const recentListingsCount = $("recent-listings-count");
const totalReports = $("total-reports");
const totalUsers = $("total-users");
const totalReviews = $("total-reviews");

const reviewsLoading = $("reviews-loading");
const reviewsTable = $("reviews-table");
const reviewsTableBody = $("reviews-table-body");
const reviewsEmpty = $("reviews-empty");

const listingsLoading = $("listings-loading");
const listingsTable = $("listings-table");
const listingsTableBody = $("listings-table-body");
const listingsEmpty = $("listings-empty");
const listingsSearch = $("listings-search");
const listingsSelectAll = $("listings-select-all");
const listingsBulkToolbar = $("listings-bulk-toolbar");
const listingsSelectedCount = $("listings-selected-count");

const conversationsLoading = $("conversations-loading");
const conversationsTable = $("conversations-table");
const conversationsTableBody = $("conversations-table-body");
const conversationsEmpty = $("conversations-empty");

const reportsLoading = $("reports-loading");
const reportsTable = $("reports-table");
const reportsTableBody = $("reports-table-body");
const reportsEmpty = $("reports-empty");

const usersLoading = $("users-loading");
const usersTable = $("users-table");
const usersTableBody = $("users-table-body");
const usersEmpty = $("users-empty");
const usersSearch = $("users-search");

const activityLoading = $("activity-loading");
const activityTable = $("activity-table");
const activityTableBody = $("activity-table-body");
const activityEmpty = $("activity-empty");

let currentAdmin = null;
let allListings = [];
let visibleListings = [];
let allUsers = [];
let visibleUsers = [];
let allReports = [];
let verifiedIds = new Set();
let suspendedIds = new Set();
let selectedListingIds = new Set();
let editingListing = null;

/* ---------- helpers ---------- */

function showAccessDenied() {
  accessMessage.style.display = "block";
  dashboardContent.style.display = "none";
}

function showDashboard() {
  accessMessage.style.display = "none";
  dashboardContent.style.display = "block";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    if (typeof value.toDate === "function") return value.toDate().toLocaleString();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  } catch {
    return "—";
  }
}

function getTime(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

async function isAdmin(user) {
  if (!user) return false;
  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    return adminSnap.exists() && adminSnap.data().role === "admin";
  } catch (error) {
    console.error("Admin verification failed:", error);
    return false;
  }
}

/* ---------- activity log ---------- */

async function logActivity(action, targetType, targetLabel) {
  try {
    await addDoc(collection(db, "activityLogs"), {
      action,
      targetType,
      targetLabel: targetLabel || "",
      adminId: currentAdmin?.uid || "",
      adminEmail: currentAdmin?.email || "",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Could not write activity log:", error);
  }
}

async function loadActivity() {
  activityLoading.style.display = "block";
  activityTable.style.display = "none";
  activityEmpty.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "activityLogs"));
    const logs = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
      .slice(0, 50);

    activityTableBody.innerHTML = "";

    if (logs.length === 0) {
      activityLoading.style.display = "none";
      activityEmpty.style.display = "block";
      return;
    }

    logs.forEach((log) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(formatDate(log.createdAt))}</td>
        <td>${escapeHtml(log.adminEmail || "—")}</td>
        <td>${escapeHtml(log.action || "—")}</td>
        <td>${escapeHtml(log.targetType || "")}${log.targetLabel ? ": " + escapeHtml(log.targetLabel) : ""}</td>
      `;
      activityTableBody.appendChild(row);
    });

    activityLoading.style.display = "none";
    activityTable.style.display = "table";
  } catch (error) {
    console.error("Could not load activity log:", error);
    activityLoading.textContent = "Could not load activity log. Check the browser console.";
  }
}

/* ---------- CSV export ---------- */

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCSV(filename, headers, rows) {
  const lines = [headers.map(csvCell).join(",")];
  rows.forEach((row) => lines.push(row.map(csvCell).join(",")));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

$("export-listings-csv").addEventListener("click", () => {
  downloadCSV(
    `pz-listings-${dateStamp()}.csv`,
    ["ID", "Title", "Price", "Category", "Location", "Seller", "Seller phone", "Owner ID", "Featured", "Created"],
    visibleListings.map((l) => [
      l.id, l.title, l.price, l.category, l.location, l.sellerName, l.sellerPhone,
      l.ownerId, l.featured ? "yes" : "no", formatDate(l.createdAt)
    ])
  );
});

$("export-users-csv").addEventListener("click", () => {
  downloadCSV(
    `pz-users-${dateStamp()}.csv`,
    ["User ID", "Name", "Email", "Provider", "Email verified", "Verified seller", "Suspended", "Joined", "Last active"],
    visibleUsers.map((u) => [
      u.id, u.displayName, u.email, u.provider, u.emailVerified ? "yes" : "no",
      verifiedIds.has(u.id) ? "yes" : "no", suspendedIds.has(u.id) ? "yes" : "no",
      formatDate(u.createdAt), formatDate(u.lastLoginAt)
    ])
  );
});

$("export-reports-csv").addEventListener("click", () => {
  downloadCSV(
    `pz-reports-${dateStamp()}.csv`,
    ["Report ID", "Listing", "Listing ID", "Reason", "Reported by", "Details", "Status", "Date"],
    allReports.map((r) => [
      r.id, r.listingTitle, r.listingId, r.reason, r.reporterEmail || r.reporterId,
      r.details, r.status || "open", formatDate(r.createdAt)
    ])
  );
});

/* ---------- listings ---------- */

function updateBulkToolbar() {
  const count = selectedListingIds.size;
  listingsSelectedCount.textContent = `${count} selected`;
  listingsBulkToolbar.classList.toggle("visible", count > 0);

  const visibleIds = visibleListings.map((l) => l.id);
  listingsSelectAll.checked =
    visibleIds.length > 0 && visibleIds.every((id) => selectedListingIds.has(id));
}

function refreshListingStats() {
  totalListings.textContent = allListings.length;
  recentListingsCount.textContent = Math.min(allListings.length, 10);
}

function renderListings(listings) {
  visibleListings = listings;
  listingsTableBody.innerHTML = "";

  if (listings.length === 0) {
    listingsTable.style.display = "none";
    listingsEmpty.style.display = "block";
    updateBulkToolbar();
    return;
  }

  listingsEmpty.style.display = "none";

  listings.forEach((listing) => {
    const row = document.createElement("tr");
    const featured = !!listing.featured;

    row.innerHTML = `
      <td><input type="checkbox" class="listing-select" ${selectedListingIds.has(listing.id) ? "checked" : ""} aria-label="Select listing"></td>
      <td>
        <strong>${escapeHtml(listing.title || "Untitled listing")}</strong>${featured ? '<span class="featured-tag">⭐ Featured</span>' : ""}
        <div class="listing-id">${escapeHtml(listing.id)}</div>
      </td>
      <td>${escapeHtml(formatPrice(listing.price))}</td>
      <td>${escapeHtml(listing.category || "—")}</td>
      <td>${escapeHtml(listing.location || "—")}</td>
      <td>${escapeHtml(listing.sellerName || "—")}</td>
      <td>${escapeHtml(formatDate(listing.createdAt))}</td>
      <td>
        <div class="listing-actions">
          <button type="button" class="view-listing-button">View</button>
          <button type="button" class="edit-listing-button-admin">Edit</button>
          <button type="button" class="feature-toggle-button">${featured ? "Unfeature" : "⭐ Feature"}</button>
          <button type="button" class="delete-listing-button">Remove</button>
        </div>
      </td>
    `;

    row.querySelector(".listing-select").addEventListener("change", (event) => {
      if (event.target.checked) selectedListingIds.add(listing.id);
      else selectedListingIds.delete(listing.id);
      updateBulkToolbar();
    });

    row.querySelector(".view-listing-button").addEventListener("click", () => {
      window.location.href = `product.html?id=${encodeURIComponent(listing.id)}&from=admin`;
    });

    row.querySelector(".edit-listing-button-admin").addEventListener("click", () => {
      openEditModal(listing);
    });

    row.querySelector(".feature-toggle-button").addEventListener("click", () => {
      setFeatured([listing], !featured);
    });

    row.querySelector(".delete-listing-button").addEventListener("click", () => {
      removeListing(listing);
    });

    listingsTableBody.appendChild(row);
  });

  listingsTable.style.display = "table";
  updateBulkToolbar();
}

async function loadListings() {
  listingsLoading.style.display = "block";
  listingsTable.style.display = "none";
  listingsEmpty.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "listings"));

    allListings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    allListings.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

    refreshListingStats();
    filterListings();
    listingsLoading.style.display = "none";
  } catch (error) {
    console.error("Could not load listings:", error);
    totalListings.textContent = "Error";
    recentListingsCount.textContent = "Error";
    listingsLoading.textContent = "Could not load listings. Check the browser console for details.";
  }
}

function filterListings() {
  const queryText = listingsSearch.value.trim().toLowerCase();

  if (!queryText) {
    renderListings(allListings);
    return;
  }

  renderListings(
    allListings.filter((listing) =>
      [listing.title, listing.category, listing.location, listing.sellerName, listing.ownerId, listing.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(queryText)
    )
  );
}

async function removeListing(listing) {
  if (!listing?.id) return;

  const confirmed = confirm(
    `Remove "${listing.title || "this listing"}" from PZ Online?\n\nThis permanently deletes the listing from Firestore.`
  );
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "listings", listing.id));
    allListings = allListings.filter((item) => item.id !== listing.id);
    selectedListingIds.delete(listing.id);
    refreshListingStats();
    filterListings();
    logActivity("Deleted listing", "listing", listing.title || listing.id);
    loadActivity();
  } catch (error) {
    console.error("Could not remove listing:", error);
    alert("The listing could not be removed. Make sure the updated Firestore rules have been published.");
  }
}

async function setFeatured(listings, featured) {
  try {
    await Promise.all(
      listings.map((listing) => updateDoc(doc(db, "listings", listing.id), { featured }))
    );

    listings.forEach((listing) => {
      const match = allListings.find((item) => item.id === listing.id);
      if (match) match.featured = featured;
    });

    filterListings();
    logActivity(
      featured ? "Featured listing(s)" : "Unfeatured listing(s)",
      "listing",
      listings.length === 1 ? listings[0].title || listings[0].id : `${listings.length} listings`
    );
    loadActivity();
  } catch (error) {
    console.error("Could not update featured state:", error);
    alert("Could not update featured state. Make sure the updated Firestore rules have been published.");
  }
}

listingsSelectAll.addEventListener("change", (event) => {
  visibleListings.forEach((listing) => {
    if (event.target.checked) selectedListingIds.add(listing.id);
    else selectedListingIds.delete(listing.id);
  });
  renderListings(visibleListings);
});

function getSelectedListings() {
  return allListings.filter((listing) => selectedListingIds.has(listing.id));
}

$("bulk-feature-button").addEventListener("click", () => {
  const selected = getSelectedListings();
  if (selected.length) setFeatured(selected, true);
});

$("bulk-unfeature-button").addEventListener("click", () => {
  const selected = getSelectedListings();
  if (selected.length) setFeatured(selected, false);
});

$("bulk-delete-button").addEventListener("click", async () => {
  const selected = getSelectedListings();
  if (!selected.length) return;

  const confirmed = confirm(
    `Permanently delete ${selected.length} selected listing(s)?\n\nThis cannot be undone.`
  );
  if (!confirmed) return;

  try {
    await Promise.all(selected.map((l) => deleteDoc(doc(db, "listings", l.id))));
    const deletedIds = new Set(selected.map((l) => l.id));
    allListings = allListings.filter((l) => !deletedIds.has(l.id));
    selectedListingIds.clear();
    refreshListingStats();
    filterListings();
    logActivity("Bulk deleted listings", "listing", `${selected.length} listings`);
    loadActivity();
  } catch (error) {
    console.error("Bulk delete failed:", error);
    alert("Some listings could not be deleted. Please refresh and try again.");
  }
});

listingsSearch.addEventListener("input", filterListings);

/* ---------- edit listing modal ---------- */

const editModal = $("edit-listing-modal");

function openEditModal(listing) {
  editingListing = listing;
  $("edit-title").value = listing.title || "";
  $("edit-price").value = listing.price ?? "";
  $("edit-category").value = listing.category || "";
  $("edit-location").value = listing.location || "";
  $("edit-seller-name").value = listing.sellerName || "";
  $("edit-seller-phone").value = listing.sellerPhone || "";
  $("edit-description").value = listing.description || "";
  editModal.classList.add("open");
}

function closeEditModal() {
  editModal.classList.remove("open");
  editingListing = null;
}

$("edit-cancel").addEventListener("click", closeEditModal);

editModal.addEventListener("click", (event) => {
  if (event.target === editModal) closeEditModal();
});

$("edit-listing-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingListing) return;

  const priceValue = $("edit-price").value;

  const updates = {
    title: $("edit-title").value.trim(),
    price: priceValue === "" ? "" : Number(priceValue),
    category: $("edit-category").value.trim(),
    location: $("edit-location").value.trim(),
    sellerName: $("edit-seller-name").value.trim(),
    sellerPhone: $("edit-seller-phone").value.trim(),
    description: $("edit-description").value.trim()
  };

  try {
    await updateDoc(doc(db, "listings", editingListing.id), updates);

    const match = allListings.find((item) => item.id === editingListing.id);
    if (match) Object.assign(match, updates);

    logActivity("Edited listing", "listing", updates.title || editingListing.id);
    closeEditModal();
    filterListings();
    loadActivity();
  } catch (error) {
    console.error("Could not save listing:", error);
    alert("The listing could not be saved. Make sure the updated Firestore rules have been published.");
  }
});

/* ---------- users (verified seller + suspend) ---------- */

function renderUsers(users) {
  visibleUsers = users;
  usersTableBody.innerHTML = "";

  if (users.length === 0) {
    usersTable.style.display = "none";
    usersEmpty.style.display = "block";
    return;
  }

  usersEmpty.style.display = "none";

  users.forEach((user) => {
    const row = document.createElement("tr");
    const provider = user.provider === "google.com" ? "Google" : "Email & password";
    const isVerified = verifiedIds.has(user.id);
    const isSuspended = suspendedIds.has(user.id);

    row.innerHTML = `
      <td>${escapeHtml(user.displayName || "—")}<div class="listing-id">${escapeHtml(user.id)}</div></td>
      <td>${escapeHtml(user.email || "—")}</td>
      <td>${escapeHtml(provider)}</td>
      <td>${user.emailVerified ? "Yes" : "No"}</td>
      <td>${escapeHtml(formatDate(user.createdAt))}</td>
      <td>${escapeHtml(formatDate(user.lastLoginAt))}</td>
      <td><button type="button" class="badge-toggle verify-toggle ${isVerified ? "on" : "off"}">${isVerified ? "✓ Verified" : "Not verified"}</button></td>
      <td>
        <span class="status ${isSuspended ? "suspended" : ""}">${isSuspended ? "Suspended" : "Active"}</span>
        <button type="button" class="suspend-toggle-button ${isSuspended ? "unsuspend" : "suspend"}">${isSuspended ? "Unsuspend" : "Suspend"}</button>
      </td>
    `;

    row.querySelector(".verify-toggle").addEventListener("click", () => toggleVerified(user, !isVerified));
    row.querySelector(".suspend-toggle-button").addEventListener("click", () => toggleSuspended(user, !isSuspended));

    usersTableBody.appendChild(row);
  });

  usersTable.style.display = "table";
}

async function toggleVerified(user, makeVerified) {
  try {
    if (makeVerified) {
      await setDoc(doc(db, "verifiedSellers", user.id), {
        verified: true,
        email: user.email || "",
        verifiedAt: serverTimestamp()
      });
      verifiedIds.add(user.id);
    } else {
      await deleteDoc(doc(db, "verifiedSellers", user.id));
      verifiedIds.delete(user.id);
    }

    filterUsers();
    logActivity(makeVerified ? "Verified seller" : "Removed verified badge", "user", user.email || user.id);
    loadActivity();
  } catch (error) {
    console.error("Could not update verified state:", error);
    alert("Could not update the verified badge. Make sure the updated Firestore rules have been published.");
  }
}

async function toggleSuspended(user, suspend) {
  const confirmed = confirm(
    suspend
      ? `Suspend ${user.email || "this user"}?\n\nThey will be signed out, blocked from logging in, and unable to post new listings.`
      : `Unsuspend ${user.email || "this user"}?`
  );
  if (!confirmed) return;

  try {
    if (suspend) {
      await setDoc(doc(db, "suspensions", user.id), {
        suspended: true,
        email: user.email || "",
        suspendedAt: serverTimestamp()
      });
      suspendedIds.add(user.id);
    } else {
      await deleteDoc(doc(db, "suspensions", user.id));
      suspendedIds.delete(user.id);
    }

    filterUsers();
    logActivity(suspend ? "Suspended user" : "Unsuspended user", "user", user.email || user.id);
    loadActivity();
  } catch (error) {
    console.error("Could not update suspension:", error);
    alert("Could not update the suspension. Make sure the updated Firestore rules have been published.");
  }
}

async function loadUsers() {
  usersLoading.style.display = "block";
  usersTable.style.display = "none";
  usersEmpty.style.display = "none";

  try {
    // Load each admin dataset independently so one missing/older permission
    // does not blank the entire Users section.
    let usersSnap = null;
    let verifiedSnap = null;
    let suspensionsSnap = null;

    try { usersSnap = await getDocs(collection(db, "users")); }
    catch (error) { console.error("Users collection could not be read:", error); throw error; }

    try { verifiedSnap = await getDocs(collection(db, "verifiedSellers")); }
    catch (error) { console.warn("Verified sellers could not be read:", error); verifiedSnap = { docs: [] }; }

    try { suspensionsSnap = await getDocs(collection(db, "suspensions")); }
    catch (error) { console.warn("Suspensions could not be read:", error); suspensionsSnap = { docs: [] }; }

    allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    verifiedIds = new Set(verifiedSnap.docs.map((d) => d.id));
    suspendedIds = new Set(
      suspensionsSnap.docs.filter((d) => d.data().suspended === true).map((d) => d.id)
    );

    allUsers.sort(
      (a, b) => getTime(b.lastLoginAt || b.createdAt) - getTime(a.lastLoginAt || a.createdAt)
    );

    totalUsers.textContent = allUsers.length;
    filterUsers();
    usersLoading.style.display = "none";
  } catch (error) {
    console.error("Could not load users:", error);
    totalUsers.textContent = "Error";
    usersLoading.textContent = "Could not load users. The Firestore admin read permission needs to be published.";
  }
}

function filterUsers() {
  const queryText = usersSearch.value.trim().toLowerCase();

  if (!queryText) {
    renderUsers(allUsers);
    return;
  }

  renderUsers(
    allUsers.filter((user) =>
      [user.displayName, user.email, user.provider, user.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(queryText)
    )
  );
}

usersSearch.addEventListener("input", filterUsers);

/* ---------- conversations ---------- */

async function loadConversations() {
  conversationsLoading.style.display = "block";
  conversationsTable.style.display = "none";
  conversationsEmpty.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "conversations"));
    const conversations = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    conversations.sort(
      (a, b) => getTime(b.lastMessageAt || b.createdAt) - getTime(a.lastMessageAt || a.createdAt)
    );

    totalConversations.textContent = conversations.length;
    conversationsTableBody.innerHTML = "";

    const recent = conversations.slice(0, 10);

    if (recent.length === 0) {
      conversationsLoading.style.display = "none";
      conversationsEmpty.style.display = "block";
      return;
    }

    recent.forEach((conversation) => {
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
    conversationsLoading.textContent = "Conversations could not be loaded. Check the browser console for details.";
  }
}

/* ---------- reports ---------- */

async function loadReports() {
  reportsLoading.style.display = "block";
  reportsTable.style.display = "none";
  reportsEmpty.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "reports"));
    const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    reports.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
    allReports = reports;

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
          <button type="button" class="admin-listing-link report-listing-link">
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

      row.querySelector(".report-listing-link").addEventListener("click", () => {
        if (report.listingId) {
          window.location.href = `product.html?id=${encodeURIComponent(report.listingId)}&from=admin`;
        }
      });

      async function toggleReportStatus() {
        const newStatus = status === "resolved" ? "open" : "resolved";

        try {
          await updateDoc(doc(db, "reports", report.id), { status: newStatus });
          logActivity(
            newStatus === "resolved" ? "Resolved report" : "Reopened report",
            "report",
            report.listingTitle || report.id
          );
          await loadReports();
          loadActivity();
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
    reportsLoading.textContent = "Reports could not be loaded. Check the browser console for details.";
  }
}

/* ---------- reviews moderation ---------- */

async function loadReviews() {
  if (!reviewsLoading || !reviewsTable || !reviewsTableBody || !reviewsEmpty) return;

  reviewsLoading.style.display = "block";
  reviewsTable.style.display = "none";
  reviewsEmpty.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "reviews"));
    const reviews = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

    if (totalReviews) totalReviews.textContent = reviews.length;
    reviewsTableBody.innerHTML = "";

    if (!reviews.length) {
      reviewsLoading.style.display = "none";
      reviewsEmpty.style.display = "block";
      return;
    }

    reviews.slice(0, 100).forEach((review) => {
      const row = document.createElement("tr");
      const rating = Math.max(0, Math.min(5, Number(review.rating || 0)));
      row.innerHTML = `
        <td>${escapeHtml(review.revieweeName || review.revieweeId || "Seller")}</td>
        <td>${"★".repeat(rating)}${"☆".repeat(5 - rating)}</td>
        <td>${escapeHtml(review.reviewerName || review.reviewerId || "Buyer")}</td>
        <td>${escapeHtml(review.comment || "No written review")}</td>
        <td>${escapeHtml(formatDate(review.createdAt))}</td>
        <td><button type="button" class="delete-review-button delete-listing-button">Remove</button></td>
      `;

      row.querySelector(".delete-review-button").addEventListener("click", async () => {
        if (!confirm("Remove this review from PZ Online?")) return;
        try {
          await deleteDoc(doc(db, "reviews", review.id));
          await logActivity("Removed review", "review", review.revieweeName || review.id);
          await loadReviews();
          await loadActivity();
        } catch (error) {
          console.error("Could not remove review:", error);
          alert("The review could not be removed. Make sure the updated Firestore rules have been published.");
        }
      });

      reviewsTableBody.appendChild(row);
    });

    reviewsLoading.style.display = "none";
    reviewsTable.style.display = "table";
  } catch (error) {
    console.error("Could not load reviews:", error);
    if (totalReviews) totalReviews.textContent = "Error";
    reviewsLoading.textContent = "Reviews could not be loaded. Publish the updated Firestore rules, then refresh this page.";
  }
}

/* ---------- category manager ---------- */

const categoryList = $("category-list");
const categoryEmpty = $("category-empty");
let customCategories = [];

function renderCategories() {
  categoryList.innerHTML = "";
  categoryEmpty.style.display = customCategories.length === 0 ? "block" : "none";

  customCategories.forEach((category) => {
    const chip = document.createElement("div");
    chip.className = "category-chip";
    chip.innerHTML = `<span>${escapeHtml(category.icon || "🏷️")} ${escapeHtml(category.name)}</span>
      <button type="button" aria-label="Delete category" title="Delete category">×</button>`;

    chip.querySelector("button").addEventListener("click", async () => {
      const confirmed = confirm(
        `Delete the "${category.name}" category?\n\nExisting listings in this category keep their label, but the category will no longer appear as a filter or in the posting form.`
      );
      if (!confirmed) return;

      try {
        await deleteDoc(doc(db, "categories", category.id));
        customCategories = customCategories.filter((c) => c.id !== category.id);
        renderCategories();
        logActivity("Deleted category", "category", category.name);
        loadActivity();
      } catch (error) {
        console.error("Could not delete category:", error);
        alert("Could not delete the category. Make sure the updated Firestore rules have been published.");
      }
    });

    categoryList.appendChild(chip);
  });
}

async function loadCategories() {
  try {
    const snapshot = await getDocs(collection(db, "categories"));
    customCategories = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    renderCategories();
  } catch (error) {
    console.error("Could not load categories:", error);
  }
}

$("category-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const nameInput = $("new-category-name");
  const iconInput = $("new-category-icon");
  const name = nameInput.value.trim();
  const icon = iconInput.value.trim() || "🏷️";

  if (!name) return;

  if (customCategories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    alert("That category already exists.");
    return;
  }

  try {
    const ref = await addDoc(collection(db, "categories"), {
      name,
      icon,
      order: Date.now()
    });

    customCategories.push({ id: ref.id, name, icon, order: Date.now() });
    renderCategories();
    nameInput.value = "";
    iconInput.value = "";
    logActivity("Added category", "category", name);
    loadActivity();
  } catch (error) {
    console.error("Could not add category:", error);
    alert("Could not add the category. Make sure the updated Firestore rules have been published.");
  }
});

/* ---------- site banner ---------- */

const bannerEnabled = $("banner-enabled");
const bannerMessage = $("banner-message");
const bannerSaveStatus = $("banner-save-status");

async function loadBanner() {
  try {
    const snap = await getDoc(doc(db, "settings", "banner"));
    if (snap.exists()) {
      const data = snap.data();
      bannerEnabled.checked = !!data.enabled;
      bannerMessage.value = data.message || "";
    }
  } catch (error) {
    console.error("Could not load banner:", error);
  }
}

$("banner-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await setDoc(doc(db, "settings", "banner"), {
      enabled: bannerEnabled.checked,
      message: bannerMessage.value.trim(),
      updatedAt: serverTimestamp()
    });

    bannerSaveStatus.textContent = "Saved ✓";
    setTimeout(() => (bannerSaveStatus.textContent = ""), 2500);
    logActivity(bannerEnabled.checked ? "Updated site banner (on)" : "Updated site banner (off)", "banner", bannerMessage.value.trim().slice(0, 60));
    loadActivity();
  } catch (error) {
    console.error("Could not save banner:", error);
    alert("Could not save the banner. Make sure the updated Firestore rules have been published.");
  }
});

/* ---------- boot ---------- */

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

  currentAdmin = user;
  showDashboard();

  await Promise.allSettled([
    loadListings(),
    loadConversations(),
    loadReports(),
    loadUsers(),
    loadReviews(),
    loadCategories(),
    loadBanner(),
    loadActivity()
  ]);
});
