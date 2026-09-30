import { collection, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db, esc, money, thumb, safeUrl, createdMillis } from "./shop-common.js";

const params = new URLSearchParams(location.search);
const id = params.get("id");
const from = params.get("from");
const loading = document.getElementById("shop-loading");
const notFound = document.getElementById("shop-not-found");
const detail = document.getElementById("shop-detail");

// Send people back to where they came from (team page or owner page), not always to the shop list.
const back = document.getElementById("shop-back");
if (from === "agent") { back.href = "agent.html#shops"; back.textContent = "← Back to the team page"; }
if (from === "owner") { back.href = "my-shop.html"; back.textContent = "← Back to my shop"; }

function showNotFound() {
  loading.classList.add("hidden");
  detail.classList.add("hidden");
  notFound.classList.remove("hidden");
}

let currentPhotos = "";
function renderPhotos(photos) {
  const list = (Array.isArray(photos) ? photos : []).map(safeUrl).filter(Boolean);
  const key = list.join("|");
  if (key === currentPhotos) return;
  currentPhotos = key;
  const main = document.getElementById("shop-main-photo");
  const emptyBox = document.getElementById("shop-photo-empty");
  const thumbs = document.getElementById("shop-thumbs");
  thumbs.innerHTML = "";
  if (!list.length) { main.classList.add("hidden"); emptyBox.classList.remove("hidden"); return; }
  main.src = thumb(list[0], 1000);
  main.classList.remove("hidden");
  emptyBox.classList.add("hidden");
  if (list.length > 1) {
    list.forEach((url) => {
      const t = document.createElement("img");
      t.src = thumb(url, 160);
      t.alt = "Shop photo";
      t.loading = "lazy";
      t.addEventListener("click", () => { main.src = thumb(url, 1000); });
      thumbs.appendChild(t);
    });
  }
}

function renderShop(shop) {
  document.title = `${shop.name || "Shop"} | PZ Online`;
  document.getElementById("shop-name").textContent = shop.name || "Shop";
  document.getElementById("shop-category").textContent = [shop.category, shop.location].filter(Boolean).join(" • ");
  document.getElementById("shop-address").textContent = shop.address ? `📍 ${shop.address}` : "";
  const badge = document.getElementById("shop-badge");
  const open = shop.status === "trial" || shop.status === "active";
  badge.textContent = open ? "✓ Visited by the PZ team" : "Preview: not visible to customers yet";
  const call = document.getElementById("shop-call");
  const phone = String(shop.phone || "").replace(/[^\d+]/g, "");
  if (phone) { call.href = `tel:${phone}`; call.classList.remove("hidden"); } else { call.classList.add("hidden"); }
  renderPhotos(shop.photos);
  loading.classList.add("hidden");
  notFound.classList.add("hidden");
  detail.classList.remove("hidden");
}

function renderProducts(products) {
  const grid = document.getElementById("product-grid");
  const emptyMsg = document.getElementById("product-empty");
  grid.innerHTML = "";
  document.getElementById("product-count").textContent = `${products.length} product${products.length === 1 ? "" : "s"}`;
  emptyMsg.classList.toggle("hidden", products.length > 0);
  products.forEach((p) => {
    const photo = thumb(p.image, 500);
    const inStock = p.inStock !== false;
    const item = document.createElement("article");
    item.className = "sp-product";
    item.innerHTML = `
      ${photo ? `<img class="sp-product-photo" src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="sp-product-empty" aria-hidden="true">🛍</div>`}
      <div class="sp-product-body">
        <h3>${esc(p.name)}</h3>
        <p class="sp-product-price">${money(p.price)}</p>
        ${p.description ? `<p class="sp-product-desc">${esc(p.description)}</p>` : ""}
        ${inStock ? `<span class="sp-in">In stock</span>` : `<span class="sp-out">Out of stock</span>`}
      </div>`;
    grid.appendChild(item);
  });
}

if (!id) {
  showNotFound();
} else {
  // Live: when the owner changes a price or marks an item out of stock, this page updates by itself.
  onSnapshot(
    doc(db, "shops", id),
    (snap) => (snap.exists() ? renderShop(snap.data()) : showNotFound()),
    (e) => { console.error(e); showNotFound(); }, // shops that are not open yet are refused by the rules
  );
  onSnapshot(
    collection(db, "shops", id, "products"),
    (snap) => {
      const products = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => createdMillis(b) - createdMillis(a));
      renderProducts(products);
    },
    (e) => console.error(e),
  );
}
