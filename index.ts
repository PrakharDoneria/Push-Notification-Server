import { config } from "https://deno.land/x/dotenv/mod.ts";
import webpush from "npm:web-push";
import { Application, Router } from "https://deno.land/x/oak/mod.ts";

const kv = await Deno.openKv();
const app = new Application();
const router = new Router();

// Load environment variables
const env = config();
const vapidPublicKey = 'BMUuNRRgKRE-epkmw6ciJYH-VSkNKpu24HGGI1dvYmcsNnQD8etMDvD1hJ0nIfoFtrj74uEivAxajdFj7oeQ7A4';
const vapidPrivateKey = env.VAPID_PRIVATE_KEY || 'DEFAULT_PRIVATE_KEY';

// Validate and set VAPID keys
if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error("VAPID keys are not set. Please provide valid keys.");
}

webpush.setVapidDetails(
  'mailto: protecgamesofficial@gmail.com',
  vapidPublicKey,
  vapidPrivateKey
);

// Endpoint to generate VAPID keys
router.get("/generate", (ctx) => {
  console.log("Public Key:");
  console.log(vapidPublicKey);
  console.log("Private Key:");
  console.log(vapidPrivateKey);

  ctx.response.body = {
    message: "VAPID keys set successfully.",
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
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
