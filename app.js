import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
/*
  Paste the Firebase configuration from your Firebase Console here.
  Project settings → General → Your apps → SDK setup and configuration.
*/
const firebaseConfig = {
  apiKey: "AIzaSyD5tdmon0-6R_IABZyUo8QEfSKlTBrmLTo",
  authDomain: "markethub-prototype.firebaseapp.com",
  projectId: "markethub-prototype",
  storageBucket: "markethub-prototype.firebasestorage.app",
  messagingSenderId: "350124318634",
  appId: "1:350124318634:web:cb4401e9f84edcdd5995d3"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const CLOUDINARY_CLOUD_NAME = "sgagbjny";
const CLOUDINARY_UPLOAD_PRESET = "marketplace_unsigned";

// Keeps a /users/{uid} profile document in sync so the admin dashboard
// can list every registered/signed-in user.
async function syncUserProfile(user) {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const existingSnap = await getDoc(userRef);

    const baseData = {
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      provider: user.providerData[0]?.providerId || "password",
      emailVerified: !!user.emailVerified,
      lastLoginAt: serverTimestamp(),
    };

    if (existingSnap.exists()) {
      await setDoc(userRef, baseData, { merge: true });
    } else {
      await setDoc(userRef, { ...baseData, createdAt: serverTimestamp() });
    }
  } catch (error) {
    console.error("Could not sync user profile:", error);
  }
}

const listingGrid = document.getElementById("listing-grid");
const listingCount = document.getElementById("listing-count");
const emptyMessage = document.getElementById("empty-message");
const loadMoreButton = document.getElementById("load-more-button");
const loadMoreSentinel = document.getElementById("load-more-sentinel");
const trendingSection = document.getElementById("trending-section");
const trendingCarousel = document.getElementById("trending-carousel");
const trendingPrevButton = document.getElementById("trending-prev");
const trendingNextButton = document.getElementById("trending-next");

const myListingsSection = document.getElementById("my-listings");
const myListingGrid = document.getElementById("my-listing-grid");
const myListingsMessage = document.getElementById("my-listings-message");
const dashboardPostAdButton = document.getElementById("dashboard-post-ad");
const profileButton = document.getElementById("profile-button");
const profileModal = document.getElementById("profile-modal");
const closeProfileModalButton = document.getElementById("close-profile-modal");
const profileEmail = document.getElementById("profile-email");
const profileListingCount = document.getElementById("profile-listing-count");
const profileViewListingsButton = document.getElementById("profile-view-listings");
const profileViewFavouritesButton = document.getElementById(
  "profile-view-favourites"
);
const myFavouritesList = document.getElementById("my-favourites-list");
const myFavouritesEmpty = document.getElementById("my-favourites-empty");

const profileLogoutButton = document.getElementById("profile-logout");
const profileDeleteAccountButton = document.getElementById("profile-delete-account");
const profileAvatarImage = document.getElementById("profile-avatar-image");
const profileAvatarPlaceholder = document.getElementById("profile-avatar-placeholder");
const profilePhotoInput = document.getElementById("profile-photo-input");
const profilePhotoStatus = document.getElementById("profile-photo-status");

const accountMenu = document.getElementById("account-menu");
const accountMenuToggle = document.getElementById("account-menu-toggle");
const accountMenuDropdown = document.getElementById("account-menu-dropdown");
const accountMenuEmail = document.getElementById("account-menu-email");
const accountMenuLogout = document.getElementById("account-menu-logout");
const accountAvatarImage = document.getElementById("account-avatar-image");
const accountAvatarPlaceholder = document.getElementById("account-avatar-placeholder");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const locationFilter = document.getElementById("location-filter");
const minPriceInput = document.getElementById("min-price");
const maxPriceInput = document.getElementById("max-price");
const priceFilterButton = document.getElementById("price-filter");
const clearPriceFilterButton = document.getElementById("clear-price-filter");
const categoryButtons = document.querySelectorAll(".category");

const listingModal = document.getElementById("listing-modal");
const contactModal = document.getElementById("contact-modal");
const authModal = document.getElementById("auth-modal");
const offerModal = document.getElementById("offer-modal");
const closeOfferModalButton = document.getElementById("close-offer-modal");
const offerForm = document.getElementById("offer-form");
const offerListingTitle = document.getElementById("offer-listing-title");
const offerAmount = document.getElementById("offer-amount");
const offerMessage = document.getElementById("offer-message");
const reportModal = document.getElementById("report-modal");
const closeReportModalButton = document.getElementById("close-report-modal");
const reportForm = document.getElementById("report-form");
const reportListingTitle = document.getElementById("report-listing-title");
const reportReason = document.getElementById("report-reason");
const reportDetails = document.getElementById("report-details");

const openListingFormButton = document.getElementById("open-listing-form");
const closeListingFormButton = document.getElementById("close-listing-form");
const closeContactModalButton = document.getElementById("close-contact-modal");
const closeAuthModalButton = document.getElementById("close-auth-modal");

