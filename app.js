// app.js — Broadway Tracker
// Firebase Auth (Google sign-in) + Firestore (per-user data) + Storage (photos).
// Each signed-in user reads/writes only their own documents at
// users/{uid}/{COLLECTION_NAME}/{venueId} — a separate collection from the
// Ballpark Tracker so the two apps' data never mixes, even in the same project.

import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { VENUES, DIVISION_ORDER, ENTITY_LABEL_PLURAL, COLLECTION_NAME, STORAGE_PREFIX } from "./venues.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, onSnapshot, collection, serverTimestamp
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
const importBtn = document.getElementById("import-btn");
const importInput = document.getElementById("import-input");

const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalSub = document.getElementById("modal-sub");
const modalVisited = document.getElementById("modal-visited");
const visitsList = document.getElementById("visits-list");
const visitsCountLabel = document.getElementById("visits-count-label");
const addVisitBtn = document.getElementById("add-visit-btn");
const visitForm = document.getElementById("visit-form");
const photoInput = document.getElementById("photo-input");
const photoPreview = document.getElementById("photo-preview");
const fieldDate = document.getElementById("field-date");
const fieldOpponent = document.getElementById("field-opponent");
const fieldScore = document.getElementById("field-score");
const fieldWith = document.getElementById("field-with");
const fieldNotes = document.getElementById("field-notes");
const visitFormSave = document.getElementById("visit-form-save");
const visitFormCancel = document.getElementById("visit-form-cancel");
const modalCancel = document.getElementById("modal-cancel");
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
let editingVisitId = null;   // id of the visit entry currently open in visit-form, or null when adding new
let currentFilter = "all";
let searchTerm = "";

// ---------- Visits array helpers ----------
// Each venue doc can hold multiple visits: { visited, visits: [{id,date,opponent,
// score,withWho,notes,photoURL}], updatedAt }. Older docs saved before this feature
// existed (including anything from Import) have those same fields at the top level
// instead of in an array — this reads either shape so nothing gets lost.
function getVisitsArray(venueId) {
  const v = visitsData[venueId] || {};
  if (Array.isArray(v.visits)) return v.visits;
  if (v.date || v.opponent || v.score || v.withWho || v.notes || v.photoURL) {
    return [{
      id: "legacy",
      date: v.date || null,
      opponent: v.opponent || null,
      score: v.score || null,
      withWho: v.withWho || null,
      notes: v.notes || null,
      photoURL: v.photoURL || null,
    }];
  }
  return [];
}

// Sorts by date descending (most recently seen first), not entry order. Dated
// visits always sort before undated ones; undated visits keep their original
// relative order (stable sort).
function sortVisitsByDate(visits) {
  return visits.slice().sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return 0;
  });
}

function getMostRecentPhoto(visits) {
  const sorted = sortVisitsByDate(visits);
  for (const v of sorted) {
    if (v.photoURL) return v.photoURL;
  }
  return null;
}

