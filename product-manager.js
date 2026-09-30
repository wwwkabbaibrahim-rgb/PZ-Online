import {
  collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db, esc, thumb, uploadPhoto, createdMillis } from "./shop-common.js";

/*
  Draws an "add product" form and a live list of products for one shop inside `root`.
  Anyone allowed by the security rules can use it: field agents, managers and the shop owner.
  Returns a function that stops listening (call it before drawing another shop).
*/
export function mountProductManager(root, shopId, uid) {
  root.innerHTML = `
    <form class="sp-form pm-add" novalidate>
      <label class="sp-field">Product name<input name="name" maxlength="100" required></label>
      <label class="sp-field">Price (Le)<input name="price" type="number" min="0" step="1" inputmode="numeric" required></label>
      <label class="sp-field wide">Description<small>Size, brand or anything a buyer needs to know.</small><textarea name="desc" rows="2" maxlength="300"></textarea></label>
      <label class="sp-field">Photo<input name="photo" type="file" accept="image/*"></label>
      <label class="sp-check pm-stock-add"><input name="instock" type="checkbox" checked> In stock</label>
      <div class="sp-actions"><button type="submit" class="primary-button">Add product</button><p class="sp-status-line" role="status"></p></div>
    </form>
    <h3 class="pm-title">Products <span class="pm-count"></span></h3>
    <p class="pm-hint">Change a price or description and press Save. The In stock box saves straight away. Customers see changes live.</p>
    <div class="sp-list pm-list"></div>
    <p class="empty-message hidden pm-empty">No products yet.</p>`;

  const form = root.querySelector(".pm-add");
  const addStatus = form.querySelector(".sp-status-line");
  const addBtn = form.querySelector("button[type=submit]");
  const list = root.querySelector(".pm-list");
  const empty = root.querySelector(".pm-empty");
  const count = root.querySelector(".pm-count");

  const say = (el, text, kind) => {
    el.textContent = text || "";
    el.classList.remove("ok", "bad");
    if (kind) el.classList.add(kind);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    const priceRaw = form.elements.price.value;
    const price = Number(priceRaw);
    if (!name) { say(addStatus, "Add the product name.", "bad"); form.elements.name.focus(); return; }
    if (priceRaw === "" || !Number.isFinite(price) || price < 0) { say(addStatus, "Add a price of 0 or more.", "bad"); form.elements.price.focus(); return; }

    addBtn.disabled = true;
    try {
      let image = "";
      const file = form.elements.photo.files?.[0];
      if (file) { say(addStatus, "Preparing and uploading the photo..."); image = await uploadPhoto(file); }
      say(addStatus, "Saving product...");
      await setDoc(doc(collection(db, "shops", shopId, "products")), {
        name,
        price,
        description: form.elements.desc.value.trim(),
        image,
        inStock: form.elements.instock.checked,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
      form.reset();
      form.elements.instock.checked = true;
      say(addStatus, "Product added.", "ok");
    } catch (err) {
      console.error(err);
      say(addStatus, err.message || "Could not add the product. Try again.", "bad");
    } finally {
      addBtn.disabled = false;
    }
  });

  function row(p) {
    const ref = doc(db, "shops", shopId, "products", p.id);
    const el = document.createElement("div");
    el.className = "sp-item pm-row";
    const photo = thumb(p.image, 160);
    el.innerHTML = `
      <div class="pm-photo-col">
        ${photo ? `<img class="sp-item-photo" src="${esc(photo)}" alt="">` : `<div class="sp-item-photo pm-nophoto" aria-hidden="true">🛍</div>`}
        <label class="pm-photo-btn">Change photo<input type="file" accept="image/*" hidden></label>
      </div>
      <div class="pm-fields">
        <label class="sp-field">Name<input data-f="name" maxlength="100" value="${esc(p.name)}"></label>
        <label class="sp-field">Price (Le)<input data-f="price" type="number" min="0" step="1" inputmode="numeric" value="${esc(p.price)}"></label>
        <label class="sp-field wide">Description<input data-f="desc" maxlength="300" value="${esc(p.description || "")}"></label>
      </div>
      <div class="pm-actions">
        <label class="sp-check"><input type="checkbox" data-f="stock" ${p.inStock !== false ? "checked" : ""}> In stock</label>
        <button type="button" class="primary-button" data-save>Save</button>
        <button type="button" class="sp-danger" data-delete>Delete</button>
        <span class="sp-status-line pm-msg" role="status"></span>
      </div>`;

    const msg = el.querySelector(".pm-msg");
    const val = (f) => el.querySelector(`[data-f="${f}"]`);

    el.querySelector("[data-save]").addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      const name = val("name").value.trim();
      const priceRaw = val("price").value;
      const price = Number(priceRaw);
      if (!name) { say(msg, "Name is needed.", "bad"); return; }
      if (priceRaw === "" || !Number.isFinite(price) || price < 0) { say(msg, "Add a price of 0 or more.", "bad"); return; }
      btn.disabled = true;
      try {
        await updateDoc(ref, { name, price, description: val("desc").value.trim(), updatedAt: serverTimestamp() });
        say(msg, "Saved.", "ok");
      } catch (err) {
        console.error(err);
        say(msg, "Could not save. Try again.", "bad");
      } finally {
        btn.disabled = false;
      }
    });

    val("stock").addEventListener("change", async (ev) => {
      const box = ev.currentTarget;
      try {
        await updateDoc(ref, { inStock: box.checked, updatedAt: serverTimestamp() });
        say(msg, box.checked ? "Marked in stock." : "Marked out of stock.", "ok");
      } catch (err) {
        console.error(err);
        box.checked = !box.checked;
        say(msg, "Could not change stock. Try again.", "bad");
      }
    });

    el.querySelector('input[type="file"]').addEventListener("change", async (ev) => {
      const file = ev.currentTarget.files?.[0];
      if (!file) return;
      try {
        say(msg, "Uploading photo...");
        const image = await uploadPhoto(file);
        await updateDoc(ref, { image, updatedAt: serverTimestamp() });
        say(msg, "Photo updated.", "ok");
      } catch (err) {
        console.error(err);
        say(msg, err.message || "Could not change the photo.", "bad");
      }
    });

    el.querySelector("[data-delete]").addEventListener("click", async () => {
      if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
      try {
        await deleteDoc(ref);
        el.remove();
      } catch (err) {
        console.error(err);
        say(msg, "Could not delete. Try again.", "bad");
      }
    });
    return el;
  }

  const stop = onSnapshot(
    collection(db, "shops", shopId, "products"),
    (snap) => {
      const products = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => createdMillis(b) - createdMillis(a));
      // Keep whatever the person is typing in a row if the list refreshes because of someone else's change.
      const active = document.activeElement;
      if (active && list.contains(active) && active.matches("input")) return;
      list.innerHTML = "";
      products.forEach((p) => list.appendChild(row(p)));
      count.textContent = `(${products.length})`;
      empty.classList.toggle("hidden", products.length > 0);
    },
    (err) => {
      console.error(err);
      empty.textContent = "Products could not be loaded.";
      empty.classList.remove("hidden");
    },
  );
  return stop;
}
