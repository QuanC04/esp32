import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAbZoMnMew2umJOXMKVEEbVhirWHZWYhGk",
  authDomain: "esp32-f277f.firebaseapp.com",
  projectId: "esp32-f277f",
  storageBucket: "esp32-f277f.firebasestorage.app",
  messagingSenderId: "908329524388",
  appId: "1:908329524388:web:0c807e370a3f3a4c0ada31",
  measurementId: "G-J3GKX9EBCH",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// Authentication Helper Functions

/**
 * Handle User Registration
 * @param {string} email
 * @param {string} password
 */
export async function registerUser(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle User Login
 * @param {string} email
 * @param {string} password
 */
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle User Logout
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Monitor Auth State
 * @param {function} callback
 */
export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

export { app, auth, analytics };
