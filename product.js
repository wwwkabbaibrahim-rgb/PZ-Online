import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
  deleteDoc,
  addDoc,
  collection,
  updateDoc,
  increment,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/*
  Same Firebase configuration as js/app.js.
  Keep both files in sync if you change your Firebase project.
*/
const firebaseConfig = {
  apiKey: "AIzaSyD5tdmon0-6R_IABZyUo8QEfSKlTBrmLTo",
  authDomain: "markethub-prototype.firebaseapp.com",
  projectId: "markethub-prototype",
  storageBucket: "markethub-prototype.firebasestorage.app",
  messagingSenderId: "350124318634",
  appId: "1:350124318634:web:cb4401e9f84edcdd5995d3",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const userStatus = document.getElementById("user-status");
const authButton = document.getElementById("auth-button");

const authModal = document.getElementById("auth-modal");
const closeAuthModalButton = document.getElementById("close-auth-modal");
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authDescription = document.getElementById("auth-description");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const authSwitchQuestion = document.getElementById("auth-switch-question");
const authSwitchButton = document.getElementById("auth-switch-button");
const googleSigninButton = document.getElementById("google-signin-button");
const forgotPasswordButton = document.getElementById("forgot-password-button");

const loadingMessage = document.getElementById("product-loading");
const notFoundMessage = document.getElementById("product-not-found");
const productDetail = document.getElementById("product-detail");

const productImage = document.getElementById("product-image");
const productCategory = document.getElementById("product-category");
const productTitle = document.getElementById("product-title");
const productPrice = document.getElementById("product-price");
const productLocation = document.getElementById("product-location");
const productDate = document.getElementById("product-date");
const productViews = document.getElementById("product-views");
const productDescription = document.getElementById("product-description");
const productSellerName = document.getElementById("product-seller-name");
const productSellerPhone = document.getElementById("product-seller-phone");
const productCallButton = document.getElementById("product-call-button");
const productWhatsappButton = document.getElementById("product-whatsapp-button");
const productMessageButton = document.getElementById("product-message-button");
const productFavoriteButton = document.getElementById("product-favorite-button");
const productOwnerNote = document.getElementById("product-owner-note");
const productGalleryThumbs = document.getElementById("product-gallery-thumbs");
const productOfferButton = document.getElementById("product-offer-button");
const productReportButton = document.getElementById("product-report-button");
const productBlockButton = document.getElementById("product-block-button");
const productShareButton = document.getElementById("product-share-button");
const sellerRatingSummary = document.getElementById("seller-rating-summary");
const sellerRatingCount = document.getElementById("seller-rating-count");
const sellerReviewsList = document.getElementById("seller-reviews-list");
const productRateButton = document.getElementById("product-rate-button");
const ratingModal = document.getElementById("rating-modal");
const closeRatingModalButton = document.getElementById("close-rating-modal");
const ratingForm = document.getElementById("rating-form");
let currentUser = null;
let currentListing = null;
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

productMessageButton.addEventListener("click", async () => {
  if (!currentListing) return;

  if (!currentUser) {
    setAuthMode("login");
    authModal.classList.remove("hidden");
    return;
  }

  if (currentUser.uid === currentListing.ownerId) {
    alert("This is your own listing.");
    return;
  }

  productMessageButton.disabled = true;
  productMessageButton.textContent = "Opening chat...";

  try {
    const conversationId = await getOrCreateConversation(currentListing);
    window.location.href = `messages.html?conversation=${conversationId}`;
  } catch (error) {
    console.error("Could not start conversation:", error);
    alert("Could not open the chat. Please try again.");
  } finally {
    productMessageButton.disabled = false;
    productMessageButton.textContent = "Message seller";
  }
});

async function ensureConversation() {
  const conversationId = `${currentListing.id}_${currentUser.uid}`;
  const conversationRef = doc(db, "conversations", conversationId);
  const existing = await getDoc(conversationRef);
  if (!existing.exists()) {
    await setDoc(conversationRef, {
      listingId: currentListing.id,
      listingTitle: currentListing.title,
      buyerId: currentUser.uid,
      buyerEmail: currentUser.email,
      sellerId: currentListing.ownerId,
      sellerName: currentListing.sellerName || "Seller",
      participants: [currentUser.uid, currentListing.ownerId],
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }
  return conversationId;
}

productOfferButton?.addEventListener("click", async () => {
  if (!currentListing) return;
  if (!currentUser) { setAuthMode("login"); authModal.classList.remove("hidden"); return; }
  if (currentUser.uid === currentListing.ownerId) { alert("You cannot make an offer on your own listing."); return; }
  const amount = Number(prompt(`Your offer for "${currentListing.title}" (Le):`, ""));
  if (!amount || amount <= 0) return;
  const note = prompt("Add a short message (optional):", "") || "";
  try {
    const conversationId = await ensureConversation();
    const text = `Offer: ${formatPrice(amount)}${note.trim() ? ` — ${note.trim()}` : ""}`;
    await addDoc(collection(db, "conversations", conversationId, "messages"), { senderId: currentUser.uid, text, createdAt: serverTimestamp(), type: "offer", offerAmount: amount });
    await updateDoc(doc(db, "conversations", conversationId), { lastMessage: text, lastMessageAt: serverTimestamp() });
    window.location.href = `messages.html?conversation=${conversationId}`;
  } catch (error) { console.error(error); alert("Your offer could not be sent. Please try again."); }
});

productReportButton?.addEventListener("click", async () => {
  if (!currentListing) return;
  if (!currentUser) { setAuthMode("login"); authModal.classList.remove("hidden"); return; }
  const reason = prompt("Why are you reporting this listing? (Scam, prohibited item, fake listing, spam, or other)", "");
  if (!reason) return;
  const details = prompt("Optional details:", "") || "";
  try {
    await addDoc(collection(db, "reports"), { listingId: currentListing.id, listingTitle: currentListing.title, ownerId: currentListing.ownerId, reporterId: currentUser.uid, reason, details, status: "open", createdAt: serverTimestamp() });
    alert("Thanks. Your report has been submitted for review.");
  } catch (error) { console.error(error); alert("The report could not be submitted. Please try again."); }
});

productBlockButton?.addEventListener("click", async () => {
  if (!currentListing) return;
  if (!currentUser) { setAuthMode("login"); authModal.classList.remove("hidden"); return; }
  if (currentUser.uid === currentListing.ownerId) { alert("You cannot block yourself."); return; }
  if (!confirm(`Block ${currentListing.sellerName || "this seller"}? Their listings will be hidden from you.`)) return;
  try {
    await setDoc(doc(db, "users", currentUser.uid, "blockedUsers", currentListing.ownerId), { blockedUserId: currentListing.ownerId, blockedAt: serverTimestamp() });
    alert("Seller blocked. Returning to listings.");
    window.location.href = "index.html#listings";
  } catch (error) { console.error(error); alert("The seller could not be blocked. Please try again."); }
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
    messages[error.code] ||
    `Something went wrong (${error.code || "unknown error"}). Please try again.`;

  authError.classList.remove("hidden");
}

authButton.addEventListener("click", async () => {
  if (currentUser) {
    await signOut(auth);
    return;
  }

  setAuthMode("login");
  authModal.classList.remove("hidden");
});

closeAuthModalButton.addEventListener("click", () => closeModal(authModal));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal(authModal);
  }
});

authSwitchButton.addEventListener("click", () => {
  setAuthMode(authMode === "signup" ? "login" : "signup");
});

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
    authSubmit.textContent = authMode === "signup" ? "Create account" : "Log in";
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
    showAuthError({ code: "", message: "Enter your email address first." });
    return;
  }

  forgotPasswordButton.disabled = true;
  forgotPasswordButton.textContent = "Sending...";

  try {
    await sendPasswordResetEmail(auth, email);
    authError.classList.remove("hidden");
    authError.textContent = "Password reset email sent. Check your inbox.";
  } catch (error) {
    showAuthError(error);
  } finally {
    forgotPasswordButton.disabled = false;
    forgotPasswordButton.textContent = "Forgot password?";
  }
});

