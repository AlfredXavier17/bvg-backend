// firebaseAdmin.js
import admin from "firebase-admin";

try {
  // If an app already exists, reuse it — never re-initialize.
  admin.app();
} catch (err) {
  // Only initialize if no app is active.
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
