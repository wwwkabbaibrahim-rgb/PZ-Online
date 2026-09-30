import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  auth, db, esc, thumb, uploadMany, fillSelect, createdMillis, getPosition, parseLatLng,
  looksLikeSierraLeone, mapLink, makeOwnerCode, copyText, SHOP_CATEGORIES, LOCATIONS, STATUS_LABELS,
} from "./shop-common.js";
import { mountProductManager } from "./product-manager.js";

const $ = (id) => document.getElementById(id);
const STATES = ["agent-checking", "agent-signed-out", "agent-denied", "agent-ready"];
const TABS = ["register", "shops", "products"];

let me = null;            // { uid, name, role, manager }
let shops = [];           // shops this person can see; staff also get _private and _owned
let stopProducts = null;  // stops the live product list of the shop being edited

function setState(name) {
  STATES.forEach((s) => $(s).classList.toggle("hidden", s !== name));
}

function say(el, text, kind) {
  el.textContent = text || "";
  el.classList.remove("ok", "bad");
  if (kind) el.classList.add(kind);
}

/* ---------- Access ---------- */
async function getRole(user) {
  try {
    const s = await getDoc(doc(db, "staff", user.uid));
    if (s.exists() && ["owner", "manager", "agent"].includes(s.data().role)) return s.data().role;
  } catch (e) { console.error(e); }
  try {
    // The existing site admin also gets manager access here.
    const a = await getDoc(doc(db, "admins", user.uid));
    if (a.exists() && a.data().role === "admin") return "manager";
  } catch (e) { console.error(e); }
  return null;
}

onAuthStateChanged(auth, async (user) => {
  me = null;
  if (stopProducts) { stopProducts(); stopProducts = null; }
  if (!user) { setState("agent-signed-out"); return; }
  setState("agent-checking");
  const role = await getRole(user);
  if (!role) {
    $("agent-uid").textContent = user.uid;
    setState("agent-denied");
    return;
  }
  me = { uid: user.uid, name: user.displayName || user.email || "PZ team", role, manager: role === "owner" || role === "manager" };
  $("agent-role-line").textContent = me.manager
    ? "You are a manager. You can approve shops and see every shop."
    : "You are a field agent. Register shops, add their products and follow their approval.";
  $("shops-title").textContent = me.manager ? "All shops" : "My shops";
  $("shops-sub").textContent = me.manager
    ? "Approve new shops, change their status, and give owners their shop code."
    : "Shops you registered, their approval, and the code the owner uses to log in.";
  setState("agent-ready");
  showTab(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "register", false);
  await loadShops();
});

