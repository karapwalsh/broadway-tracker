# Broadway Tracker — Setup Guide

A companion to your Ballpark Tracker: track which of the 41 Broadway theatres
you've visited, what show you saw, who you went with, a rating/favorite moment,
notes, and a photo — mark a theatre visited even with everything else blank.
Same architecture as the ballpark app: Firebase Auth (Google sign-in) + Firestore
+ Storage, works on desktop and phone, and anyone can sign in and track their own
visits privately.

This reuses your **existing** `mlb-stadium-tracker` Firebase project — same
config, same billing, same Blaze plan you already set up. No new Firebase project
needed. It keeps its data separate using its own Firestore collection
(`theatreVisits`) and its own Storage folder (`theatre/`), so nothing overlaps
with the ballpark data.

---

## One required step: update your Firestore rules

Because this app writes to a different collection than the ballpark app, the
narrower rule you published earlier (`users/{userId}/visits/{visitId}`) won't
cover it — you'll get the same "does not have permission" error you saw with
Storage.

Go to Firebase Console → **Firestore Database → Rules**, and replace the
contents with what's in **`firestore.rules`** in this folder:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**. This is a one-time update — it generalizes the rule to cover
your entire `users/{uid}/...` space, so both the ballpark app and this one (and
any future tracker you build the same way) work under the same rule going
forward. Your Storage rules don't need any change — they already used a wildcard
that covers this.

---

## Deploy with GitHub Pages (~5 minutes, free)

Same process as the ballpark app, just a **separate repo** so it gets its own URL:

1. Go to **https://github.com/new** and create a new repository, e.g. `broadway-tracker`.
2. Upload every file in this folder: `index.html`, `app.js`, `venues.js`,
   `firebase-config.js`, `manifest.json`.
3. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Your app will be live at `https://yourusername.github.io/broadway-tracker/`.
5. Firebase Console → Authentication → Settings → Authorized domains — check that
   `yourusername.github.io` is already listed (it should be, from setting up the
   ballpark app). If not, add it.

Open the URL on your phone and desktop, sign in with the same Google account, and
your theatre visits sync automatically — same as the ballpark tracker.

---

## What's different from the Ballpark Tracker

- **Fields:** "Opponent / score" became "Show you saw" and "Rating / favorite
  moment" — theatres host rotating shows rather than one fixed team, so tracking
  score/who-won didn't make sense here.
- **Grouping:** theatres are grouped by operator (Shubert Organization,
  Nederlander Organization, Jujamcyn Theaters, Independent/Other) instead of
  league division — the closest Broadway equivalent to MLB's divisions.
- **Look:** a burgundy/gold theatre palette instead of ballpark green.
- **Data location:** separate Firestore collection and Storage folder, same
  Firebase project — see above.

## A note on accuracy

The 41 theatres, addresses, and operators are current as of mid-2026, compiled
from public sources. Broadway venues are occasionally renamed (a few in the list
were renamed in the last few years, e.g. Cort → James Earl Jones Theatre). If you
spot one that's out of date, it's a one-line edit in `venues.js`.
