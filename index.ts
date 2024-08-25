import { config } from "https://deno.land/x/dotenv/mod.ts";
import webpush from "npm:web-push";
import { Application, Router } from "https://deno.land/x/oak/mod.ts";

const kv = await Deno.openKv();
const app = new Application();
const router = new Router();

const env = config();
const vapidKeys = {
  publicKey: env.VAPID_PUBLIC_KEY || 'DEFAULT_PUBLIC_KEY', 
  privateKey: env.VAPID_PRIVATE_KEY || 'DEFAULT_PRIVATE_KEY',
};

// Set VAPID details
webpush.setVapidDetails(
  'mailto:example@yourdomain.org',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Endpoint to generate VAPID keys
router.get("/generate", (ctx) => {
  console.log("Public Key:");
  console.log(vapidKeys.publicKey);
  console.log("Private Key:");
  console.log(vapidKeys.privateKey);

  ctx.response.body = {
    message: "VAPID keys set successfully.",
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey,
  };
});

// Endpoint to register a new subscription
router.post("/subscribe", async (ctx) => {
  const { subscription } = await ctx.request.body({ type: "json" }).value;
  const key = ["subscriptions", crypto.randomUUID()];
  await kv.set(key, subscription);

  ctx.response.body = { key, message: "Subscription registered successfully" };
});

// Endpoint to send a push notification
router.post("/notify", async (ctx) => {
  const { key, payload } = await ctx.request.body({ type: "json" }).value;
  const result = await kv.get(key);

  if (result.value) {
    try {
      await webpush.sendNotification(result.value, JSON.stringify(payload));
      ctx.response.status = 200;
      ctx.response.body = { success: true, message: "Notification sent" };
    } catch (error) {
      console.error("Push notification error:", error);
      ctx.response.status = 500;
      ctx.response.body = { success: false, error: "Failed to send notification" };
    }
  } else {
    ctx.response.status = 404;
    ctx.response.body = { success: false, error: "Subscription not found" };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

const port = 8000;
console.log(`Server running on http://localhost:${port}`);
await app.listen({ port });
