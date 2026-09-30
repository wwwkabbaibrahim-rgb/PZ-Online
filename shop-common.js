import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Same Firebase project as the rest of PZ Online.
const config = {
  apiKey: "AIzaSyD5tdmon0-6R_IABZyUo8QEfSKlTBrmLTo",
  authDomain: "markethub-prototype.firebaseapp.com",
  projectId: "markethub-prototype",
  storageBucket: "markethub-prototype.firebasestorage.app",
  messagingSenderId: "350124318634",
  appId: "1:350124318634:web:cb4401e9f84edcdd5995d3",
};

export const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const esc = (v) =>
  String(v ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));

export const money = (v) => `Le ${new Intl.NumberFormat("en-SL").format(Number(v) || 0)}`;

// Only allow https image links to be rendered.
export const safeUrl = (u) => (/^https:\/\//i.test(u || "") ? u : "");

// Cloudinary can serve a smaller, optimised copy of any photo. This makes pages load much faster on mobile data.
export function thumb(url, width = 600) {
  const u = safeUrl(url);
  if (u.includes("res.cloudinary.com") && u.includes("/upload/") && !u.includes("/upload/w_")) {
    return u.replace("/upload/", `/upload/w_${width},c_limit,q_auto,f_auto/`);
  }
  return u;
}

export const SHOP_CATEGORIES = [
  "Groceries & Supermarket",
  "Food & Drinks",
  "Electronics & Phones",
  "Fashion & Beauty",
  "Home & Furniture",
  "Building Materials",
  "Health & Personal Care",
  "Office & Stationery",
  "Baby & Kids",
  "Other",
];

export const LOCATIONS = [
  "Freetown", "Aberdeen", "Lumley", "Wilberforce", "Juba", "Hill Station", "Brookfields", "Congo Town",
  "Murray Town", "Tengbeh Town", "Central Freetown", "Kroo Bay", "Kissy", "Wellington", "Calaba Town",
  "Allen Town", "Cline Town", "Portee", "Fourah Bay", "Up Gun", "Magazine", "Tower Hill", "New England",
  "Bo", "Kenema", "Makeni", "Koidu", "Waterloo", "Port Loko",
];

export const STATUS_LABELS = {
  pending: "Waiting for approval",
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
};

/* ---------------------------------------------------------------
   Photos: shrink first, then upload. A phone photo is often 4 to 10 MB;
   after shrinking it is usually 150 to 400 KB, so it uploads in seconds.
---------------------------------------------------------------- */
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/sgagbjny/image/upload";
const CLOUDINARY_PRESET = "marketplace_unsigned";

export async function compressImage(file, maxSide = 1280, quality = 0.82) {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      bitmap = await createImageBitmap(file);
    }
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (bitmap.close) bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size < file.size) {
      return new File([blob], `${(file.name || "photo").replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
    }
  } catch (e) {
    console.warn("Could not shrink the photo, uploading the original.", e);
  }
  return file;
}

export async function uploadPhoto(file) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 30 * 1024 * 1024) throw new Error("That photo is too large. Choose one under 30 MB.");
  const small = await compressImage(file);
  const body = new FormData();
  body.append("file", small);
  body.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(CLOUDINARY_URL, { method: "POST", body });
  if (!res.ok) throw new Error("Photo upload failed. Check the connection and try again.");
  const data = await res.json();
  return data.secure_url;
}

// Uploads several photos at the same time. onProgress(done, total) is called as each one finishes.
export async function uploadMany(files, onProgress) {
  let done = 0;
  if (onProgress) onProgress(0, files.length);
  return Promise.all(
    files.map(async (f) => {
      const url = await uploadPhoto(f);
      done += 1;
      if (onProgress) onProgress(done, files.length);
      return url;
    }),
  );
}

/* ---------------------------------------------------------------
   Location
---------------------------------------------------------------- */
function geoError(err) {
  if (err && err.code === 1) {
    return new Error("Location is blocked. Allow location for this site in the browser settings, turn on GPS on the phone, then try again.");
  }
  if (err && err.code === 2) {
    return new Error("This device could not work out its location. Go outdoors or near a window, turn on GPS, or paste the coordinates instead.");
  }
  if (err && err.code === 3) {
    return new Error("Finding the location took too long. Try again outdoors, or paste the coordinates instead.");
  }
  return new Error("Could not get the location. Paste the coordinates instead.");
}

const askPosition = (options) =>
  new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));

export async function getPosition() {
  if (!navigator.geolocation) {
    throw new Error("This browser cannot share its location. Paste the coordinates instead.");
  }
  if (!window.isSecureContext) {
    throw new Error(
      "Location only works on secure pages. Open the site with https:// (your Vercel address), or at http://127.0.0.1:5500 on the same computer. " +
      "A phone that opens the computer's network address (192.168...) is blocked by the browser.",
    );
  }
  let pos;
  try {
    pos = await askPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  } catch (first) {
    if (first && first.code === 1) throw geoError(first);
    try {
      pos = await askPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    } catch (second) {
      throw geoError(second);
    }
  }
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
}

// Accepts "8.4657, -13.2317", a Google Maps link containing coordinates, or an OpenStreetMap link.
export function parseLatLng(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const alt = t.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  const pair = alt || t.match(/(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/);
  if (!pair) return null;
  const lat = parseFloat(pair[1]);
  const lng = parseFloat(pair[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export const looksLikeSierraLeone = (lat, lng) => lat > 6.8 && lat < 10.1 && lng > -13.5 && lng < -10.1;

export const mapLink = (lat, lng) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

/* ---------------------------------------------------------------
   Owner codes and small helpers
---------------------------------------------------------------- */
export function makeOwnerCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    window.prompt("Copy this text:", text);
    return false;
  }
}

export function fillSelect(select, items, placeholder) {
  if (!select) return;
  select.innerHTML = "";
  if (placeholder !== undefined) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = placeholder;
    select.appendChild(o);
  }
  items.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

export const createdMillis = (x) => x.createdAt?.toMillis?.() || 0;
