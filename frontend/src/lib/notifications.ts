import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { learnerService } from "../services/learnerService";

// TODO: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestNotificationPermission = async () => {
  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn("Notifications: Skipping registration because placeholder keys are used.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Adding a timeout safety for token retrieval
      const tokenPromise = getToken(messaging, { 
        vapidKey: "YOUR_VAPID_KEY"
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
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("Foreground Message:", payload);
      resolve(payload);
    });
  });
