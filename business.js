import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db, esc, thumb, SHOP_CATEGORIES, fillSelect, createdMillis } from "./shop-common.js";

const grid = document.getElementById("shop-grid");
const count = document.getElementById("shop-count");
const empty = document.getElementById("shop-empty");
const search = document.getElementById("shop-search");
const category = document.getElementById("shop-category");

fillSelect(category, SHOP_CATEGORIES, "All categories");

let shops = [];

function card(shop) {
  const photo = thumb(Array.isArray(shop.photos) ? shop.photos[0] : "", 600);
  const a = document.createElement("a");
  a.className = "shop-card";
  a.href = `shop.html?id=${encodeURIComponent(shop.id)}`;
  a.innerHTML = `
    ${photo ? `<img class="shop-cover" src="${esc(photo)}" alt="${esc(shop.name)}" loading="lazy">` : `<div class="shop-cover-empty" aria-hidden="true">🏪</div>`}
    <div class="shop-card-body">
      <span class="shop-visited">✓ Visited by the PZ team</span>
      <h3>${esc(shop.name)}</h3>
      <p class="shop-card-meta">${esc(shop.category || "")} • ${esc(shop.location || "")}</p>
    </div>`;
  return a;
}

function render() {
  const term = search.value.trim().toLowerCase();
  const cat = category.value;
  let data = shops;
  if (cat) data = data.filter((s) => s.category === cat);
  if (term) data = data.filter((s) => `${s.name || ""} ${s.category || ""} ${s.location || ""} ${s.address || ""}`.toLowerCase().includes(term));
  grid.innerHTML = "";
  data.forEach((s) => grid.appendChild(card(s)));
  count.textContent = `${data.length} shop${data.length === 1 ? "" : "s"}`;
  if (data.length === 0) {
    empty.textContent = shops.length === 0
      ? "The first shops are being registered. Check back soon."
      : "No shops match your search.";
  }
  empty.classList.toggle("hidden", data.length !== 0);
}

[search, category].forEach((el) => el.addEventListener("input", render));

(async function load() {
  try {
    const snap = await getDocs(query(collection(db, "shops"), where("status", "in", ["trial", "active"])));
    shops = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => createdMillis(b) - createdMillis(a));
    render();
  } catch (e) {
    console.error(e);
    empty.textContent = "Shops could not be loaded. Please refresh the page.";
    empty.classList.remove("hidden");
  }
})();