async function refreshFavoriteState() {
  if (!currentUser || !currentListing) {
    productFavoriteButton.textContent = "♡";
    productFavoriteButton.setAttribute("aria-label", "Add to favourites");
    return;
  }

  try {
    const favoriteRef = doc(
      db,
      "users",
      currentUser.uid,
      "favorites",
      currentListing.id
    );

    const favoriteSnapshot = await getDoc(favoriteRef);
    const isFavorited = favoriteSnapshot.exists();

    productFavoriteButton.textContent = isFavorited ? "♥" : "♡";
    productFavoriteButton.setAttribute(
      "aria-label",
      isFavorited ? "Remove from favourites" : "Add to favourites"
    );
  } catch (error) {
    console.error("Could not load favourite state:", error);
  }
}

productFavoriteButton.addEventListener("click", async () => {
  if (!currentListing) return;

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
    currentListing.id
  );

  try {
    const isFavorited = productFavoriteButton.textContent === "♥";

    if (isFavorited) {
      await deleteDoc(favoriteRef);
    } else {
      await setDoc(favoriteRef, {
        listingId: currentListing.id,
        createdAt: serverTimestamp(),
      });
    }

    await refreshFavoriteState();
  } catch (error) {
    console.error("Favourite error:", error);
    alert("Could not update your favourite. Please try again.");
  }
});