// ---------- Auth ----------
// Popup is the primary method — it's what's proven to work. Full-page redirect is
// used only as a fallback if the popup itself is blocked, since redirect has its
// own failure mode in Safari (storage gets wiped across the cross-site hop to
// Google and back — a known Safari ITP limitation with no full fix short of
// hosting the app and Firebase auth on the same top-level domain).
loginBtn.addEventListener("click", async () => {
  if (!isConfigured()) return;
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
      return; // user closed the popup — not a real error
    }
    if (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment") {
      try {
        await signInWithRedirect(auth, provider);
      } catch (err2) {
        console.error(err2);
        toast("Sign-in failed: " + err2.message);
      }
      return;
    }
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
  const visitsCol = collection(db, "users", uid, COLLECTION_NAME);
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
  const ref_ = doc(db, "users", currentUser.uid, COLLECTION_NAME, venueId);
  await setDoc(ref_, { ...data, updatedAt: serverTimestamp() }, { merge: false });
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
  const visits = getVisitsArray(venue.id);
  const photoURL = getMostRecentPhoto(visits);

  const card = document.createElement("div");
  card.className = "card" + (visited ? " visited" : "");

  const photo = document.createElement("div");
  photo.className = "card-photo";
  if (photoURL) {
    photo.innerHTML = `<img src="${photoURL}" alt="${venue.name}">`;
  } else {
    photo.textContent = "🎭";
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
  const searchQuery = encodeURIComponent(`${venue.name} Broadway now playing`);
  const formerNamesHTML = (venue.formerNames && venue.formerNames.length)
    ? `<div class="former-names">Formerly: ${venue.formerNames.join(", ")}</div>`
    : "";
  body.innerHTML = `
    <div class="venue-name">${venue.name}</div>
    <div class="team-name">${venue.group}</div>
    <div class="city">${venue.location}</div>
    ${formerNamesHTML}
    <a class="whats-playing-link" href="https://www.google.com/search?q=${searchQuery}" target="_blank" rel="noopener noreferrer">What's playing? &rarr;</a>
  `;
  card.appendChild(body);

  if (visits.length === 1) {
    const v0 = visits[0];
    if (v0.date || v0.opponent || v0.withWho) {
      const summary = document.createElement("div");
      summary.className = "card-summary";
      const bits = [];
      if (v0.date) bits.push(formatDate(v0.date));
      if (v0.opponent) bits.push(v0.opponent);
      if (v0.withWho) bits.push(`with ${v0.withWho}`);
      summary.textContent = bits.join(" · ");
      card.appendChild(summary);
    }
  } else if (visits.length > 1) {
    const summary = document.createElement("div");
    summary.className = "card-summary";
    const last = sortVisitsByDate(visits)[0];
    const lastBits = [];
    if (last.date) lastBits.push(formatDate(last.date));
    if (last.opponent) lastBits.push(last.opponent);
    summary.textContent = `${visits.length} visits` + (lastBits.length ? ` · latest: ${lastBits.join(", ")}` : "");
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
  editBtn.textContent = visits.length > 0 ? "Manage visits" : "Add details";
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
  modalTitle.textContent = venue.name;
  const formerLine = (venue.formerNames && venue.formerNames.length)
    ? `<br><span class="former-names">Formerly: ${venue.formerNames.join(", ")}</span>`
    : "";
  modalSub.innerHTML = `${venue.group} — ${venue.location}${formerLine}`;
  modalVisited.checked = !!(visitsData[venue.id] || {}).visited;
  closeVisitForm();
  renderVisitsList();
  modalOverlay.classList.add("open");
}

function closeModal() {
  modalOverlay.classList.remove("open");
  activeVenueId = null;
  closeVisitForm();
}

modalCancel.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// "Been here" checkbox saves immediately, independent of any visit entries.
modalVisited.addEventListener("change", () => {
  if (!activeVenueId) return;
  toggleVisited(activeVenueId, modalVisited.checked);
});

// ---------- Visits list (inside the modal) ----------
function renderVisitsList() {
  const visits = activeVenueId ? getVisitsArray(activeVenueId) : [];
  visitsCountLabel.textContent = visits.length > 0 ? `Your visits (${visits.length})` : "Your visits";
  visitsList.innerHTML = "";

  if (visits.length === 0) {
    visitsList.innerHTML = `<div class="visits-empty">No visits logged yet — that's fine, the checkbox above already marks you as having been here.</div>`;
    return;
  }

  sortVisitsByDate(visits).forEach((entry) => {
    const row = document.createElement("div");
    row.className = "visit-row";

    const thumb = document.createElement("div");
    thumb.className = "visit-row-photo";
    thumb.innerHTML = entry.photoURL ? `<img src="${entry.photoURL}" alt="">` : "🎭";
    row.appendChild(thumb);

    const bodyEl = document.createElement("div");
    bodyEl.className = "visit-row-body";
    const titleBits = [];
    if (entry.date) titleBits.push(formatDate(entry.date));
    if (entry.opponent) titleBits.push(entry.opponent);
    const subBits = [];
    if (entry.score) subBits.push(entry.score);
    if (entry.withWho) subBits.push(`with ${entry.withWho}`);
    bodyEl.innerHTML = `
      <div class="visit-row-title">${titleBits.length ? titleBits.join(" — ") : "No date/show logged"}</div>
      ${subBits.length ? `<div class="visit-row-sub">${subBits.join(" · ")}</div>` : ""}
      ${entry.notes ? `<div class="visit-row-notes">${entry.notes}</div>` : ""}
    `;
    row.appendChild(bodyEl);

    const actions = document.createElement("div");
    actions.className = "visit-row-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn-outline btn-small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openVisitForm(entry));
    actions.appendChild(editBtn);
    const delBtn = document.createElement("button");
    delBtn.className = "btn-danger btn-small";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteVisitEntry(entry.id));
    actions.appendChild(delBtn);
    row.appendChild(actions);

    visitsList.appendChild(row);
  });
}

function openVisitForm(entry) {
  editingVisitId = entry ? entry.id : null;
  pendingPhotoFile = null;
  fieldDate.value = entry?.date || "";
  fieldOpponent.value = entry?.opponent || "";
  fieldScore.value = entry?.score || "";
  fieldWith.value = entry?.withWho || "";
  fieldNotes.value = entry?.notes || "";
  photoInput.value = "";
  photoPreview.innerHTML = entry?.photoURL ? `<img src="${entry.photoURL}" alt="">` : "📷 No photo yet";
  visitForm.style.display = "block";
  addVisitBtn.style.display = "none";
}

function closeVisitForm() {
  editingVisitId = null;
  pendingPhotoFile = null;
  visitForm.style.display = "none";
  addVisitBtn.style.display = "inline-block";
}

addVisitBtn.addEventListener("click", () => openVisitForm(null));
visitFormCancel.addEventListener("click", closeVisitForm);

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

visitFormSave.addEventListener("click", async () => {
  if (!activeVenueId || !currentUser) return;
  visitFormSave.disabled = true;
  visitFormSave.textContent = "Saving...";
  try {
    const visits = getVisitsArray(activeVenueId).slice();
    const existingIndex = editingVisitId ? visits.findIndex(v => v.id === editingVisitId) : -1;
    let photoURL = existingIndex >= 0 ? (visits[existingIndex].photoURL || null) : null;

    if (pendingPhotoFile) {
      const path = `users/${currentUser.uid}/${STORAGE_PREFIX}/${activeVenueId}/${Date.now()}_${pendingPhotoFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, pendingPhotoFile);
      photoURL = await getDownloadURL(storageRef);
    }

    const entry = {
      id: existingIndex >= 0 ? visits[existingIndex].id : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: fieldDate.value || null,
      opponent: fieldOpponent.value.trim() || null,
      score: fieldScore.value.trim() || null,
      withWho: fieldWith.value.trim() || null,
      notes: fieldNotes.value.trim() || null,
      photoURL: photoURL || null,
    };

    if (existingIndex >= 0) {
      visits[existingIndex] = entry;
    } else {
      visits.push(entry);
    }

    await saveVisit(activeVenueId, { visited: true, visits });
    modalVisited.checked = true;
    toast("Visit saved!");
    closeVisitForm();
    renderVisitsList();
  } catch (err) {
    console.error(err);
    toast("Couldn't save: " + err.message);
  } finally {
    visitFormSave.disabled = false;
    visitFormSave.textContent = "Save visit";
  }
});

async function deleteVisitEntry(entryId) {
  if (!activeVenueId) return;
  if (!confirm("Delete this visit? This won't uncheck 'I've been here' — untick that separately if you want to.")) return;
  try {
    const visits = getVisitsArray(activeVenueId).filter(v => v.id !== entryId);
    const stillVisited = (visitsData[activeVenueId] || {}).visited;
    await saveVisit(activeVenueId, { visited: !!stillVisited, visits });
    toast("Visit deleted");
    renderVisitsList();
  } catch (err) {
    console.error(err);
    toast("Couldn't delete: " + err.message);
  }
}

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
    id: v.id,
    venue: v.name,
    team: v.group,
    location: v.location,
    ...((visitsData[v.id]) || { visited: false }),
  }));
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "broadway-tracker-export.json";
  // Safari/Firefox silently ignore .click() on an <a download> that isn't in the
  // document — it has to be attached, clicked, then removed.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ---------- Import ----------
// Bulk-loads visit records from a JSON file — an array of objects like:
// [{ "id": "gershwin", "visited": true, "date": null, "opponent": "Wicked",
//    "score": null, "withWho": null, "notes": null }, ...]
// Matches each entry to a venue by "id" (see venues.js for valid ids) and writes
// it to Firestore using your current signed-in session — same as any manual save.
// Existing photos are preserved (import files don't carry photos).
importBtn.addEventListener("click", () => {
  if (!currentUser) { toast("Sign in first"); return; }
  importInput.click();
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  importInput.value = "";
  if (!file) return;

  let rows;
  try {
    rows = JSON.parse(await file.text());
    if (!Array.isArray(rows)) throw new Error("Expected a JSON array");
  } catch (err) {
    toast("Couldn't read that file: " + err.message);
    return;
  }

  const validIds = new Set(VENUES.map(v => v.id));
  const matched = rows.filter(r => r && validIds.has(r.id));
  const unmatched = rows.length - matched.length;

  if (matched.length === 0) {
    toast("No matching venue ids found in that file");
    return;
  }
  if (!confirm(`Import ${matched.length} record(s)${unmatched ? ` (${unmatched} unmatched, skipped)` : ""}? This will overwrite existing details for any matching venues (photos are kept).`)) {
    return;
  }

  let ok = 0, failed = 0;
  for (const row of matched) {
    try {
      const existingPhoto = (visitsData[row.id] || {}).photoURL || null;
      await saveVisit(row.id, {
        visited: !!row.visited,
        date: row.date || null,
        opponent: row.opponent || null,
        score: row.score || null,
        withWho: row.withWho || null,
        notes: row.notes || null,
        photoURL: existingPhoto,
      });
      ok++;
    } catch (err) {
      console.error("Import failed for", row.id, err);
      failed++;
    }
  }
  toast(`Imported ${ok} record(s)${failed ? `, ${failed} failed` : ""}`);
});
