// firebase-config.js
//
// Reusing the same Firebase project as the Ballpark Tracker (per your choice) —
// same config values, since it's the same project. This app's data stays separate
// via its own Firestore collection ("theatreVisits") and storage path ("theatre/"),
// both set in venues.js.

export const firebaseConfig = {
  apiKey: "AIzaSyBR4DPUzqZ-taElypMlr48WqwcXjj50zL4",
  authDomain: "mlb-stadium-tracker.firebaseapp.com",
  projectId: "mlb-stadium-tracker",
  storageBucket: "mlb-stadium-tracker.firebasestorage.app",
  messagingSenderId: "451276451892",
  appId: "1:451276451892:web:eb34d34bbb9106736e5a61",
  measurementId: "G-3N3CSBPXY4",
};

export const isConfigured = () =>
  !Object.values(firebaseConfig).some((v) => String(v).startsWith("PASTE_YOUR"));
