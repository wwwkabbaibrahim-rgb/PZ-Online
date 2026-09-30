import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  auth, db, esc, getPosition, parseLatLng, looksLikeSierraLeone, mapLink, STATUS_LABELS,
} from "./shop-common.js";
import { mountProductManager } from "./product-manager.js";

const $ = (id) => document.getElementById(id);
const STATES = ["os-checking", "os-auth", "os-main"];

let me = null;
let stoppers = [];   // live product lists, stopped when the person logs out or the list is redrawn
let mode = "signup";

const setState = (name) => STATES.forEach((s) => $(s).classList.toggle("hidden", s !== name));
function say(el, text, kind) {
  el.textContent = text || "";
  el.classList.remove("ok", "bad");
  if (kind) el.classList.add(kind);
}
function stopAll() { stoppers.forEach((s) => s()); stoppers = []; }

/* ---------- Sign up / log in ---------- */
function authMessage(e) {
  switch (e?.code) {
    case "auth/email-already-in-use": return "That email already has an account. Choose Log in instead.";
    case "auth/invalid-email": return "That email address does not look right.";
    case "auth/weak-password": return "Use a password with at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "The email or password is not correct.";
    case "auth/too-many-requests": return "Too many tries. Wait a few minutes and try again.";
    case "auth/network-request-failed": return "No connection. Check the internet and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request": return "";
    default: return "Could not sign in. Try again.";
  }
}

document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
  mode = b.dataset.mode;
  document.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("active", x === b));
  $("os-auth-submit").textContent = mode === "signup" ? "Create business account" : "Log in";
  $("os-password").autocomplete = mode === "signup" ? "new-password" : "current-password";
  say($("os-auth-status"), "");
}));

$("os-auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("os-auth-status");
  const email = $("os-email").value.trim();
  const password = $("os-password").value;
  if (!email || !password) { say(status, "Add your email and password.", "bad"); return; }
  const btn = $("os-auth-submit");
  btn.disabled = true;
  say(status, mode === "signup" ? "Creating your account..." : "Logging in...");
  try {
    if (mode === "signup") await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
    say(status, "");
  } catch (err) {
    console.error(err);
    say(status, authMessage(err), "bad");
  } finally {
    btn.disabled = false;
  }
});

$("os-google").addEventListener("click", async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (err) { console.error(err); say($("os-auth-status"), authMessage(err), "bad"); }
});

$("os-reset").addEventListener("click", async () => {
  const status = $("os-auth-status");
  const email = $("os-email").value.trim();
  if (!email) { say(status, "Type your email above first, then press Forgot password.", "bad"); return; }
  try { await sendPasswordResetEmail(auth, email); say(status, "Password reset email sent. Check your inbox.", "ok"); }
  catch (err) { console.error(err); say(status, authMessage(err) || "Could not send the email.", "bad"); }
});

$("os-logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  stopAll();
  me = user || null;
  if (!user) { setState("os-auth"); return; }
  setState("os-main");
  const fromLink = new URLSearchParams(location.search).get("claim");
  if (fromLink && !$("os-claim-key").value) $("os-claim-key").value = fromLink;
  await loadOwned();
});

/* ---------- Link a shop with its owner code ---------- */
$("os-claim-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("os-claim-status");
  const btn = $("os-claim-submit");
  const key = $("os-claim-key").value.trim().replace(/\s+/g, "");
  const cut = key.indexOf("-");
  const shopId = cut > 0 ? key.slice(0, cut) : "";
  const code = cut > 0 ? key.slice(cut + 1).toUpperCase() : "";
  if (!/^[A-Za-z0-9]{10,40}$/.test(shopId) || code.length < 4) {
    say(status, "That code does not look right. Paste it exactly as the PZ team sent it.", "bad");
    return;
  }
  btn.disabled = true;
  say(status, "Linking your shop...");
  try {
    await setDoc(doc(db, "shopOwners", shopId), { uid: me.uid, code, claimedAt: serverTimestamp() });
    $("os-claim-key").value = "";
    history.replaceState(null, "", location.pathname);
    say(status, "Shop linked.", "ok");
    await loadOwned();
  } catch (err) {
    console.error(err);
    say(status, err.code === "permission-denied"
      ? "This code is not valid, or the shop is already linked to someone. Ask the PZ team to check it."
      : "Could not link the shop. Check the connection and try again.", "bad");
  } finally {
    btn.disabled = false;
  }
});

/* ---------- The owner's shops ---------- */
async function loadOwned() {
  stopAll();
  const holder = $("os-shops");
  holder.innerHTML = "";
  let ids = [];
  try {
    const snap = await getDocs(query(collection(db, "shopOwners"), where("uid", "==", me.uid)));
    ids = snap.docs.map((d) => d.id);
  } catch (e) { console.error(e); }
  const shops = [];
  for (const id of ids) {
    try {
      const s = await getDoc(doc(db, "shops", id));
      if (s.exists()) shops.push({ id, ...s.data() });
    } catch (e) { console.error(e); }
  }
  $("os-empty").classList.toggle("hidden", shops.length > 0);
  $("os-claim-panel").querySelector("h2").textContent = shops.length ? "Add another shop with a shop code" : "Add your shop with a shop code";
  shops.forEach((s) => holder.appendChild(shopSection(s)));
}

