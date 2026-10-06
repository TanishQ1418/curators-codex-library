import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  collectionGroup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const firebaseConfig = {
  projectId: "gen-lang-client-0148267833",
  appId: "1:496148193699:web:4f33725a5d3176e80dba16",
  apiKey: "AIzaSyAzHmpajxhbE4WVAaHbngZzcquhYfJMGrY",
  authDomain: "gen-lang-client-0148267833.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-e20fe8a3-51eb-4c70-b5e2-be2681714950",
  storageBucket: "gen-lang-client-0148267833.firebasestorage.app",
  messagingSenderId: "496148193699",
  measurementId: "",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Window bindings for existing HTML inline event handlers
window.db = db;
window.auth = auth;
window.writeBatch = writeBatch;
window.doc = doc;
window.collection = collection;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.onSnapshot = onSnapshot;
window.collectionGroup = collectionGroup;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.limit = limit;

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  if (
    errInfo.error.includes("Missing or insufficient permissions") ||
    errInfo.error.includes("permission_denied")
  ) {
    alert(
      `Firebase Permission Denied!\n\nYour Firebase Firestore rules are blocking access. Go to your Firebase Console -> Firestore Database -> Rules, and paste the contents of your local 'firestore.rules' file there.`
    );
  } else if (
    errInfo.error.includes("does not exist") ||
    errInfo.error.includes("not-found")
  ) {
    alert(
      `Firebase Database Not Found!\n\nYou haven't created a Firestore Database in your Firebase project yet.\n\nPlease go to Firebase Console -> Firestore Database, and click "Create Database". Start it in "Test mode" or "Production mode" (it doesn't matter since we'll overwrite the rules later). Then wait a few minutes and refresh this page.`
    );
  } else {
    alert(`Firestore Error (${operationType}): ` + errInfo.error);
  }
  throw new Error(JSON.stringify(errInfo));
}
window.handleFirestoreError = handleFirestoreError;

export {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  collectionGroup
};
