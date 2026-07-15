// app.js — Ballpark Tracker
// Firebase Auth (Google sign-in) + Firestore (per-user data) + Storage (photos).
// Each signed-in user reads/writes only their own documents at users/{uid}/visits/{venueId}.

import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { VENUES, DIVISION_ORDER, ENTITY_LABEL_PLURAL } from "./venues.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, deleteField, onSnapshot, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// ---------- Elements ----------
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const headerRight = document.getElementById("header-right");
const configWarning = document.getElementById("config-warning");
const loginBtn = document.getElementById("login-btn");
const divisionsContainer = document.getElementById("divisions-container");
const searchInput = document.getElementById("search-input");
const chips = document.querySelectorAll(".chip");
const visitedCountEl = document.getElementById("visited-count");
const progressFill = document.getElementById("progress-fill");
const lastUpdatedEl = document.getElementById("last-updated");
const exportBtn = document.getElementById("export-btn");

const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalSub = document.getElementById("modal-sub");
const modalVisited = document.getElementById("modal-visited");
const photoInput = document.getElementById("photo-input");
const photoPreview = document.getElementById("photo-preview");
const fieldDate = document.getElementById("field-date");
const fieldOpponent = document.getElementById("field-opponent");
const fieldScore = document.getElementById("field-score");
const fieldWith = document.getElementById("field-with");
const fieldNotes = document.getElementById("field-notes");
const modalSave = document.getElementById("modal-save");
const modalCancel = document.getElementById("modal-cancel");
const modalDelete = document.getElementById("modal-delete");
const toastEl = document.getElementById("toast");

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

// ---------- Firebase setup ----------
if (!isConfigured()) {
  configWarning.style.display = "block";
  loginBtn.disabled = true;
  loginBtn.style.opacity = 0.5;
}

let app, auth, db, storage;
if (isConfigured()) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

let currentUser = null;
let visitsData = {};       // venueId -> visit doc data
let unsubscribeVisits = null;
let pendingPhotoFile = null;
let activeVenueId = null;
let currentFilter = "all";
let searchTerm = "";

// ---------- Auth ----------
// Uses a full-page redirect rather than a popup: popups depend on third-party
// cookies / window.opener messaging between the firebaseapp.com auth handler and
// your app's domain, which many browsers now block by default (Safari, Brave,
// Firefox strict mode, Chrome with tracking protection) — that's what causes the
// "requested action is invalid" error for other people signing in. Redirect works
// the same everywhere because it's just a normal page navigation.
loginBtn.addEventListener("click", async () => {
  if (!isConfigured()) return;
  const provider = new GoogleAuthProvider();
  try {
    await signInWithRedirect(auth, provider);
  } catch (err) {
    console.error(err);
    toast("Sign-in failed: " + err.message);
  }
});

if (isConfigured()) {
  getRedirectResult(auth).catch((err) => {
    console.error(err);
    toast("Sign-in failed: " + err.message);
  });
}

function renderHeaderRight() {
  if (!currentUser) { headerRight.innerHTML = ""; return; }
  headerRight.innerHTML = `
    <div class="user-box">
      <img src="${currentUser.photoURL || ''}" alt="">
      <span>${currentUser.displayName || currentUser.email}</span>
      <button class="btn-ghost btn-small" id="signout-btn">Sign out</button>
    </div>`;
  document.getElementById("signout-btn").addEventListener("click", () => signOut(auth));
}

if (isConfigured()) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    renderHeaderRight();
    if (user) {
      loginScreen.style.display = "none";
      appScreen.style.display = "block";
      subscribeToVisits(user.uid);
    } else {
      loginScreen.style.display = "flex";
      appScreen.style.display = "none";
      if (unsubscribeVisits) unsubscribeVisits();
      visitsData = {};
    }
  });
}