function renderListing(listing) {
  currentListing = listing;
  try {
    const recent = JSON.parse(localStorage.getItem("pz-recently-viewed") || "[]").filter((id) => id !== listing.id);
    recent.unshift(listing.id);
    localStorage.setItem("pz-recently-viewed", JSON.stringify(recent.slice(0, 30)));
  } catch (error) {
    console.warn("Could not save recent listing", error);
  }

  const galleryImages = Array.isArray(listing.images) && listing.images.length ? listing.images : (listing.image ? [listing.image] : ["https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80"]);
  productImage.src = galleryImages[0];
  productImage.alt = listing.title;
  productImage.onerror = () => { productImage.src = "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80"; };
  if (productGalleryThumbs) {
    productGalleryThumbs.innerHTML = "";
    galleryImages.forEach((url, index) => {
      const thumb = document.createElement("button"); thumb.type="button"; thumb.className="gallery-thumb" + (index===0 ? " active" : "");
      const img=document.createElement("img"); img.src=url; img.alt=`Photo ${index+1}`; thumb.appendChild(img);
      thumb.addEventListener("click",()=>{ productImage.src=url; productGalleryThumbs.querySelectorAll(".gallery-thumb").forEach(x=>x.classList.remove("active")); thumb.classList.add("active"); });
      productGalleryThumbs.appendChild(thumb);
    });
  }

  productCategory.textContent = listing.category;
  productTitle.textContent = listing.title;
  document.title = `${listing.title} | PZ Online`;
  productPrice.textContent = formatPrice(listing.price);
  productLocation.textContent = `📍 ${listing.location}`;
  productDate.textContent = formatListingDate(listing.createdAt);
  productDescription.textContent = listing.description;
  productSellerName.textContent = listing.sellerName;

  // Verified seller badge (public flag managed by admins)
  productSellerName.querySelector(".verified-seller-badge")?.remove();
  if (listing.ownerId) {
    getDoc(doc(db, "verifiedSellers", listing.ownerId))
      .then((verifiedSnap) => {
        if (!verifiedSnap.exists()) return;
        const badge = document.createElement("span");
        badge.className = "verified-seller-badge";
        badge.textContent = "✓ Verified seller";
        productSellerName.appendChild(badge);
      })
      .catch((error) => console.error("Verified badge check failed:", error));
  }

  if (listing.featured) {
    const categoryEl = document.getElementById("product-category");
    if (categoryEl && !categoryEl.querySelector(".featured-inline")) {
      const tag = document.createElement("span");
      tag.className = "featured-inline";
      tag.textContent = " ⭐ Featured";
      categoryEl.appendChild(tag);
    }
  }
  productSellerPhone.textContent = listing.sellerPhone;

  const digitsOnly = (listing.sellerPhone || "").replace(/\D/g, "");
  productCallButton.href = `tel:+232${digitsOnly}`;

  const whatsappMessage = encodeURIComponent(
    `Hi ${listing.sellerName}, I'm interested in your listing "${listing.title}" on PZ Online.`
  );
  productWhatsappButton.href = `https://wa.me/232${digitsOnly}?text=${whatsappMessage}`;

  productOwnerNote.classList.toggle(
    "hidden",
    !currentUser || currentUser.uid !== listing.ownerId
  );

  // Show the listing immediately. View counting is analytics only and must never
  // hold the product page behind a Firestore write.
  loadingMessage.classList.add("hidden");
  notFoundMessage.classList.add("hidden");
  productDetail.classList.remove("hidden");

  refreshFavoriteState();
  loadSellerRatings(listing.ownerId);

  if (currentUser && currentUser.uid !== listing.ownerId) {
    const viewKey = `pz-viewed-${listing.id}`;
    if (!sessionStorage.getItem(viewKey)) {
      sessionStorage.setItem(viewKey, "1");
      updateDoc(doc(db, "listings", listing.id), { views: increment(1) })
        .then(() => {
          listing.views = Number(listing.views || 0) + 1;
          if (productViews) productViews.textContent = `👁 ${listing.views.toLocaleString()} views`;
        })
        .catch((error) => console.warn("Could not record listing view", error));
    }
  }
}

