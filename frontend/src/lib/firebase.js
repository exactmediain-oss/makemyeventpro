import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const cfg = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const firebaseConfigured = () => !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);

export function getFirebaseAuth() {
  const app = getApps()[0] || initializeApp(cfg);
  return getAuth(app);
}

let verifier = null;
export async function firebaseSendOtp(phone, containerId = "recaptcha-container") {
  const auth = getFirebaseAuth();
  if (!verifier) verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  return signInWithPhoneNumber(auth, `+91${phone}`, verifier);
}
