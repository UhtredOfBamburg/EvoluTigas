import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCsCJTVpGQx_iKaDWNiPIQNN8kkqjL-wqk",
  authDomain: "gen-lang-client-0326807319.firebaseapp.com",
  projectId: "gen-lang-client-0326807319",
  storageBucket: "gen-lang-client-0326807319.firebasestorage.app",
  messagingSenderId: "84867870491",
  appId: "1:84867870491:web:67c4a94fafb6d860d72dbe"
};

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  { ignoreUndefinedProperties: true },
  "ai-studio-evolutigas-2a6fcafb-73f2-4edd-8b98-829753e08af1"
);

export function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