async function loadSellerRatings(revieweeId) {
  if (!sellerRatingSummary || !sellerRatingCount) return;
  try {
    const snap = await getDocs(query(collection(db, "reviews"), where("revieweeId", "==", revieweeId)));
    const reviews = snap.docs.map(d=>d.data());
    if (!reviews.length) { sellerRatingSummary.textContent="No ratings yet"; sellerRatingCount.textContent="Be the first to rate your experience."; return; }
    const avg = reviews.reduce((sum,r)=>sum+Number(r.rating||0),0)/reviews.length;
    sellerRatingSummary.textContent = `${"★".repeat(Math.round(avg))}${"☆".repeat(5-Math.round(avg))} ${avg.toFixed(1)}/5`;
    sellerRatingCount.textContent = `${reviews.length} rating${reviews.length===1?"":"s"}`;
    if (sellerReviewsList) {
      sellerReviewsList.innerHTML = "";
      reviews.slice(-5).reverse().forEach(review => {
        const item=document.createElement("div"); item.className="seller-review-item";
        item.innerHTML=`<strong>${"★".repeat(Number(review.rating||0))}</strong><span>${String(review.comment||"No written review.").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</span><small>${String(review.reviewerName||"Buyer")}</small>`;
        sellerReviewsList.appendChild(item);
      });
    }
  } catch(e) { console.error("Could not load ratings",e); }
}

function openRatingModal() {
  if (!currentUser) { setAuthMode("login"); authModal.classList.remove("hidden"); return; }
  if (!currentListing || currentUser.uid === currentListing.ownerId) { alert("You cannot rate your own listing."); return; }
  ratingModal.classList.remove("hidden");
}

async function shareCurrentListing() {
  if (!currentListing) return;
  const url=window.location.href;
  try {
    if (navigator.share) { await navigator.share({title:currentListing.title,text:`Check out ${currentListing.title} on PZ Online`,url}); return; }
    await navigator.clipboard.writeText(url); alert("Listing link copied to your clipboard.");
  } catch(e) { if(e?.name!=="AbortError") alert("Could not share the listing."); }
}

productOfferButton?.addEventListener("click", async () => {
  if (!currentListing) return;
  if (!currentUser) { setAuthMode("login"); authModal.classList.remove("hidden"); return; }
  if (currentUser.uid === currentListing.ownerId) { alert("You cannot make an offer on your own listing."); return; }
  const amount=Number(prompt(`Your offer for "${currentListing.title}" (Le):`, ""));
  if(!amount || amount<=0) return;
  try {
    const conversationId=await getOrCreateConversation(currentListing);
    const text=`Offer: ${formatPrice(amount)}`;
    await addDoc(collection(db,"conversations",conversationId,"messages"),{senderId:currentUser.uid,text,createdAt:serverTimestamp(),type:"offer",offerAmount:amount});
    await setDoc(doc(db,"conversations",conversationId),{lastMessage:text,lastMessageAt:serverTimestamp()},{merge:true});
    await addDoc(collection(db,"notifications"),{userId:currentListing.ownerId,actorId:currentUser.uid,type:"offer",title:"New offer",message:`${currentUser.email||"A buyer"} offered ${formatPrice(amount)} for ${currentListing.title}.`,listingId:currentListing.id,conversationId,read:false,createdAt:serverTimestamp()});
    window.location.href=`messages.html?conversation=${conversationId}`;
  } catch(e){console.error(e);alert("Your offer could not be sent. Please try again.");}
});

