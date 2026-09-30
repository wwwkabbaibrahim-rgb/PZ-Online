import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, getDocs, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Use the same project configuration as the main PZ Online app.
const realConfig = {
  apiKey: "AIzaSyD5tdmon0-6R_IABZyUo8QEfSKlTBrmLTo",
  authDomain: "markethub-prototype.firebaseapp.com",
  projectId: "markethub-prototype",
  storageBucket: "markethub-prototype.firebasestorage.app",
  messagingSenderId: "350124318634",
  appId: "1:350124318634:web:cb4401e9f84edcdd5995d3",
};
const app = getApps().length ? getApp() : initializeApp(realConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const params = new URLSearchParams(location.search);
const selectedCategory = params.get("category") || "All";
const initialSearch = params.get("search") || "";
const initialLocation = params.get("location") || "";
const recentOnly = params.get("view") === "recent";
const searchInput = document.getElementById("browse-search");
const categoryFilter = document.getElementById("browse-category");
const locationFilter = document.getElementById("browse-location");
const minPrice = document.getElementById("browse-min-price");
const maxPrice = document.getElementById("browse-max-price");
const sortFilter = document.getElementById("browse-sort");
const grid = document.getElementById("browse-grid");
const count = document.getElementById("browse-count");
const heading = document.getElementById("browse-heading");
const empty = document.getElementById("browse-empty");

const categories = ["Mobiles","Okada & Motorbikes","Cars & Vehicles","Electronics","Phones & Accessories","Home & Furniture","Land & Property","Fashion","Agriculture","Food & Drinks","Building Materials","Generators & Solar","Spare Parts","Jobs","Beauty","Education","Services","Pets & Animals","Baby & Kids","Health & Personal Care","Office & Business","Sports & Hobbies"];
const locations = ["Freetown","Aberdeen","Lumley","Wilberforce","Juba","Hill Station","Brookfields","Congo Town","Murray Town","Tengbeh Town","Central Freetown","Kroo Bay","Kissy","Wellington","Calaba Town","Allen Town","Cline Town","Portee","Fourah Bay","Up Gun","Magazine","Tower Hill","New England","Bo","Kenema","Makeni","Koidu","Waterloo","Port Loko"];

categories.forEach((value) => { const o=document.createElement("option"); o.value=value; o.textContent=value; categoryFilter.appendChild(o); });
locations.forEach((value) => { const o=document.createElement("option"); o.value=value; o.textContent=value; locationFilter.appendChild(o); });
categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : "All";
searchInput.value = initialSearch;
locationFilter.value = locations.includes(initialLocation) ? initialLocation : "";
heading.textContent = recentOnly ? "My Browsing" : (selectedCategory === "All" ? "Browse Listings" : selectedCategory);
if (recentOnly) document.title = "My Browsing | PZ Online";

let listings = [];
let blockedIds = new Set();

function formatPrice(value) { return `Le ${Number(value || 0).toLocaleString()}`; }
function getImage(listing) { return listing.image || (Array.isArray(listing.images) ? listing.images[0] : "") || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80"; }
function rememberRecent(id) {
  const current = JSON.parse(localStorage.getItem("pz-recently-viewed") || "[]").filter((x) => x !== id);
  current.unshift(id); localStorage.setItem("pz-recently-viewed", JSON.stringify(current.slice(0,30)));
}
function render() {
  const term = searchInput.value.trim().toLowerCase();
  const cat = categoryFilter.value;
  const loc = locationFilter.value;
  const min = Number(minPrice.value || 0);
  const max = Number(maxPrice.value || 0);
  const recent = new Set(JSON.parse(localStorage.getItem("pz-recently-viewed") || "[]"));
  let data = listings.filter((x) => !blockedIds.has(x.ownerId));
  if (recentOnly) data = data.filter((x) => recent.has(x.id));
  if (cat !== "All") data = data.filter((x) => x.category === cat);
  if (loc) data = data.filter((x) => x.location === loc);
  if (term) data = data.filter((x) => `${x.title || ""} ${x.description || ""} ${x.category || ""} ${x.sellerName || ""} ${x.location || ""}`.toLowerCase().includes(term));
  if (min) data = data.filter((x) => Number(x.price) >= min);
  if (max) data = data.filter((x) => Number(x.price) <= max);
  if (sortFilter.value === "price-low") data.sort((a,b)=>Number(a.price)-Number(b.price));
  if (sortFilter.value === "price-high") data.sort((a,b)=>Number(b.price)-Number(a.price));
  if (sortFilter.value === "oldest") data.sort((a,b)=>(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0));
  grid.innerHTML = "";
  count.textContent = `${data.length} listing${data.length === 1 ? "" : "s"}`;
  empty.classList.toggle("hidden", data.length !== 0);
  data.forEach((listing) => {
    const card=document.createElement("article"); card.className="listing-card browse-card";
    const link=document.createElement("a"); link.href=`product.html?id=${listing.id}`; link.className="listing-image-link";
    const img=document.createElement("img"); img.className="listing-image"; img.src=getImage(listing); img.alt=listing.title; img.loading="lazy"; img.decoding="async";
    link.appendChild(img);
    link.addEventListener("click",()=>rememberRecent(listing.id));
    const content=document.createElement("div"); content.className="listing-content";
    const badge=document.createElement("span"); badge.className="listing-category"; badge.textContent=listing.category||"Other";
    const title=document.createElement("h3"); title.className="listing-title"; const a=document.createElement("a"); a.className="listing-title-link"; a.href=link.href; a.textContent=listing.title; a.addEventListener("click",()=>rememberRecent(listing.id)); title.appendChild(a);
    const price=document.createElement("p"); price.className="listing-price"; price.textContent=formatPrice(listing.price);
    const meta=document.createElement("div"); meta.className="listing-meta"; meta.textContent=`${listing.location || "Freetown"} · ${listing.sellerName || "Seller"}`;
    content.append(badge,title,price,meta); card.append(link,content); grid.appendChild(card);
  });
}

[searchInput, categoryFilter, locationFilter, minPrice, maxPrice, sortFilter].forEach((el)=>el?.addEventListener("input",render));

onAuthStateChanged(auth, async (user) => {
  if (!user) { blockedIds = new Set(); render(); return; }
  try {
    const snap=await getDocs(collection(db,"users",user.uid,"blockedUsers"));
    blockedIds=new Set(snap.docs.map((d)=>d.id));
  } catch(e) { console.error(e); }
  render();
});

onSnapshot(collection(db,"listings"),(snap)=>{ listings=snap.docs.map((d)=>({id:d.id,...d.data()})); listings.sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)); render(); },(e)=>{ console.error(e); empty.classList.remove("hidden"); empty.textContent="Listings could not be loaded. Please refresh."; });
