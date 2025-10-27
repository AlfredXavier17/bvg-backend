import express from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

// === FIREBASE SETUP ===
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const auth = admin.auth();

// === EXPRESS + STRIPE ===
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// === MIDDLEWARE ===
app.use(cors());

// Use express.json() only for normal routes (webhooks use raw)
app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") next();
  else express.json()(req, res, next);
});

// === TEST ROUTE ===
app.get("/", (req, res) => {
  res.send("BibleVerse Gate backend is running ✅");
});

// === STRIPE WEBHOOK ===
app.post("/webhook", bodyParser.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.WEBHOOK_SECRET);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // === HANDLE EVENTS ===
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email;
      const plan = session.metadata?.plan;

      console.log(`✅ Payment successful for ${customerEmail} (Plan: ${plan})`);

      if (customerEmail) {
        auth
          .getUserByEmail(customerEmail)
          .then((userRecord) => {
            // Upgrade to Pro if it’s a paid plan or test
            if (plan === "monthly" || plan === "yearly" || plan === "lifetime" || plan === "test") {
              return auth.setCustomUserClaims(userRecord.uid, { isPro: true });
            } else {
              console.log("Donation received, no Pro access added.");
              return null;
            }
          })
          .then(() => {
            if (plan === "donation")
              console.log(`💖 Donation from ${customerEmail}, thank you!`);
            else console.log(`⭐ ${customerEmail} upgraded to Pro`);
          })
          .catch((error) => console.error("Error updating user:", error.message));
      }
      break;
    }

    case "customer.subscription.updated":
      console.log("🔁 Subscription updated:", event.data.object);
      break;

    case "customer.subscription.deleted":
      console.log("❌ Subscription canceled:", event.data.object);
      break;

    default:
      console.log(`⚠️ Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// === CREATE CHECKOUT SESSION ===
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { email, plan } = req.body;
    if (!email || !plan) return res.status(400).json({ error: "Missing email or plan" });

    // Map plan names to Stripe price IDs
    const prices = {
      monthly: "price_1SMGLtJ6zNG9KpDm8EkUHEct",   // recurring
      yearly: "price_1SMY76J6zNG9KpDmr9c8L6sV",    // recurring
      lifetime: "price_1SMY8vJ6zNG9KpDmvE0ZMEfF",  // one-time
      donation: "price_1SMGLsJ6zNG9KpDmvUSdCf68",  // one-time
      test: "price_1SMaXWJ6zNG9KpDmJ1g2pALj",      // one-time test
    };

    const priceId = prices[plan];
    if (!priceId) return res.status(400).json({ error: "Invalid plan" });

    // Choose correct checkout mode
    const mode =
      plan === "lifetime" || plan === "donation" || plan === "test"
        ? "payment"
        : "subscription";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { plan },
      success_url: "https://your-frontend-url.com/dashboard?success=true",
      cancel_url: "https://your-frontend-url.com/dashboard?canceled=true",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating checkout session:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// === START SERVER ===
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
