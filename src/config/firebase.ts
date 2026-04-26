import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAP35wVi1vmJNuLEDbdQc8h8qTdnVSxbtI",
  authDomain: "community-node-challenge.firebaseapp.com",
  projectId: "community-node-challenge",
  storageBucket: "community-node-challenge.firebasestorage.app",
  messagingSenderId: "240264067240",
  appId: "1:240264067240:web:10850a60ae3984660a6a9d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
