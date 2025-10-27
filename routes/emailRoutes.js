// routes/emailRoutes.js
import express from "express";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const router = express.Router();

// === FIREBASE ADMIN SETUP ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    JSON.stringify(
      JSON.parse(
        await import(path.join(__dirname, "../firebase-key.json"), {
          assert: { type: "json" },
        })
      ).default
    )
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();

// === ZOHO SMTP SETUP ===
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_APP_PASS,
  },
});

// === ROUTE: SEND PASSWORD RESET ===
router.post("/send-reset", async (req, res) => {
  try {
    const { email } = req.body;
    const link = await auth.generatePasswordResetLink(email);
    await transporter.sendMail({
      from: `"BibleVerse Gate" <${process.env.ZOHO_EMAIL}>`,
      to: email,
      subject: "Reset your BibleVerse Gate password",
      html: `
        <h2>Password Reset</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${link}" 
          style="display:inline-block;padding:10px 20px;background:#6a5acd;color:#fff;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
        <p>If you didn’t request this, you can safely ignore it.</p>
      `,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Error sending reset email:", err);
    res.status(500).json({ error: err.message });
  }
});

// === ROUTE: SEND VERIFICATION EMAIL ===
router.post("/send-verification", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await auth.getUserByEmail(email);
    const link = await auth.generateEmailVerificationLink(email);
    await transporter.sendMail({
      from: `"BibleVerse Gate" <${process.env.ZOHO_EMAIL}>`,
      to: email,
      subject: "Verify your BibleVerse Gate email",
      html: `
        <h2>Verify your email</h2>
        <p>Click the button below to confirm your account:</p>
        <a href="${link}" 
          style="display:inline-block;padding:10px 20px;background:#228b22;color:#fff;text-decoration:none;border-radius:6px;">
          Verify Email
        </a>
        <p>If you didn’t sign up, please ignore this message.</p>
      `,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Error sending verification email:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