// ---------- Firestore sync ----------
function subscribeToVisits(uid) {
  if (unsubscribeVisits) unsubscribeVisits();
  const visitsCol = collection(db, "users", uid, "visits");
  unsubscribeVisits = onSnapshot(visitsCol, (snap) => {
    visitsData = {};
    snap.forEach((d) => { visitsData[d.id] = d.data(); });
    renderAll();
  }, (err) => {
    console.error(err);
    toast("Couldn't load your data: " + err.message);
  });
}

async function saveVisit(venueId, data) {
  const ref_ = doc(db, "users", currentUser.uid, "visits", venueId);
  await setDoc(ref_, { ...data, updatedAt: serverTimestamp() }, { merge: false });
}

async function clearVisit(venueId) {
  const ref_ = doc(db, "users", currentUser.uid, "visits", venueId);
  await setDoc(ref_, { visited: false, updatedAt: serverTimestamp() }, { merge: false });
}

// ---------- Quick toggle from card ----------
async function toggleVisited(venueId, checked) {
  const existing = visitsData[venueId] || {};
  try {
    await saveVisit(venueId, { ...existing, visited: checked });
    toast(checked ? "Marked as visited" : "Marked as not visited");
  } catch (err) {
    console.error(err);
    toast("Couldn't save: " + err.message);
  }
}

// ---------- Rendering ----------
function matchesFilters(venue) {
  const v = visitsData[venue.id];
  const visited = !!(v && v.visited);
  if (currentFilter === "visited" && !visited) return false;
  if (currentFilter === "not-visited" && visited) return false;
  if (searchTerm) {
    const hay = `${venue.name} ${venue.group} ${venue.location}`.toLowerCase();
    if (!hay.includes(searchTerm)) return false;
  }
  return true;
}

function renderAll() {
  // stats
  const totalVisited = VENUES.filter(v => visitsData[v.id] && visitsData[v.id].visited).length;
  visitedCountEl.textContent = totalVisited;
  progressFill.style.width = `${Math.round((totalVisited / VENUES.length) * 100)}%`;

  // divisions
  divisionsContainer.innerHTML = "";
  let anyShown = false;

  DIVISION_ORDER.forEach((division) => {
    const venuesInDiv = VENUES.filter(v => v.division === division && matchesFilters(v));
    if (venuesInDiv.length === 0) return;
    anyShown = true;

    const section = document.createElement("div");
    section.className = "division";
    const h3 = document.createElement("h3");
    h3.textContent = division;
    section.appendChild(h3);

    const grid = document.createElement("div");
    grid.className = "grid";
    venuesInDiv.forEach((venue) => grid.appendChild(renderCard(venue)));
    section.appendChild(grid);

    divisionsContainer.appendChild(section);
  });

  if (!anyShown) {
    divisionsContainer.innerHTML = `<div class="empty-state">No ${ENTITY_LABEL_PLURAL} match your search/filter.</div>`;
  }
}

