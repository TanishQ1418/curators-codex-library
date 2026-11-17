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
  getDocFromServer,
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
  collectionGroup,
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

// Verify Firestore connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

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
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  if (
    errInfo.error.includes("Missing or insufficient permissions") ||
    errInfo.error.includes("permission_denied") ||
    errInfo.error.includes("permission-denied")
  ) {
    if (window.showToast) {
      window.showToast(
        "Permission denied for this action. Please sign in again or check Firestore rules.",
        "error",
      );
    }
  } else if (
    errInfo.error.includes("does not exist") ||
    errInfo.error.includes("not-found")
  ) {
    if (window.showToast) {
      window.showToast("Requested record or database not found.", "error");
    }
  } else if (window.showToast) {
    window.showToast(`Sync error (${operationType}): ${errInfo.error}`, "error");
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
  getDocFromServer,
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
  collectionGroup,
};
