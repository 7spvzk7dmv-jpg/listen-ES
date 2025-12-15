/* =======================
   FIREBASE INIT (NO MODULE)
======================= */

let auth = null;
let db = null;
let currentUser = null;

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

  auth.onAuthStateChanged(user => {
    currentUser = user || null;
  });

  // 🔑 FUNDAMENTAL PARA GOOGLE LOGIN NO SAFARI
  auth.getRedirectResult()
    .then(result => {
      if (result.user) {
        currentUser = result.user;
      }
    })
    .catch(err => {
      console.warn('Erro redirect Google:', err);
    });

})();

/* =======================
   AUTH
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

function getUser() {
  return currentUser;
}

function requireAuth() {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'login.html';
    }
  });
}

/* =======================
   FIRESTORE + FALLBACK
======================= */

function userDoc() {
  if (!currentUser) return null;
  return db.collection('users').doc(currentUser.uid);
}

async function saveUserData(key, value) {
  if (!currentUser) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }

  try {
    await userDoc().set({ [key]: value }, { merge: true });
  } catch {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function loadUserData(key) {
  if (!currentUser) {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  }

  try {
    const snap = await userDoc().get();
    if (snap.exists && snap.data()[key] !== undefined) {
      return snap.data()[key];
    }
  } catch {}

  const v = localStorage.getItem(key);
  return v ? JSON.parse(v) : null;
}