const listingForm = document.getElementById("listing-form");
const imageFileInput = document.getElementById("image-file");
const imageHiddenInput = document.getElementById("image");
const imagePreviewGrid = document.getElementById("image-preview-grid");
const imageUploadStatus = document.getElementById("image-upload-status");
const imagesHiddenInput = document.getElementById("images");
let isImageUploading = false;
const contactListingTitle = document.getElementById("contact-listing-title");
const sellerContactDetails = document.getElementById("seller-contact-details");
const callSellerButton = document.getElementById("call-seller-button");
const whatsappSellerButton = document.getElementById("whatsapp-seller-button");
const messageSellerButton = document.getElementById("message-seller-button");
const blockSellerButton = document.getElementById("block-seller-button");
let currentContactListing = null;

const authButton = document.getElementById("auth-button");
const userStatus = document.getElementById("user-status");
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authDescription = document.getElementById("auth-description");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const authSwitchQuestion = document.getElementById("auth-switch-question");
const authSwitchButton = document.getElementById("auth-switch-button");
const googleSigninButton = document.getElementById("google-signin-button");

let listings = [];
let selectedCategory = "All";
let currentUser = null;
let favoriteListingIds = new Set();
let blockedUserIds = new Set();
let currentOfferListing = null;
let currentReportListing = null;
async function loadFavoriteListings() {
  if (!currentUser) {
    favoriteListingIds = new Set();
    return;
  }

  try {
    const favoritesRef = collection(
      db,
      "users",
      currentUser.uid,
      "favorites"
    );

    const snapshot = await getDocs(favoritesRef);

    favoriteListingIds = new Set(
      snapshot.docs.map((favorite) => favorite.id)
    );
   renderListings();
renderMyFavourites();
  } catch (error) {
    console.error("Could not load favourites:", error);
    favoriteListingIds = new Set();
  }
}
async function loadBlockedUsers() {
  if (!currentUser) {
    blockedUserIds = new Set();
    return;
  }

  try {
    const blockedRef = collection(db, "users", currentUser.uid, "blockedUsers");
    const snapshot = await getDocs(blockedRef);
    blockedUserIds = new Set(snapshot.docs.map((blocked) => blocked.id));
  } catch (error) {
    console.error("Could not load blocked users:", error);
    blockedUserIds = new Set();
  }
}

function renderMyFavourites() {
  myFavouritesList.innerHTML = "";

  if (!currentUser || favoriteListingIds.size === 0) {
    myFavouritesEmpty.textContent =
      "You haven't added any favourites yet.";

    myFavouritesList.appendChild(myFavouritesEmpty);
    return;
  }

  const favouriteListings = listings.filter((listing) =>
    favoriteListingIds.has(listing.id) && !blockedUserIds.has(listing.ownerId)
  );

  if (favouriteListings.length === 0) {
    myFavouritesEmpty.textContent =
      "Your favourite listings are no longer available.";

    myFavouritesList.appendChild(myFavouritesEmpty);
    return;
  }

  favouriteListings.forEach((listing) => {
    myFavouritesList.appendChild(createListingCard(listing));
  });
}

let authMode = "signup";

function formatPrice(price) {
  const formattedNumber = new Intl.NumberFormat("en-SL", {
    maximumFractionDigits: 0,
  }).format(price);

  return `Le ${formattedNumber}`;
}

