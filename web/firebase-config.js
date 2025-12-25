import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbZoMnMew2umJOXMKVEEbVhirWHZWYhGk",
  authDomain: "esp32-f277f.firebaseapp.com",
  projectId: "esp32-f277f",
  storageBucket: "esp32-f277f.firebasestorage.app",
  messagingSenderId: "908329524388",
  appId: "1:908329524388:web:0c807e370a3f3a4c0ada31",
  measurementId: "G-J3GKX9EBCH",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);

export { auth };
