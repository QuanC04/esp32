import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
    // Save userId for push notification registration
    sessionStorage.setItem("userId", userCredential.user.uid);
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
    // Save userId for push notification registration
    sessionStorage.setItem("userId", userCredential.user.uid);
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
