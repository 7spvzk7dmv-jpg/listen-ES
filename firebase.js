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
