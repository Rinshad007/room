import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDH9vPPyuogloZkKvfmvPtQphKV6sB54I8",
  authDomain: "buddybuddy-23085.firebaseapp.com",
  databaseURL: "https://buddybuddy-23085-default-rtdb.firebaseio.com",
  projectId: "buddybuddy-23085",
  storageBucket: "buddybuddy-23085.firebasestorage.app",
  messagingSenderId: "115570661972",
  appId: "1:115570661972:web:caf93395e3b72d300dabc1",
  measurementId: "G-HH1KRXK0KH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