function formatListingDate(timestamp) {
  if (!timestamp || !timestamp.toDate) {
    return "Just now";
  }

  const postedDate = timestamp.toDate();
  const differenceInDays = Math.floor(
    (Date.now() - postedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (differenceInDays === 0) return "Today";
  if (differenceInDays === 1) return "Yesterday";
  return `${differenceInDays} days ago`;
}

function createListingCard(listing) {
  const card = document.createElement("article");
  const favoriteButton = document.createElement("button");
favoriteButton.type = "button";
favoriteButton.className = "favorite-button";
favoriteButton.textContent =
  favoriteListingIds.has(listing.id) ? "♥" : "♡";

favoriteButton.setAttribute(
  "aria-label",
  favoriteListingIds.has(listing.id)
    ? "Remove from favourites"
    : "Add to favourites"
);

favoriteButton.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (!currentUser) {
    setAuthMode("login");
    authModal.classList.remove("hidden");
    return;
  }

  const favoriteRef = doc(
    db,
    "users",
    currentUser.uid,
    "favorites",
    listing.id
  );

  try {
    if (favoriteListingIds.has(listing.id)) {
      await deleteDoc(favoriteRef);

      favoriteListingIds.delete(listing.id);

      favoriteButton.textContent = "♡";
      renderMyFavourites();
      favoriteButton.setAttribute(
        "aria-label",
        "Add to favourites"
      );
    } else {
      await setDoc(favoriteRef, {
        listingId: listing.id,
        createdAt: serverTimestamp(),
      });

      favoriteListingIds.add(listing.id);

      favoriteButton.textContent = "♥";
      renderMyFavourites();
      favoriteButton.setAttribute(
        "aria-label",
        "Remove from favourites"
      );
    }
  } catch (error) {
    console.error("Favourite error:", error);
    alert("Could not update your favourite. Please try again.");
  }
});
  card.className = "listing-card";

  const imageLink = document.createElement("a");
  imageLink.className = "listing-image-link";
  imageLink.href = `product.html?id=${listing.id}`;

  const image = document.createElement("img");
  image.className = "listing-image";
  image.loading = "lazy";
  image.decoding = "async";
  image.src =
    (Array.isArray(listing.images) && listing.images[0]) || listing.image ||
    "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80";
  image.alt = listing.title;

  image.onerror = () => {
    image.src =
      "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80";
  };

  imageLink.appendChild(image);

  const content = document.createElement("div");
  content.className = "listing-content";

  const category = document.createElement("span");
  category.className = "listing-category";
  category.textContent = listing.category;

  const title = document.createElement("h3");
  title.className = "listing-title";

  const titleLink = document.createElement("a");
  titleLink.className = "listing-title-link";
  titleLink.href = `product.html?id=${listing.id}`;
  titleLink.textContent = listing.title;

  title.appendChild(titleLink);

  const price = document.createElement("p");
  price.className = "listing-price";
  price.textContent = formatPrice(listing.price);

  const meta = document.createElement("div");
  meta.className = "listing-meta";

  const location = document.createElement("span");
  location.textContent = `📍 ${listing.location}`;

  const date = document.createElement("span");
  date.textContent = formatListingDate(listing.createdAt);

  meta.append(location, date);

  const cardActions = document.createElement("div");
  cardActions.className = "listing-card-actions";

  const offerButton = document.createElement("button");
  offerButton.type = "button";
  offerButton.className = "make-offer-button";
  offerButton.textContent = "Make an offer";
  offerButton.addEventListener("click", () => openOfferModal(listing));

  const contactButton = document.createElement("button");
  contactButton.type = "button";
  contactButton.className = "contact-button";
  contactButton.textContent = "Contact seller";
  contactButton.addEventListener("click", () => openContactModal(listing));

  const reportButton = document.createElement("button");
  reportButton.type = "button";
  reportButton.className = "report-listing-button";
  reportButton.textContent = "Report";
  reportButton.addEventListener("click", () => openReportModal(listing));

  const shareButton = document.createElement("button");
  shareButton.type = "button"; shareButton.className = "share-listing-button"; shareButton.textContent = "↗ Share";
  shareButton.addEventListener("click", async (event) => { event.preventDefault(); event.stopPropagation(); await shareListing(listing); });

  cardActions.append(offerButton, contactButton);
  content.append(category, title, price, meta, cardActions, shareButton, reportButton, favoriteButton);
  card.append(imageLink, content);

  return card;
}

function createMyListingCard(listing) {
  const card = createListingCard(listing);
  const content = card.querySelector(".listing-content");

  const actions = document.createElement("div");
  actions.className = "manage-listing-actions";
  const editButton = document.createElement("button");
editButton.className = "edit-listing-button";
editButton.textContent = "Edit";

editButton.addEventListener("click", () => {
  openEditListingForm(listing);
});

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-listing-button";
  deleteButton.textContent = "Delete";

  deleteButton.addEventListener("click", async () => {
    const shouldDelete = confirm(
      `Delete "${listing.title}"? This cannot be undone.`
    );

    if (!shouldDelete) return;

    try {
      await deleteDoc(doc(db, "listings", listing.id));
    } catch (error) {
      console.error(error);
      alert("This listing could not be deleted. Please try again.");
    }
  });

  actions.append(editButton, deleteButton);
  content.append(actions);

  return card;
}

function openEditListingForm(listing) {
  document.getElementById("title").value = listing.title || "";
  document.getElementById("price").value = listing.price || "";
  document.getElementById("category").value = listing.category || "";
  document.getElementById("location").value = listing.location || "";
  document.getElementById("description").value = listing.description || "";
  document.getElementById("seller-name").value = listing.sellerName || "";
  document.getElementById("seller-phone").value = listing.sellerPhone || "";

  imageFileInput.value = "";
  const existingImages = Array.isArray(listing.images) && listing.images.length ? listing.images : (listing.image ? [listing.image] : []);
  imageHiddenInput.value = existingImages[0] || "";
  imagesHiddenInput.value = JSON.stringify(existingImages);
  listingForm.dataset.existingImages = JSON.stringify(existingImages);
  imageUploadStatus.textContent = "";
  imageUploadStatus.classList.add("hidden");
  renderImagePreviews(existingImages);

  listingForm.dataset.editingId = listing.id;

  listingModal.querySelector("h2").textContent = "Edit listing";

  const descriptionText = listingModal.querySelector(".modal-content > p");

  if (descriptionText) {
    descriptionText.textContent =
      "Update the details of your listing.";
  }

  const submitButton = listingForm.querySelector(
    'button[type="submit"]'
  );

  submitButton.textContent = "Save changes";

  listingModal.classList.remove("hidden");
}
function renderMyListings() {
  if (!currentUser) {
    myListingsSection.classList.add("hidden");
    return;
  }

  myListingsSection.classList.remove("hidden");

  const myListings = listings.filter(
    (listing) => listing.ownerId === currentUser.uid
  );

  myListingGrid.innerHTML = "";

  if (myListings.length === 0) {
    myListingsMessage.textContent =
      "You have not posted any listings yet. Use “Post an Ad” to create one.";
    myListingsMessage.classList.remove("hidden");
    return;
  }

  myListingsMessage.classList.add("hidden");

  myListings.forEach((listing) => {
    myListingGrid.appendChild(createMyListingCard(listing));
  });
}
const LISTINGS_PAGE_SIZE = 12;
let visibleListingsCount = LISTINGS_PAGE_SIZE;
let currentFilteredListings = [];

