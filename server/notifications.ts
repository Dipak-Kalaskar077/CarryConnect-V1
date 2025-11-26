import admin from "firebase-admin";

export async function sendNotificationToUser(fcmToken: string, title: string, body: string) {
  if (!fcmToken) return;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
    });

    console.log("📨 Push notification sent to", fcmToken);
  } catch (err) {
    console.error("❌ Failed to send notification:", err);
  }
}
