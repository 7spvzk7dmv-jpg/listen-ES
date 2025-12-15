/* =======================
   FIREBASE INIT (NO MODULE)
======================= */

let auth = null;
let db = null;

(function initFirebase() {

  if (typeof firebase === 'undefined') {
    console.error('Firebase CDN não carregou');
    return;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyC0tOIKC39gpIBQORVMNsXDKUSeVqNN2_U",
    authDomain: "estudo-espanhol.firebaseapp.com",
    projectId: "estudo-espanhol",
    storageBucket: "estudo-espanhol.firebasestorage.app",
    messagingSenderId: "665829650392",
    appId: "1:665829650392:web:14327e1f37f3c32f8c4cad"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  auth = firebase.auth();
  db = firebase.firestore();

  // 🔐 Persistência explícita (Safari)
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(() => {});

})();

/* =======================
   AUTH HELPERS
======================= */

function loginEmail(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

function registerEmail(email, password) {
  return auth.createUserWithEmailAndPassword(email, password);
}

function loginGoogleRedirect() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return auth.signInWithRedirect(provider);
}

function logout() {
  return auth.signOut();
}

/* =======================
   FIRESTORE + FALLBACK
======================= */

function userDoc(uid) {
  return db.collection('users').doc(uid);
}

async function saveUserData(uid, key, value) {
  try {
    await userDoc(uid).set({ [key]: value }, { merge: true });
  } catch {
    localStorage.setItem(`${uid}_${key}`, JSON.stringify(value));
  }
}

async function loadUserData(uid, key) {
  try {
    const snap = await userDoc(uid).get();
    if (snap.exists && snap.data()[key] !== undefined) {
      return snap.data()[key];
    }
  } catch {}

  const v = localStorage.getItem(`${uid}_${key}`);
  return v ? JSON.parse(v) : null;
}