function renderListings() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const chosenLocation = locationFilter.value;
  const minPrice = Number(minPriceInput?.value || 0);
  const maxPrice = Number(maxPriceInput?.value || 0);

  currentFilteredListings = listings.filter((listing) => {
    if (blockedUserIds.has(listing.ownerId)) return false;

    const matchesSearch =
      listing.title.toLowerCase().includes(searchTerm) ||
      listing.description.toLowerCase().includes(searchTerm) ||
      listing.category.toLowerCase().includes(searchTerm);

        const matchesCategory =
      selectedCategory === "All" || listing.category === selectedCategory;

    const matchesLocation =
      chosenLocation === "" || chosenLocation === "All" || chosenLocation === "All Locations" || listing.location === chosenLocation;
    const matchesMinPrice = !minPrice || Number(listing.price) >= minPrice;
    const matchesMaxPrice = !maxPrice || Number(listing.price) <= maxPrice;

    return matchesSearch && matchesCategory && matchesLocation && matchesMinPrice && matchesMaxPrice;
  });

  visibleListingsCount = LISTINGS_PAGE_SIZE;
  paintListings();
  renderTrendingCarousel();
}

function paintListings() {
  const listingsToShow = currentFilteredListings.slice(0, visibleListingsCount);

  listingGrid.innerHTML = "";
  listingsToShow.forEach((listing) => {
    listingGrid.appendChild(createListingCard(listing));
  });

  const listingWord =
    currentFilteredListings.length === 1 ? "listing" : "listings";
  listingCount.textContent = `${currentFilteredListings.length} ${listingWord}`;

  emptyMessage.classList.toggle("hidden", currentFilteredListings.length !== 0);

  const hasMore = visibleListingsCount < currentFilteredListings.length;
  loadMoreButton.classList.toggle("hidden", !hasMore);
}

function loadMoreListings() {
  visibleListingsCount += LISTINGS_PAGE_SIZE;
  paintListings();
}

function renderTrendingCarousel() {
  if (!trendingCarousel) return;

  const trendingListings = listings.slice(0, 10);
  trendingCarousel.innerHTML = "";

  trendingListings.forEach((listing) => {
    trendingCarousel.appendChild(createListingCard(listing));
  });

  trendingSection.classList.toggle("hidden", trendingListings.length === 0);
}

async function shareListing(listing) {
  const url = `${window.location.origin}${window.location.pathname.replace(/index\.html$/, "") || "/"}product.html?id=${listing.id}`;
  const shareData = { title: listing.title, text: `Check out ${listing.title} on PZ Online`, url };
  try {
    if (navigator.share) { await navigator.share(shareData); return; }
    await navigator.clipboard.writeText(url);
    alert("Listing link copied to your clipboard.");
  } catch (error) {
    if (error?.name !== "AbortError") alert("Could not share this listing. You can copy the product URL from the address bar.");
  }
}

function openOfferModal(listing) {
  if (!currentUser) {
    setAuthMode("login");
    authModal.classList.remove("hidden");
    return;
  }

  if (currentUser.uid === listing.ownerId) {
    alert("You cannot make an offer on your own listing.");
    return;
  }

  currentOfferListing = listing;
  offerListingTitle.textContent = listing.title;
  offerAmount.value = "";
  offerMessage.value = "";
  offerModal.classList.remove("hidden");
}

function openReportModal(listing) {
  if (!currentUser) {
    setAuthMode("login");
    authModal.classList.remove("hidden");
    return;
  }

  currentReportListing = listing;
  reportListingTitle.textContent = `Listing: ${listing.title}`;
  reportReason.value = "";
  reportDetails.value = "";
  reportModal.classList.remove("hidden");
}

async function blockSeller(listing) {
  if (!currentUser) {
    setAuthMode("login");
    authModal.classList.remove("hidden");
    return;
  }

  if (currentUser.uid === listing.ownerId) {
    alert("You cannot block yourself.");
    return;
  }

  const shouldBlock = confirm(`Block ${listing.sellerName || "this seller"}? Their listings will be hidden from you.`);
  if (!shouldBlock) return;

  try {
    await setDoc(doc(db, "users", currentUser.uid, "blockedUsers", listing.ownerId), {
      blockedUserId: listing.ownerId,
      blockedAt: serverTimestamp(),
    });
    blockedUserIds.add(listing.ownerId);
    closeModal(contactModal);
    renderListings();
    renderMyFavourites();
    alert("Seller blocked. Their listings are now hidden from you.");
  } catch (error) {
    console.error("Could not block seller:", error);
    alert("The seller could not be blocked. Please try again.");
  }
}