function renderCard(venue) {
  const v = visitsData[venue.id] || {};
  const visited = !!v.visited;

  const card = document.createElement("div");
  card.className = "card" + (visited ? " visited" : "");

  const photo = document.createElement("div");
  photo.className = "card-photo";
  if (v.photoURL) {
    photo.innerHTML = `<img src="${v.photoURL}" alt="${venue.name}">`;
  } else {
    photo.textContent = "⚾";
  }
  if (visited) {
    const badge = document.createElement("div");
    badge.className = "visited-badge";
    badge.textContent = "✓ Visited";
    photo.appendChild(badge);
  }
  card.appendChild(photo);

  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <div class="venue-name">${venue.name}</div>
    <div class="team-name">${venue.group}</div>
    <div class="city">${venue.location}</div>
  `;
  card.appendChild(body);

  if (visited && (v.date || v.opponent || v.withWho)) {
    const summary = document.createElement("div");
    summary.className = "card-summary";
    const bits = [];
    if (v.date) bits.push(formatDate(v.date));
    if (v.opponent) bits.push(`vs ${v.opponent}`);
    if (v.withWho) bits.push(`with ${v.withWho}`);
    summary.textContent = bits.join(" · ");
    card.appendChild(summary);
  }

  const footer = document.createElement("div");
  footer.className = "card-footer";

  const label = document.createElement("label");
  label.className = "visited-toggle";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = visited;
  cb.addEventListener("change", (e) => {
    e.stopPropagation();
    toggleVisited(venue.id, cb.checked);
  });
  label.appendChild(cb);
  label.appendChild(document.createTextNode("Been here"));
  footer.appendChild(label);

  const editBtn = document.createElement("button");
  editBtn.className = "btn-outline btn-small";
  editBtn.textContent = visited ? "Edit details" : "Add details";
  editBtn.addEventListener("click", () => openModal(venue));
  footer.appendChild(editBtn);

  card.appendChild(footer);
  return card;
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y) return iso;
  return `${m}/${d}/${y}`;
}

// ---------- Modal ----------
function openModal(venue) {
  activeVenueId = venue.id;
  pendingPhotoFile = null;
  const v = visitsData[venue.id] || {};

  modalTitle.textContent = venue.name;
  modalSub.textContent = `${venue.group} — ${venue.location}`;
  modalVisited.checked = !!v.visited;
  fieldDate.value = v.date || "";
  fieldOpponent.value = v.opponent || "";
  fieldScore.value = v.score || "";
  fieldWith.value = v.withWho || "";
  fieldNotes.value = v.notes || "";
  photoInput.value = "";

  if (v.photoURL) {
    photoPreview.innerHTML = `<img src="${v.photoURL}" alt="">`;
  } else {
    photoPreview.innerHTML = "📷 No photo yet";
  }

  modalDelete.style.display = v.visited || v.date || v.opponent || v.notes ? "inline-block" : "none";
  modalOverlay.classList.add("open");
}

function closeModal() {
  modalOverlay.classList.remove("open");
  activeVenueId = null;
  pendingPhotoFile = null;
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  pendingPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    photoPreview.innerHTML = `<img src="${e.target.result}" alt="">`;
  };
  reader.readAsDataURL(file);
});

modalCancel.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

modalDelete.addEventListener("click", async () => {
  if (!activeVenueId) return;
  if (!confirm("Clear all details for this ballpark? This won't undo marking it as visited unless you also uncheck it.")) return;
  try {
    await clearVisit(activeVenueId);
    toast("Details cleared");
    closeModal();
  } catch (err) {
    console.error(err);
    toast("Couldn't clear: " + err.message);
  }
});

modalSave.addEventListener("click", async () => {
  if (!activeVenueId || !currentUser) return;
  modalSave.disabled = true;
  modalSave.textContent = "Saving...";
  try {
    let photoURL = (visitsData[activeVenueId] || {}).photoURL || null;
    if (pendingPhotoFile) {
      const path = `users/${currentUser.uid}/${activeVenueId}/${Date.now()}_${pendingPhotoFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, pendingPhotoFile);
      photoURL = await getDownloadURL(storageRef);
    }

    const data = {
      visited: modalVisited.checked,
      date: fieldDate.value || null,
      opponent: fieldOpponent.value.trim() || null,
      score: fieldScore.value.trim() || null,
      withWho: fieldWith.value.trim() || null,
      notes: fieldNotes.value.trim() || null,
      photoURL: photoURL || null,
    };
    await saveVisit(activeVenueId, data);
    toast("Saved!");
    closeModal();
  } catch (err) {
    console.error(err);
    toast("Couldn't save: " + err.message);
  } finally {
    modalSave.disabled = false;
    modalSave.textContent = "Save";
  }
});

// ---------- Filters / search ----------
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderAll();
  });
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderAll();
});

// ---------- Export ----------
exportBtn.addEventListener("click", () => {
  const rows = VENUES.map(v => ({
    venue: v.name,
    team: v.group,
    location: v.location,
    ...((visitsData[v.id]) || { visited: false }),
  }));
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ballpark-tracker-export.json";
  a.click();
  URL.revokeObjectURL(url);
});
