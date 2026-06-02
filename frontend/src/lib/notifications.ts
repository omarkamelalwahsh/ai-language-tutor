import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { learnerService } from "../services/learnerService";

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID,
};

const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY;
const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId && vapidKey);

let messaging;
if (hasFirebaseConfig) {
  const app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
} else {
  console.warn("Firebase notifications are disabled: missing VITE_FIREBASE_* or VITE_FIREBASE_VAPID_KEY values.");
}

export const requestNotificationPermission = async () => {
  if (!messaging) {
    console.warn("Notifications are disabled because Firebase is not configured.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const tokenPromise = getToken(messaging, {
        vapidKey,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("FCM Token timeout")), 5000)
      );

      const token = await Promise.race([tokenPromise, timeoutPromise]) as string;
      if (token) {
        console.log("FCM Token:", token);
        await learnerService.updateFcmToken(token);
      }
    }
  } catch (error) {
    console.warn("Notifications: Permission request or token retrieval failed.", error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve, reject) => {
    if (!messaging) {
      reject(new Error("Firebase messaging is not configured."));
      return;
    }
    onMessage(messaging, (payload) => {
      console.log("Foreground Message:", payload);
      resolve(payload);
    });
  });