function openContactModal(listing) {
  currentContactListing = listing;
  contactListingTitle.textContent = listing.title;
  sellerContactDetails.textContent = `${listing.sellerName} • ${listing.sellerPhone}`;

  // The form expects an 8-digit Sierra Leone phone number.
  const digitsOnly = listing.sellerPhone.replace(/\D/g, "");
  callSellerButton.href = `tel:+232${digitsOnly}`;

  const whatsappMessage = encodeURIComponent(
    `Hi ${listing.sellerName}, I'm interested in your listing "${listing.title}" on PZ Online.`
  );
  whatsappSellerButton.href = `https://wa.me/232${digitsOnly}?text=${whatsappMessage}`;

  contactModal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

async function getOrCreateConversation(listing) {
  const conversationId = `${listing.id}_${currentUser.uid}`;
  const conversationRef = doc(db, "conversations", conversationId);
  const existing = await getDoc(conversationRef);

  if (!existing.exists()) {
    await setDoc(conversationRef, {
      listingId: listing.id,
      listingTitle: listing.title,
      buyerId: currentUser.uid,
      buyerEmail: currentUser.email,
      sellerId: listing.ownerId,
      sellerName: listing.sellerName || "Seller",
      participants: [currentUser.uid, listing.ownerId],
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  return conversationId;
}

messageSellerButton.addEventListener("click", async () => {
  if (!currentContactListing) return;

  if (!currentUser) {
    setAuthMode("login");
    authModal.classList.remove("hidden");
    return;
  }

  if (currentUser.uid === currentContactListing.ownerId) {
    alert("This is your own listing.");
    return;
  }

  messageSellerButton.disabled = true;
  messageSellerButton.textContent = "Opening chat...";

  try {
    const conversationId = await getOrCreateConversation(currentContactListing);
    window.location.href = `messages.html?conversation=${conversationId}`;
  } catch (error) {
    console.error("Could not start conversation:", error);
    alert("Could not open the chat. Please try again.");
  } finally {
    messageSellerButton.disabled = false;
    messageSellerButton.textContent = "Message seller";
  }
});

blockSellerButton?.addEventListener("click", () => {
  if (currentContactListing) blockSeller(currentContactListing);
});

closeOfferModalButton?.addEventListener("click", () => closeModal(offerModal));
closeReportModalButton?.addEventListener("click", () => closeModal(reportModal));

offerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !currentOfferListing) return;

  const amount = Number(offerAmount.value);
  if (!amount || amount <= 0) return;

  const button = offerForm.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Sending offer...";

  try {
    const conversationId = await getOrCreateConversation(currentOfferListing);
    const messageText = `Offer: ${formatPrice(amount)}${offerMessage.value.trim() ? ` — ${offerMessage.value.trim()}` : ""}`;

    await addDoc(collection(db, "conversations", conversationId, "messages"), {
      senderId: currentUser.uid,
      text: messageText,
      createdAt: serverTimestamp(),
      type: "offer",
      offerAmount: amount,
    });

    await updateDoc(doc(db, "conversations", conversationId), {
      lastMessage: messageText,
      lastMessageAt: serverTimestamp(),
    });
    await addDoc(collection(db, "notifications"), {
      userId: currentOfferListing.ownerId, actorId: currentUser.uid, type: "offer",
      title: "New offer", message: `${currentUser.email || "A buyer"} offered ${formatPrice(amount)} for ${currentOfferListing.title}.`,
      listingId: currentOfferListing.id, conversationId, read: false, createdAt: serverTimestamp()
    });

    closeModal(offerModal);
    window.location.href = `messages.html?conversation=${conversationId}`;
  } catch (error) {
    console.error("Could not send offer:", error);
    alert("Your offer could not be sent. Please try again.");
  } finally {
    button.disabled = false;
    button.textContent = "Send offer";
  }
});

reportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !currentReportListing) return;

  const button = reportForm.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Submitting...";

  try {
    await addDoc(collection(db, "reports"), {
      listingId: currentReportListing.id,
      listingTitle: currentReportListing.title,
      ownerId: currentReportListing.ownerId,
      reporterId: currentUser.uid,
      reason: reportReason.value,
      details: reportDetails.value.trim(),
      status: "open",
      createdAt: serverTimestamp(),
    });
    closeModal(reportModal);
    alert("Thanks. Your report has been submitted for review.");
  } catch (error) {
    console.error("Could not submit report:", error);
    alert("The report could not be submitted. Please try again.");
  } finally {
    button.disabled = false;
    button.textContent = "Submit report";
  }
});

function renderImagePreviews(urls = []) {
  if (!imagePreviewGrid) return;
  imagePreviewGrid.innerHTML = "";
  urls.forEach((url, index) => {
    const wrap = document.createElement("div");
    wrap.className = "image-preview-item";
    const img = document.createElement("img");
    img.src = url; img.alt = `Listing photo ${index + 1}`;
    const badge = document.createElement("span");
    badge.textContent = index === 0 ? "Cover" : `${index + 1}`;
    wrap.append(img, badge);
    imagePreviewGrid.appendChild(wrap);
  });
}

function resetImageField() {
  imageFileInput.value = "";
  imageHiddenInput.value = "";
  imagesHiddenInput.value = "[]";
  delete listingForm.dataset.existingImages;
  if (imagePreviewGrid) imagePreviewGrid.innerHTML = "";
  imageUploadStatus.textContent = "";
  imageUploadStatus.classList.add("hidden");
}

async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
  if (!response.ok) throw new Error("Image upload failed");
  const data = await response.json();
  return data.secure_url;
}