productShareButton?.addEventListener("click",shareCurrentListing);
productRateButton?.addEventListener("click",openRatingModal);
closeRatingModalButton?.addEventListener("click",()=>ratingModal.classList.add("hidden"));
ratingForm?.addEventListener("submit",async(e)=>{
  e.preventDefault(); if(!currentUser||!currentListing)return;
  const rating=Number(document.getElementById("rating-score").value); const comment=document.getElementById("rating-comment").value.trim();
  if(!rating)return;
  const button=ratingForm.querySelector("button[type=submit]"); button.disabled=true;
  try {
    const conversationId=`${currentListing.id}_${currentUser.uid}`;
    const conversationSnapshot=await getDoc(doc(db,"conversations",conversationId));
    if(!conversationSnapshot.exists()){alert("Start an in-app chat with this seller before leaving a rating.");return;}
    const existing=await getDocs(query(collection(db,"reviews"),where("conversationId","==",conversationId),where("listingId","==",currentListing.id)));
    if(existing.docs.some(d=>d.data().reviewerId===currentUser.uid)){alert("You have already rated this seller for this listing.");return;}
    await addDoc(collection(db,"reviews"),{listingId:currentListing.id,conversationId,reviewerId:currentUser.uid,reviewerName:currentUser.email||"Buyer",revieweeId:currentListing.ownerId,revieweeName:currentListing.sellerName||"Seller",rating,comment,createdAt:serverTimestamp()});
    ratingModal.classList.add("hidden"); ratingForm.reset(); await loadSellerRatings(currentListing.ownerId); alert("Thanks — your rating was submitted.");
  } catch(e){console.error(e);alert("The rating could not be submitted. Please try again.");} finally {button.disabled=false;}
});

productReportButton?.addEventListener("click",async()=>{
  if(!currentListing)return; if(!currentUser){setAuthMode("login");authModal.classList.remove("hidden");return;}
  const reason=prompt("Why are you reporting this listing?", "Scam or fraud"); if(!reason)return; const details=prompt("Optional details:","")||"";
  try{await addDoc(collection(db,"reports"),{listingId:currentListing.id,listingTitle:currentListing.title,ownerId:currentListing.ownerId,reporterId:currentUser.uid,reason,details,status:"open",createdAt:serverTimestamp()});alert("Thanks. Your report has been submitted for review.");}catch(e){console.error(e);alert("The report could not be submitted. Please try again.");}
});

productBlockButton?.addEventListener("click",async()=>{
  if(!currentListing)return; if(!currentUser){setAuthMode("login");authModal.classList.remove("hidden");return;} if(currentUser.uid===currentListing.ownerId){alert("You cannot block yourself.");return;}
  if(!confirm(`Block ${currentListing.sellerName||"this seller"}? Their listings will be hidden from you.`))return;
  try{await setDoc(doc(db,"users",currentUser.uid,"blockedUsers",currentListing.ownerId),{blockedUserId:currentListing.ownerId,blockedAt:serverTimestamp()});alert("Seller blocked. Their listings will be hidden from you.");window.location.href="index.html#listings";}catch(e){console.error(e);alert("The seller could not be blocked. Please try again.");}
});

const productBackLink = document.getElementById("product-back-link");

async function loadListing() {
  const params = new URLSearchParams(window.location.search);
  const listingId = params.get("id");

  if (params.get("from") === "admin" && productBackLink) {
    productBackLink.href = "admin.html";
    productBackLink.textContent = "← Back to admin dashboard";
  }

  if (!listingId) {
    loadingMessage.classList.add("hidden");
    notFoundMessage.classList.remove("hidden");
    return;
  }

  try {
    const listingSnapshot = await getDoc(doc(db, "listings", listingId));

    if (!listingSnapshot.exists()) {
      loadingMessage.classList.add("hidden");
      notFoundMessage.classList.remove("hidden");
      return;
    }

    renderListing({ id: listingSnapshot.id, ...listingSnapshot.data() });
  } catch (error) {
    console.error("Could not load listing:", error);
    loadingMessage.classList.add("hidden");
    notFoundMessage.classList.remove("hidden");
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    userStatus.textContent = user.email;
    authButton.textContent = "Log out";
  } else {
    userStatus.textContent = "Browsing as guest";
    authButton.textContent = "Log in";
  }

  if (currentListing) {
    productOwnerNote.classList.toggle(
      "hidden",
      !currentUser || currentUser.uid !== currentListing.ownerId
    );
    refreshFavoriteState();
  }
});

loadListing();
