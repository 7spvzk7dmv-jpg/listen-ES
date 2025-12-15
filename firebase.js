<!-- firebase.js -->
<script>
/* =======================
   FIREBASE CORE (NO MODULE)
======================= */

// Firebase CDN (compat — Safari safe)
document.write(`
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"><\/script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"><\/script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"><\/script>
`);

let firebaseReady = false;
let auth = null;
let db = null;
let currentUser = null;

/* =======================
   INIT
======================= */

function initFirebase() {
  if (firebaseReady) return;

  const firebaseConfig = {
    apiKey: "AIzaSyC0tOIKC39gpIBQORVMNsXDKUSeVqNN2_U",
    authDomain: "estudo-espanhol.firebaseapp.com",
    projectId: "estudo-espanhol",
    storageBucket: "estudo-espanhol.firebasestorage.app",
    messagingSenderId: "665829650392",
    appId: "1:665829650392:web:14327e1f37f3c32f8c4cad"
  };

  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();

  auth.onAuthStateChanged(user => {
    currentUser = user || null;
  });

  firebaseReady = true;
}

/* =======================
   AUTH
======================= */

function loginEmail(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

function registerEmail(email, password) {
  return auth.createUserWithEmailAndPassword(email, password);
}

function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return auth.signInWithPopup(provider);
}

function logout() {
  return auth.signOut();
}

function getUser() {
  return currentUser;
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
  } catch (e) {
    console.warn('Firestore falhou, usando localStorage', e);
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function loadUserData(key) {
  if (!currentUser) {
    return JSON.parse(localStorage.getItem(key));
  }

  try {
    const snap = await userDoc().get();
    return snap.exists ? snap.data()[key] : null;
  } catch (e) {
    console.warn('Firestore falhou, usando localStorage', e);
    return JSON.parse(localStorage.getItem(key));
  }
}

/* =======================
   ROUTE GUARD
======================= */

function requireAuth() {
  initFirebase();

  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'login.html';
    }
  });
}

initFirebase();
</script>