imageFileInput.addEventListener("change", async () => {
  const files = Array.from(imageFileInput.files || []);
  if (!files.length) return;
  if (files.length > 8) { alert("Please choose no more than 8 photos."); imageFileInput.value = ""; return; }
  if (files.some(file => file.size > 8 * 1024 * 1024)) { alert("Each photo must be 8 MB or smaller."); imageFileInput.value = ""; return; }
  isImageUploading = true;
  imageUploadStatus.textContent = `Uploading ${files.length} photo${files.length > 1 ? "s" : ""}...`;
  imageUploadStatus.classList.remove("hidden");
  try {
    const urls = await Promise.all(files.map(uploadImageToCloudinary));
    imageHiddenInput.value = urls[0] || "";
    imagesHiddenInput.value = JSON.stringify(urls);
    renderImagePreviews(urls);
    imageUploadStatus.textContent = `${urls.length} photo${urls.length > 1 ? "s" : ""} uploaded.`;
  } catch (error) {
    console.error("Image upload error:", error);
    alert("One or more photos could not be uploaded. Please try again.");
    imageHiddenInput.value = ""; imagesHiddenInput.value = "[]";
    renderImagePreviews([]);
  } finally {
    isImageUploading = false;
  }
});

function setAuthMode(mode) {
  authMode = mode;
  authError.classList.add("hidden");
  authError.textContent = "";

  const isSignup = mode === "signup";

  authTitle.textContent = isSignup ? "Create an account" : "Welcome back";
  authDescription.textContent = isSignup
    ? "Create an account to publish and manage your own listings."
    : "Log in to post and manage your marketplace listings.";
  authSubmit.textContent = isSignup ? "Create account" : "Log in";
  authSwitchQuestion.textContent = isSignup
    ? "Already have an account?"
    : "New to PZ Online?";
  authSwitchButton.textContent = isSignup ? "Log in" : "Create an account";
}

function showAuthError(error) {
  const messages = {
    "auth/email-already-in-use": "An account already exists for this email.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/invalid-credential": "Incorrect email address or password.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/unauthorized-domain":
      "This website's domain isn't authorized for Google sign-in yet. Add it in Firebase Authentication settings.",
    "auth/operation-not-allowed":
      "Google sign-in isn't enabled for this project yet. Enable it in Firebase Authentication settings.",
    "auth/popup-blocked":
      "Your browser blocked the sign-in popup. Allow popups for this site and try again.",
  };

  console.error("Auth error:", error.code, error.message);

  authError.textContent =
    messages[error.code] || `Something went wrong (${error.code || "unknown error"}). Please try again.`;

  authError.classList.remove("hidden");
}

openListingFormButton.addEventListener("click", () => {
  if (!currentUser) {
    setAuthMode("signup");
    authModal.classList.remove("hidden");
    return;
  }

  if (!listingForm.dataset.editingId) {
    resetImageField();
  }

  listingModal.classList.remove("hidden");
});

authButton.addEventListener("click", async () => {
  if (currentUser) {
    await signOut(auth);
    return;
  }

  setAuthMode("login");
  authModal.classList.remove("hidden");
});

closeListingFormButton.addEventListener("click", () => closeModal(listingModal));
closeContactModalButton.addEventListener("click", () => closeModal(contactModal));
closeAuthModalButton.addEventListener("click", () => closeModal(authModal));

dashboardPostAdButton.addEventListener("click", () => {
  if (!listingForm.dataset.editingId) {
    resetImageField();
  }

  listingModal.classList.remove("hidden");
});

closeProfileModalButton.addEventListener("click", () => {
  profileModal.classList.add("hidden");
});

profileButton.addEventListener("click", () => {
  accountMenuDropdown?.classList.add("hidden");

  if (!currentUser) {
    setAuthMode("login");
    authModal.classList.remove("hidden");
    return;
  }

  profileEmail.textContent =
    currentUser.email || "Not available";

  if (currentUser.photoURL) {
    profileAvatarImage.src = currentUser.photoURL;
    profileAvatarImage.classList.remove("hidden");
    profileAvatarPlaceholder.classList.add("hidden");
  } else {
    profileAvatarImage.classList.add("hidden");
    profileAvatarPlaceholder.classList.remove("hidden");
  }

  const myListings = listings.filter(
    (listing) => listing.ownerId === currentUser.uid
  );

  profileListingCount.textContent = myListings.length;

  profileModal.classList.remove("hidden");
});
profileViewListingsButton.addEventListener("click", () => {
  profileModal.classList.add("hidden");

  myListingsSection.scrollIntoView({
    behavior: "smooth"
  });
});

profileViewFavouritesButton.addEventListener("click", () => {
  profileModal.classList.add("hidden");

  myFavouritesList.scrollIntoView({
    behavior: "smooth"
  });
});

profilePhotoInput?.addEventListener("change", async () => {
  const file = profilePhotoInput.files[0];
  if (!file || !currentUser) return;

  profilePhotoStatus.classList.remove("hidden");
  profilePhotoStatus.textContent = "Uploading profile picture...";

  try {
    const uploadedUrl = await uploadImageToCloudinary(file);
    await updateProfile(currentUser, { photoURL: uploadedUrl });
    profileAvatarImage.src = uploadedUrl;
    profileAvatarImage.classList.remove("hidden");
    profileAvatarPlaceholder.classList.add("hidden");
    profilePhotoStatus.textContent = "Profile picture updated.";
  } catch (error) {
    console.error("Profile picture error:", error);
    profilePhotoStatus.textContent = "Profile picture upload failed. Please try again.";
  }
});