/* ---------- Tabs (the chosen tab is kept in the address, so coming back from a preview lands on the same tab) ---------- */
function showTab(name, remember = true) {
  document.querySelectorAll(".sp-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== name));
  if (remember) history.replaceState(null, "", `#${name}`);
}
document.querySelectorAll(".sp-tab").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

fillSelect($("f-category"), SHOP_CATEGORIES, "Choose a category");
fillSelect($("f-location"), LOCATIONS, "Choose an area");

/* ---------- Map location ---------- */
function applyLocation(lat, lng, note) {
  $("f-lat").value = Number(lat).toFixed(6);
  $("f-lng").value = Number(lng).toFixed(6);
  const link = $("f-map-link");
  link.href = mapLink(Number(lat).toFixed(6), Number(lng).toFixed(6));
  link.classList.remove("hidden");
  const warn = looksLikeSierraLeone(lat, lng) ? "" : " This looks outside Sierra Leone. Check it on the map.";
  $("f-gps-status").textContent = `${note}${warn}`;
}

$("f-gps").addEventListener("click", async () => {
  const btn = $("f-gps");
  btn.disabled = true;
  $("f-gps-status").textContent = "Finding your location. Allow location if the browser asks...";
  try {
    const p = await getPosition();
    applyLocation(p.lat, p.lng, `Location saved (accurate to about ${Math.round(p.accuracy)} m).`);
  } catch (err) {
    $("f-gps-status").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$("f-latlng-use").addEventListener("click", () => {
  const p = parseLatLng($("f-latlng").value);
  if (!p) {
    $("f-gps-status").textContent = "Could not read that. Paste coordinates like 8.4657, -13.2317, or a Google Maps link that shows them.";
    return;
  }
  applyLocation(p.lat, p.lng, "Location saved from what you pasted.");
});

/* ---------- Register a shop ---------- */
$("shop-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!me) return;
  const status = $("f-status");
  const btn = $("f-submit");

  const v = (id) => $(id).value.trim();
  const required = [
    ["f-name", "the shop name"], ["f-category", "a category"], ["f-location", "the area"],
    ["f-phone", "the shop phone"], ["f-address", "the address and landmark"],
    ["f-owner", "the owner's name"], ["f-owner-phone", "the owner's phone"],
  ];
  for (const [id, label] of required) {
    if (!v(id)) { say(status, `Add ${label}.`, "bad"); $(id).focus(); return; }
  }
  const files = Array.from($("f-photos").files || []).slice(0, 3);
  if (!files.length) { say(status, "Add at least one photo of the shop.", "bad"); return; }
  if (!["c-id", "c-visit", "c-prices", "c-trial"].every((id) => $(id).checked)) {
    say(status, "Tick every box in the checklist before you submit.", "bad");
    return;
  }

  btn.disabled = true;
  try {
    const photos = await uploadMany(files, (done, total) => say(status, `Uploading photos (${done} of ${total})...`));

    const lat = parseFloat($("f-lat").value);
    const lng = parseFloat($("f-lng").value);
    const ref = doc(collection(db, "shops"));

    say(status, "Saving shop...");
    await setDoc(ref, {
      name: v("f-name"),
      category: v("f-category"),
      location: v("f-location"),
      phone: v("f-phone"),
      address: v("f-address"),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      photos,
      status: "pending",
      registeredBy: me.uid,
      createdAt: serverTimestamp(),
    });

    try {
      await setDoc(doc(db, "shopPrivate", ref.id), {
        ownerName: v("f-owner"),
        ownerPhone: v("f-owner-phone"),
        notes: v("f-notes"),
        claimCode: makeOwnerCode(),
        checklist: { ownerIdSeen: true, visitedInPerson: true, pricesChecked: true, trialExplained: true },
        registeredBy: me.uid,
        registeredByName: me.name,
        createdAt: serverTimestamp(),
      });
    } catch (privateError) {
      console.error(privateError);
      say(status, "The shop was saved, but the owner details were not. Tell the manager before you leave.", "bad");
      await loadShops();
      return;
    }

    $("shop-form").reset();
    $("f-lat").value = "";
    $("f-lng").value = "";
    $("f-map-link").classList.add("hidden");
    $("f-gps-status").textContent = "No location saved yet.";
    say(status, "");
    await loadShops();
    showTab("shops");
  } catch (err) {
    console.error(err);
    say(status, err.message || "Could not save the shop. Check the connection and try again.", "bad");
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Shops list ---------- */
async function loadShops() {
  try {
    const snap = me.manager
      ? await getDocs(collection(db, "shops"))
      : await getDocs(query(collection(db, "shops"), where("registeredBy", "==", me.uid)));
    shops = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => createdMillis(b) - createdMillis(a));
    await Promise.all(shops.map(async (s) => {
      try { const p = await getDoc(doc(db, "shopPrivate", s.id)); s._private = p.exists() ? p.data() : {}; }
      catch (e) { s._private = {}; }
      try { s._owned = (await getDoc(doc(db, "shopOwners", s.id))).exists(); }
      catch (e) { s._owned = false; }
    }));
  } catch (e) {
    console.error(e);
    shops = [];
    const empty = $("shops-empty");
    empty.textContent = "Shops could not be loaded. Refresh the page.";
    empty.classList.remove("hidden");
    return;
  }
  renderShops();
  fillProductShopSelect();
}

function ownerKey(shop) {
  return `${shop.id}-${shop._private.claimCode}`;
}

function inviteText(shop) {
  return `Your shop "${shop.name}" is ready on PZ Online. Create your business account and manage your products and prices here: ${location.origin}/my-shop.html?claim=${ownerKey(shop)}`;
}

function renderShops() {
  const list = $("shops-list");
  const empty = $("shops-empty");
  list.innerHTML = "";
  empty.textContent = "No shops yet. Register the first one.";
  empty.classList.toggle("hidden", shops.length > 0);

  shops.forEach((s) => {
    const p = s._private || {};
    const photo = thumb(Array.isArray(s.photos) ? s.photos[0] : "", 160);
    const isPublic = s.status === "trial" || s.status === "active";
    const el = document.createElement("div");
    el.className = "sp-item";
    const managerLine = me.manager
      ? `<span>Owner: ${esc(p.ownerName || "-")} ${esc(p.ownerPhone || "")} • Registered by ${esc(p.registeredByName || "-")}</span>`
      : "";
    const tools = me.manager
      ? `<select aria-label="Shop status">${["pending", "trial", "active", "suspended"]
          .map((k) => `<option value="${k}" ${k === s.status ? "selected" : ""}>${esc(STATUS_LABELS[k])}</option>`).join("")}</select>
         <button type="button" class="primary-button" data-save>Save</button>`
      : "";
    el.innerHTML = `
      ${photo ? `<img class="sp-item-photo" src="${esc(photo)}" alt="">` : ""}
      <div class="sp-item-main">
        <strong>${esc(s.name)}</strong>
        <span>${esc(s.category)} • ${esc(s.location)}</span>
        <span>${esc(s.address)}</span>
        ${managerLine}
        <span class="${s._owned ? "sp-owner-linked" : "sp-owner-open"}">${s._owned ? "✓ Owner account linked" : "Owner has not linked an account yet"}</span>
      </div>
      <div class="sp-item-tools">
        <span class="sp-badge ${esc(s.status)}">${esc(STATUS_LABELS[s.status] || s.status)}</span>
        ${tools}
        <a class="secondary-button" href="shop.html?id=${encodeURIComponent(s.id)}&from=agent">${isPublic ? "View page" : "Preview page"}</a>
        <button type="button" class="secondary-button" data-code>Owner code</button>
      </div>
      <div class="sp-owner-box hidden" data-codebox></div>`;

    const save = el.querySelector("[data-save]");
    if (save) {
      save.addEventListener("click", async () => {
        const next = el.querySelector("select").value;
        if (next === s.status) return;
        save.disabled = true;
        try {
          await updateDoc(doc(db, "shops", s.id), { status: next, statusUpdatedAt: serverTimestamp(), statusUpdatedBy: me.uid });
          await loadShops();
        } catch (err) {
          console.error(err);
          alert("Could not change the status. Try again.");
          save.disabled = false;
        }
      });
    }

    el.querySelector("[data-code]").addEventListener("click", async () => {
      const box = el.querySelector("[data-codebox]");
      if (!box.classList.contains("hidden")) { box.classList.add("hidden"); return; }
      try {
        if (!s._private.claimCode) {
          // Shops registered before owner accounts existed do not have a code yet.
          const claimCode = makeOwnerCode();
          await setDoc(doc(db, "shopPrivate", s.id), { claimCode }, { merge: true });
          s._private.claimCode = claimCode;
        }
      } catch (err) {
        console.error(err);
        alert("Could not create the owner code. Try again.");
        return;
      }
      box.innerHTML = `
        <strong>Owner code for ${esc(s.name)}</strong>
        <span class="sp-uid">${esc(ownerKey(s))}</span>
        <div class="sp-owner-row">
          <button type="button" class="primary-button" data-copy-code>Copy code</button>
          <button type="button" class="secondary-button" data-copy-invite>Copy invite message</button>
        </div>
        <small>Give this to the shop owner. It only works once. After they link it, only they can manage this shop.</small>`;
      box.querySelector("[data-copy-code]").addEventListener("click", async (ev) => {
        const ok = await copyText(ownerKey(s));
        ev.currentTarget.textContent = ok ? "Copied ✓" : "Copy code";
      });
      box.querySelector("[data-copy-invite]").addEventListener("click", async (ev) => {
        const ok = await copyText(inviteText(s));
        ev.currentTarget.textContent = ok ? "Copied ✓" : "Copy invite message";
      });
      box.classList.remove("hidden");
    });

    list.appendChild(el);
  });
}

/* ---------- Products (add, edit prices, stock, photos) ---------- */
function fillProductShopSelect() {
  const sel = $("p-shop");
  const previous = sel.value;
  sel.innerHTML = "";
  if (!shops.length) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "Register a shop first";
    sel.appendChild(o);
    if (stopProducts) { stopProducts(); stopProducts = null; }
    $("pm-root").innerHTML = "";
    return;
  }
  shops.forEach((s) => {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = `${s.name} (${STATUS_LABELS[s.status] || s.status})`;
    sel.appendChild(o);
  });
  if (previous && shops.some((s) => s.id === previous)) sel.value = previous;
  openProducts();
}

function openProducts() {
  if (stopProducts) { stopProducts(); stopProducts = null; }
  const shopId = $("p-shop").value;
  if (!shopId || !me) { $("pm-root").innerHTML = ""; return; }
  stopProducts = mountProductManager($("pm-root"), shopId, me.uid);
}
$("p-shop").addEventListener("change", openProducts);
