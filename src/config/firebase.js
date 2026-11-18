import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  deleteUser,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  collectionGroup,
} from "firebase/firestore";
import appletConfig from "../../firebase-applet-config.json";

export const firebaseConfig = {
  projectId: appletConfig.projectId || "gen-lang-client-0148267833",
  appId: "1:496148193699:web:4f33725a5d3176e80dba16",
  apiKey: "AIzaSyAzHmpajxhbE4WVAaHbngZzcquhYfJMGrY",
  authDomain: "gen-lang-client-0148267833.firebaseapp.com",
  firestoreDatabaseId:
    appletConfig.databaseId || "ai-studio-e20fe8a3-51eb-4c70-b5e2-be2681714950",
  storageBucket: "gen-lang-client-0148267833.firebasestorage.app",
  messagingSenderId: "496148193699",
  measurementId: "",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firebaseConfig.firestoreDatabaseId,
  );
} catch (err) {
  console.warn("Persistent Firestore cache fallback:", err?.message || err);
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = firestoreInstance;

// Verify Firestore connection on boot against a non-PII healthcheck doc
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

export function handleFirestoreError(
  error,
  operationType,
  path,
  options = {},
) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo = {
    error: errMsg,
    authInfo: {
      signedIn: Boolean(auth.currentUser),
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  if (
    errMsg.includes("Missing or insufficient permissions") ||
    errMsg.includes("permission_denied") ||
    errMsg.includes("permission-denied")
  ) {
    if (window.showToast) {
      window.showToast(
        "Permission denied for this action. Please sign in again or check Firestore rules.",
        "error",
      );
    }
  } else if (errMsg.includes("does not exist") || errMsg.includes("not-found")) {
    if (window.showToast) {
      window.showToast("Requested record or database not found.", "error");
    }
  } else if (window.showToast) {
    window.showToast(`Sync error (${operationType}): ${errMsg}`, "error");
  }
  if (options?.rethrow) {
    throw new Error(JSON.stringify(errInfo));
  }
}

export {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  deleteUser,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
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