profileLogoutButton.addEventListener("click", async () => {
  await signOut(auth);
  profileModal.classList.add("hidden");
});

async function performAccountDeletion() {
  const uid = currentUser.uid;

  await deleteDoc(doc(db, "users", uid)).catch(() => {});
  await deleteUser(currentUser);

  profileModal.classList.add("hidden");
  alert("Your account has been deleted.");
}

profileDeleteAccountButton?.addEventListener("click", async () => {
  if (!currentUser) return;

  const confirmed = confirm(
    "This permanently deletes your PZ Online account and profile. Any listings you posted will remain unless you remove them first. Continue?"
  );

  if (!confirmed) return;

  try {
    await performAccountDeletion();
  } catch (error) {
    if (error.code === "auth/requires-recent-login") {
      const reauthConfirmed = confirm(
        "For your security, please confirm your login again to delete your account. Continue?"
      );

      if (!reauthConfirmed) return;

      try {
        const providerId = currentUser.providerData[0]?.providerId;

        if (providerId === "google.com") {
          await reauthenticateWithPopup(currentUser, googleProvider);
        } else {
          const password = prompt("Enter your password to confirm account deletion:");
          if (!password) return;

          const credential = EmailAuthProvider.credential(
            currentUser.email,
            password
          );
          await reauthenticateWithCredential(currentUser, credential);
        }

        await performAccountDeletion();
      } catch (reauthError) {
        console.error("Account deletion re-authentication failed:", reauthError);
        alert(
          "Account deletion failed. Please log out, log back in, and try again."
        );
      }
    } else {
      console.error("Account deletion failed:", error);
      alert("Your account could not be deleted. Please try again.");
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal(listingModal);
    closeModal(contactModal);
    closeModal(authModal);
    closeModal(offerModal);
    closeModal(reportModal);
  }
});

authSwitchButton.addEventListener("click", () => {
  setAuthMode(authMode === "signup" ? "login" : "signup");
});
const forgotPasswordButton = document.getElementById(
  "forgot-password-button"
);
const verificationMessage = document.getElementById(
  "verification-message"
);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
const email = document.getElementById("auth-email").value.trim();

const password = document.getElementById("auth-password").value;


 
  authSubmit.disabled = true;
  authSubmit.textContent = authMode === "signup" ? "Creating..." : "Logging in...";

  try {
    if (authMode === "signup") {

  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  await sendEmailVerification(userCredential.user);

} else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    authForm.reset();
    closeModal(authModal);
  } catch (error) {
    showAuthError(error);
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent =
      authMode === "signup" ? "Create account" : "Log in";
  }
});

googleSigninButton.addEventListener("click", async () => {
  googleSigninButton.disabled = true;
  googleSigninButton.textContent = "Connecting...";

  try {
    await signInWithPopup(auth, googleProvider);
    authForm.reset();
    closeModal(authModal);
  } catch (error) {
    if (error.code !== "auth/popup-closed-by-user") {
      showAuthError(error);
    }
  } finally {
    googleSigninButton.disabled = false;
    googleSigninButton.textContent = "Continue with Google";
  }
});

forgotPasswordButton.addEventListener("click", async () => {
  const email = document.getElementById("auth-email").value.trim();

  if (!email) {
    showAuthError("Enter your email address first.");
    return;
  }

  forgotPasswordButton.disabled = true;
  forgotPasswordButton.textContent = "Sending...";

  try {
    await sendPasswordResetEmail(auth, email);

    authError.classList.remove("hidden");
    authError.textContent =
      "Password reset email sent. Check your inbox.";
  } catch (error) {
    showAuthError(error);
  } finally {
    forgotPasswordButton.disabled = false;
    forgotPasswordButton.textContent = "Forgot password?";
  }
});
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderListings();
});