function shopSection(shop) {
  const isPublic = shop.status === "trial" || shop.status === "active";
  const section = document.createElement("section");
  section.className = "sp-panel os-shop";
  section.innerHTML = `
    <div class="os-head">
      <div><h2>${esc(shop.name)}</h2><p>${esc(shop.category)} • ${esc(shop.location)}</p></div>
      <span class="sp-badge ${esc(shop.status)}">${esc(STATUS_LABELS[shop.status] || shop.status)}</span>
    </div>
    ${isPublic ? "" : `<p class="os-pending">${shop.status === "suspended"
      ? "This shop is paused and customers cannot see it. Contact the PZ team."
      : "Your shop is waiting for approval. You can add products now. Customers will see it once the PZ team approves it."}</p>`}
    <div class="shop-hero-actions" style="margin:0 0 14px"><a class="secondary-button" href="shop.html?id=${encodeURIComponent(shop.id)}&from=owner">${isPublic ? "See how customers see my shop" : "Preview my shop page"}</a></div>

    <details class="os-details">
      <summary>Shop phone, address and map location</summary>
      <form class="sp-form" data-details novalidate style="margin-top:12px">
        <label class="sp-field">Shop phone<input data-f="phone" type="tel" maxlength="20" value="${esc(shop.phone || "")}"></label>
        <label class="sp-field">Address and landmark<input data-f="address" maxlength="240" value="${esc(shop.address || "")}"></label>
        <div class="sp-field wide">Map location
          <div class="sp-gps"><button type="button" class="secondary-button" data-gps>Use my current location</button>
            <span class="upload-status" data-gps-status>${shop.lat != null && shop.lng != null ? "A location is saved." : "No location saved yet."}</span>
            <a class="sp-map-link ${shop.lat != null && shop.lng != null ? "" : "hidden"}" data-map target="_blank" rel="noopener" href="${shop.lat != null && shop.lng != null ? esc(mapLink(shop.lat, shop.lng)) : "#"}">Check on map</a></div>
          <div class="sp-location-manual"><input data-f="latlng" placeholder="Or paste: 8.4657, -13.2317 or a Google Maps link"><button type="button" class="secondary-button" data-latlng>Use these</button></div>
        </div>
        <div class="sp-actions"><button type="submit" class="primary-button">Save shop details</button><p class="sp-status-line" data-msg role="status"></p></div>
      </form>
    </details>

    <div class="pm-root"></div>`;

  // Shop details
  let lat = shop.lat ?? null;
  let lng = shop.lng ?? null;
  const form = section.querySelector("[data-details]");
  const msg = section.querySelector("[data-msg]");
  const gpsStatus = section.querySelector("[data-gps-status]");
  const mapA = section.querySelector("[data-map]");
  const field = (f) => form.querySelector(`[data-f="${f}"]`);

  function setLocation(la, ln, note) {
    lat = Number(la.toFixed(6));
    lng = Number(ln.toFixed(6));
    mapA.href = mapLink(lat, lng);
    mapA.classList.remove("hidden");
    gpsStatus.textContent = `${note}${looksLikeSierraLeone(lat, lng) ? "" : " This looks outside Sierra Leone. Check it on the map."} Press Save shop details to keep it.`;
  }
  section.querySelector("[data-gps]").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    gpsStatus.textContent = "Finding your location. Allow location if the browser asks...";
    try {
      const p = await getPosition();
      setLocation(p.lat, p.lng, `Location found (accurate to about ${Math.round(p.accuracy)} m).`);
    } catch (err) { gpsStatus.textContent = err.message; }
    finally { btn.disabled = false; }
  });
  section.querySelector("[data-latlng]").addEventListener("click", () => {
    const p = parseLatLng(field("latlng").value);
    if (!p) { gpsStatus.textContent = "Could not read that. Paste coordinates like 8.4657, -13.2317."; return; }
    setLocation(p.lat, p.lng, "Location read from what you pasted.");
  });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const phone = field("phone").value.trim();
    const address = field("address").value.trim();
    if (!phone || !address) { say(msg, "The phone and address cannot be empty.", "bad"); return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await updateDoc(doc(db, "shops", shop.id), { phone, address, lat, lng, updatedAt: serverTimestamp() });
      say(msg, "Saved.", "ok");
    } catch (err) {
      console.error(err);
      say(msg, "Could not save. Try again.", "bad");
    } finally { btn.disabled = false; }
  });

  // Products, live
  stoppers.push(mountProductManager(section.querySelector(".pm-root"), shop.id, me.uid));
  return section;
}
