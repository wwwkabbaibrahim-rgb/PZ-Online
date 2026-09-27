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
  addDoc,
  collection,
  getDocs,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/*
  Same Firebase configuration as js/app.js and js/product.js.
  Keep all three files in sync if you change your Firebase project.
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

const signedOutMessage = document.getElementById("messages-signed-out");
const messagesLayout = document.getElementById("messages-layout");
const conversationList = document.getElementById("conversation-list");
const chatPanel = document.querySelector(".chat-panel");
const conversationListEmpty = document.getElementById("conversation-list-empty");
const messageThread = document.getElementById("message-thread");
const chatTabButtons = document.querySelectorAll(".chat-tab");
const chatSearchInput = document.getElementById("chat-search-input");
const buyingCountBadge = document.getElementById("buying-count");
const sellingCountBadge = document.getElementById("selling-count");

let currentUser = null;
let authMode = "signup";
let conversations = [];
let selectedConversationId = null;
let unsubscribeMessages = null;
let chatFilter = "all";

function closeModal(modal) {
  modal.classList.add("hidden");
}

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

function otherPartyName(conversation) {
  if (!currentUser) return "";
  return currentUser.uid === conversation.buyerId
    ? conversation.sellerName || "Seller"
    : conversation.buyerEmail || "Buyer";
}

function formatMessageTime(timestamp) {
  if (!timestamp || !timestamp.toDate) return "";
  return timestamp.toDate().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderConversationList() {
  conversationList.innerHTML = "";

  const buyingConversations = conversations.filter(
    (conversation) => conversation.buyerId === currentUser?.uid
  );
  const sellingConversations = conversations.filter(
    (conversation) => conversation.sellerId === currentUser?.uid
  );

  buyingCountBadge.textContent = buyingConversations.length
    ? `(${buyingConversations.length})`
    : "";
  sellingCountBadge.textContent = sellingConversations.length
    ? `(${sellingConversations.length})`
    : "";

  let filteredConversations = conversations;
  if (chatFilter === "buying") {
    filteredConversations = buyingConversations;
  } else if (chatFilter === "selling") {
    filteredConversations = sellingConversations;
  }

  const searchTerm = (chatSearchInput?.value || "").trim().toLowerCase();
  if (searchTerm) {
    filteredConversations = filteredConversations.filter((conversation) => {
      const name = otherPartyName(conversation).toLowerCase();
      const listingTitle = (conversation.listingTitle || "").toLowerCase();
      return name.includes(searchTerm) || listingTitle.includes(searchTerm);
    });
  }

  if (filteredConversations.length === 0) {
    conversationListEmpty.textContent =
      conversations.length === 0
        ? "You have no conversations yet."
        : "No chats match this filter.";
    conversationList.appendChild(conversationListEmpty);
    return;
  }

  filteredConversations.forEach((conversation) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "conversation-item";
    item.classList.toggle("active", conversation.id === selectedConversationId);

    const partyName = otherPartyName(conversation);

    const avatar = document.createElement("span");
    avatar.className = "conversation-avatar";
    avatar.textContent = partyName.charAt(0).toUpperCase() || "?";

    const textWrap = document.createElement("span");
    textWrap.className = "conversation-text";

    const topRow = document.createElement("span");
    topRow.className = "conversation-top-row";

    const name = document.createElement("span");
    name.className = "conversation-name";
    name.textContent = partyName;

    const roleTag = document.createElement("span");
    roleTag.className = "conversation-role-tag";
    roleTag.textContent =
      conversation.buyerId === currentUser?.uid ? "Buying" : "Selling";

    topRow.append(name, roleTag);

    const listingLine = document.createElement("span");
    listingLine.className = "conversation-listing";
    listingLine.textContent = conversation.listingTitle || "";

    const preview = document.createElement("span");
    preview.className = "conversation-preview";
    preview.textContent = conversation.lastMessage || "No messages yet";

    textWrap.append(topRow, listingLine, preview);
    item.append(avatar, textWrap);

    item.addEventListener("click", () => {
      selectConversation(conversation.id);
    });

    conversationList.appendChild(item);
  });
}

chatTabButtons.forEach((tabButton) => {
  tabButton.addEventListener("click", () => {
    chatFilter = tabButton.dataset.filter;
    chatTabButtons.forEach((otherTab) => otherTab.classList.remove("active"));
    tabButton.classList.add("active");
    renderConversationList();
  });
});

if (chatSearchInput) {
  chatSearchInput.addEventListener("input", renderConversationList);
}

function renderMessageThread(conversation) {
  messageThread.innerHTML = "";
  messageThread.classList.remove("no-selection");
  chatPanel.classList.add("has-selection");

  const header = document.createElement("div");
  header.className = "message-thread-header";

  const backLink = document.createElement("a");
  backLink.href = "#";
  backLink.textContent = "← Back to conversations";
  backLink.addEventListener("click", (event) => {
    event.preventDefault();
    selectedConversationId = null;
    if (unsubscribeMessages) unsubscribeMessages();
    chatPanel.classList.remove("has-selection");
    renderConversationList();
    messageThread.innerHTML =
      '<p class="message-thread-empty">Select a conversation to start chatting.</p>';
    messageThread.classList.add("no-selection");
  });

  const heading = document.createElement("h2");
  heading.textContent = otherPartyName(conversation);

  const subheading = document.createElement("p");
  subheading.textContent = conversation.listingTitle || "";

  const rateButton = document.createElement("button");
  rateButton.type = "button"; rateButton.className = "rate-button chat-rate-button"; rateButton.textContent = "Rate this person";
  rateButton.addEventListener("click", async () => {
    const otherId = currentUser.uid === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
    const otherName = otherPartyName(conversation);
    const rating = Number(prompt(`Rate ${otherName} from 1 to 5:`, "5"));
    if (!rating || rating < 1 || rating > 5) return;
    const comment = prompt("Optional review:", "") || "";
    try {
      const existing = await getDocs(query(collection(db, "reviews"), where("conversationId", "==", conversation.id)));
      if (existing.docs.some(d => d.data().reviewerId === currentUser.uid)) { alert("You have already rated this person for this conversation."); return; }
      await addDoc(collection(db, "reviews"), { listingId: conversation.listingId || "", conversationId: conversation.id, reviewerId: currentUser.uid, reviewerName: currentUser.email || "User", revieweeId: otherId, revieweeName: otherName, rating, comment, createdAt: serverTimestamp() });
      alert("Thanks — your rating was submitted.");
    } catch (error) { console.error(error); alert("The rating could not be submitted."); }
  });
  header.append(backLink, heading, subheading, rateButton);

  const messageList = document.createElement("div");
  messageList.className = "message-list";
  messageList.id = "message-list";

  const form = document.createElement("form");
  form.className = "message-form";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type a message...";
  input.required = true;
  input.autocomplete = "off";

  const sendButton = document.createElement("button");
  sendButton.type = "submit";
  sendButton.textContent = "Send";

  form.append(input, sendButton);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    sendButton.disabled = true;

    try {
      await addDoc(
        collection(db, "conversations", conversation.id, "messages"),
        {
          senderId: currentUser.uid,
          text,
          createdAt: serverTimestamp(),
        }
      );

      await updateDoc(doc(db, "conversations", conversation.id), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
      });

      const recipientId = currentUser.uid === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
      await addDoc(collection(db, "notifications"), {
        userId: recipientId, actorId: currentUser.uid, type: "message", title: "New message",
        message: `${currentUser.email || "Someone"} sent you a message about ${conversation.listingTitle || "a listing"}.`,
        listingId: conversation.listingId || "", conversationId: conversation.id, read: false, createdAt: serverTimestamp()
      });

      input.value = "";
    } catch (error) {
      console.error("Could not send message:", error);
      alert("Message could not be sent. Please try again.");
    } finally {
      sendButton.disabled = false;
      input.focus();
    }
  });

  messageThread.append(header, messageList, form);

  if (unsubscribeMessages) unsubscribeMessages();

  const messagesQuery = query(
    collection(db, "conversations", conversation.id, "messages"),
    orderBy("createdAt", "asc")
  );

  unsubscribeMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
      messageList.innerHTML = "";

      snapshot.docs.forEach((messageDoc) => {
        const message = messageDoc.data();
        const bubble = document.createElement("div");
        bubble.className = `message-bubble ${
          message.senderId === currentUser.uid ? "own" : "other"
        }`;
        bubble.textContent = message.text;
        messageList.appendChild(bubble);
      });

      messageList.scrollTop = messageList.scrollHeight;
    },
    (error) => {
      console.error("Could not load messages:", error);
    }
  );
}

function selectConversation(conversationId) {
  selectedConversationId = conversationId;
  renderConversationList();

  const conversation = conversations.find((c) => c.id === conversationId);
  if (conversation) {
    renderMessageThread(conversation);
  }
}

function listenForConversations() {
  const conversationsQuery = query(
    collection(db, "conversations"),
    where("participants", "array-contains", currentUser.uid),
    orderBy("lastMessageAt", "desc")
  );

  onSnapshot(
    conversationsQuery,
    (snapshot) => {
      conversations = snapshot.docs.map((conversationDoc) => ({
        id: conversationDoc.id,
        ...conversationDoc.data(),
      }));

      renderConversationList();

      if (selectedConversationId) {
        const conversation = conversations.find(
          (c) => c.id === selectedConversationId
        );
        if (conversation) {
          renderMessageThread(conversation);
        }
      } else {
        const params = new URLSearchParams(window.location.search);
        const requestedId = params.get("conversation");

        if (requestedId && conversations.some((c) => c.id === requestedId)) {
          selectConversation(requestedId);
        }
      }
    },
    (error) => {
      console.error("Could not load conversations:", error);
      conversationListEmpty.textContent =
        "Conversations could not be loaded. Please refresh and try again.";
      conversationList.innerHTML = "";
      conversationList.appendChild(conversationListEmpty);
    }
  );
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    userStatus.textContent = user.email;
    authButton.textContent = "Log out";

    signedOutMessage.classList.add("hidden");
    messagesLayout.classList.remove("hidden");

    listenForConversations();
  } else {
    userStatus.textContent = "Browsing as guest";
    authButton.textContent = "Log in";

    signedOutMessage.classList.remove("hidden");
    messagesLayout.classList.add("hidden");

    conversations = [];
    selectedConversationId = null;
    if (unsubscribeMessages) unsubscribeMessages();
  }
});