searchInput.addEventListener("input", renderListings);
locationFilter.addEventListener("change", renderListings);
priceFilterButton?.addEventListener("click", renderListings);
clearPriceFilterButton?.addEventListener("click", () => { if (minPriceInput) minPriceInput.value = ""; if (maxPriceInput) maxPriceInput.value = ""; renderListings(); });

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category;

    categoryButtons.forEach((categoryButton) => {
      categoryButton.classList.remove("active");
    });

    button.classList.add("active");
    renderListings();

    if (button.classList.contains("category-tile")) {
      document
        .getElementById("listings")
        .scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

listingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    setAuthMode("signup");
    authModal.classList.remove("hidden");
    return;
  }

  if (isImageUploading) {
    alert("Please wait for the photo to finish uploading.");
    return;
  }

  const submitButton = listingForm.querySelector(
    'button[type="submit"]'
  );

  const editingId = listingForm.dataset.editingId;

  submitButton.disabled = true;
  submitButton.textContent = editingId
    ? "Saving..."
    : "Publishing...";

  if (!editingId) {
    const lastPost = Number(localStorage.getItem("pz-last-listing-time") || 0);
    if (Date.now() - lastPost < 30000) {
      alert("Please wait 30 seconds before posting another listing.");
      submitButton.disabled = false;
      submitButton.textContent = "Publish listing";
      return;
    }
  }

  const listingData = {
    title: document.getElementById("title").value.trim(),
    price: Number(document.getElementById("price").value),
    category: document.getElementById("category").value,
    location: document.getElementById("location").value,
    description: document.getElementById("description").value.trim(),
    image: document.getElementById("image").value.trim(),
    images: (() => { try { return JSON.parse(document.getElementById("images").value || "[]"); } catch { return []; } })(),
    sellerName: document.getElementById("seller-name").value.trim(),
    sellerPhone: document.getElementById("seller-phone").value.trim(),
  };

  try {
    if (editingId) {
      await updateDoc(
        doc(db, "listings", editingId),
        listingData
      );
    } else {
      await addDoc(collection(db, "listings"), {
        ...listingData,
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      localStorage.setItem("pz-last-listing-time", String(Date.now()));
    }

    listingForm.reset();
    resetImageField();

    delete listingForm.dataset.editingId;

    listingModal.querySelector("h2").textContent =
      "Post a new listing";

    const descriptionText =
      listingModal.querySelector(".modal-content > p");

    if (descriptionText) {
      descriptionText.textContent =
        "Fill in the details below so buyers can find you.";
    }

    submitButton.textContent = "Publish listing";

    closeModal(listingModal);

    selectedCategory = "All";

    categoryButtons.forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.category === "All"
      );
    });

    renderListings();
    renderMyListings();

  } catch (error) {
    console.error(error);

    alert(
      editingId
        ? "Your listing could not be updated. Please try again."
        : "Your listing could not be published. Please try again."
    );

  } finally {
    submitButton.disabled = false;

    submitButton.textContent =
      listingForm.dataset.editingId
        ? "Save changes"
        : "Publish listing";
  }
});
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

if (currentUser) {
  await currentUser.reload();
}

if (currentUser && !currentUser.emailVerified) {
  verificationMessage.classList.remove("hidden");
} else {
  verificationMessage.classList.add("hidden");
}
  await loadFavoriteListings();
  await loadBlockedUsers();

  if (user) {
    userStatus.textContent = user.email;
    authButton.textContent = "Log out";
    authButton.classList.add("hidden");
    accountMenu?.classList.remove("hidden");

    if (accountMenuEmail) accountMenuEmail.textContent = user.email || "";

    if (user.photoURL) {
      if (accountAvatarImage) {
        accountAvatarImage.src = user.photoURL;
        accountAvatarImage.classList.remove("hidden");
      }
      accountAvatarPlaceholder?.classList.add("hidden");
    } else {
      accountAvatarImage?.classList.add("hidden");
      accountAvatarPlaceholder?.classList.remove("hidden");
    }

    syncUserProfile(user);
  } else {
    favoriteListingIds = new Set();
    userStatus.textContent = "Browsing as guest";
    authButton.textContent = "Log in";
    authButton.classList.remove("hidden");
    accountMenu?.classList.add("hidden");
    accountMenuDropdown?.classList.add("hidden");
  }
    renderMyListings();
});

accountMenuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  accountMenuDropdown?.classList.toggle("hidden");
});

document.addEventListener("click", (event) => {
  if (
    accountMenu &&
    !accountMenu.contains(event.target) &&
    !accountMenuDropdown?.classList.contains("hidden")
  ) {
    accountMenuDropdown.classList.add("hidden");
  }
});

accountMenuLogout?.addEventListener("click", async () => {
  accountMenuDropdown?.classList.add("hidden");
  await signOut(auth);
});

const listingsQuery = query(
  collection(db, "listings"),
  orderBy("createdAt", "desc")
);

onSnapshot(
  listingsQuery,
  (snapshot) => {
    listings = snapshot.docs.map((listingDocument) => ({
      id: listingDocument.id,
      ...listingDocument.data(),
    }));

    renderListings();
    renderMyListings();
    renderMyFavourites();
  },
  (error) => {
    console.error(error);
    emptyMessage.textContent =
      "Listings could not be loaded. Please refresh and try again.";
    emptyMessage.classList.remove("hidden");
  }
);

if (loadMoreButton) {
  loadMoreButton.addEventListener("click", loadMoreListings);
}

// Infinite scroll: automatically load the next page as the sentinel
// element scrolls into view, instead of forcing a click every time.
if (loadMoreSentinel && "IntersectionObserver" in window) {
  const infiniteScrollObserver = new IntersectionObserver(
    (entries) => {
      const isVisible = entries.some((entry) => entry.isIntersecting);
      if (isVisible && !loadMoreButton.classList.contains("hidden")) {
        loadMoreListings();
      }
    },
    { rootMargin: "400px" }
  );

  infiniteScrollObserver.observe(loadMoreSentinel);
}

// Trending carousel arrow controls — scroll by roughly one "page"
// of visible cards at a time, so it feels like flicking through a
// row rather than a small nudge.
function scrollCarousel(direction) {
  if (!trendingCarousel) return;
  const amount = trendingCarousel.clientWidth * 0.9 * direction;
  trendingCarousel.scrollBy({ left: amount, behavior: "smooth" });
}

if (trendingPrevButton) {
  trendingPrevButton.addEventListener("click", () => scrollCarousel(-1));
}

if (trendingNextButton) {
  trendingNextButton.addEventListener("click", () => scrollCarousel(1));
}