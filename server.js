const express = require("express");
const Stripe = require("stripe");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Middleware
app.use(cors());

// ✅ Use express.json() only for normal routes, not webhooks
app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Simple test route
app.get("/", (req, res) => {
  res.send("BibleVerse Gate backend is running ✅");
});

// Webhook route (must use raw body)
app.post("/webhook", bodyParser.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.WEBHOOK_SECRET);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle relevant events
  switch (event.type) {
    case "checkout.session.completed":
      console.log("✅ Payment successful:", event.data.object);
      break;
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

// Start server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
