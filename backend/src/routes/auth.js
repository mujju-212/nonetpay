import express from "express";
import { getDB } from "../db/index.js";
import {
	hashPassword,
	comparePassword,
	generateToken,
	authMiddleware,
} from "../middleware/auth.js";

const router = express.Router();

router.post("/auth/register", async (req, res) => {
	try {
		const { phone, password, name, publicKeyHex } = req.body || {};
		if (!phone || !password || !name) {
			return res.status(400).json({ error: "Phone, password, and name are required" });
		}
		if (password.length < 6) {
			return res.status(400).json({ error: "Password must be at least 6 characters" });
		}

		const db = getDB();
		const users = db.collection("users");
		const existing = await users.findOne({ phone });
		if (existing) {
			return res.status(400).json({ error: "User with this phone already exists" });
		}

		const passwordHash = await hashPassword(password);
		const userId = `user_${Date.now()}`;

		await users.insertOne({
			userId,
			phone,
			name,
			passwordHash,
			publicKeyHex: publicKeyHex || null,
			balance: 0,
			createdAt: new Date().toISOString(),
			role: "user",
		});

		const token = generateToken({ userId, phone, role: "user" });
		return res.json({
			success: true,
			token,
			user: { userId, phone, name, balance: 0, role: "user" },
		});
	} catch (error) {
		console.error("Register error:", error);
		return res.status(500).json({ error: "Registration failed" });
	}
});

router.post("/auth/login", async (req, res) => {
	try {
		const { phone, password } = req.body || {};
		if (!phone || !password) {
			return res.status(400).json({ error: "Phone and password are required" });
		}

		const db = getDB();
		const users = db.collection("users");
		const user = await users.findOne({ phone });
		if (!user) {
			return res.status(401).json({ error: "Invalid phone or password" });
		}

		const ok = await comparePassword(password, user.passwordHash);
		if (!ok) {
			return res.status(401).json({ error: "Invalid phone or password" });
		}

		const token = generateToken({ userId: user.userId, phone: user.phone, role: user.role || "user" });
		return res.json({
			success: true,
			token,
			user: {
				userId: user.userId,
				phone: user.phone,
				name: user.name,
				balance: user.balance || 0,
				role: user.role || "user",
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		return res.status(500).json({ error: "Login failed" });
	}
});

router.post("/auth/merchant/register", async (req, res) => {
	try {
		const { phone, password, businessName, address, upiId } = req.body || {};
		if (!phone || !password || !businessName) {
			return res.status(400).json({ error: "Phone, password, and business name are required" });
		}
		if (password.length < 6) {
			return res.status(400).json({ error: "Password must be at least 6 characters" });
		}

		const db = getDB();
		const merchants = db.collection("merchants");
		const existing = await merchants.findOne({ phone });
		if (existing) {
			return res.status(400).json({ error: "Merchant with this phone already exists" });
		}

		const passwordHash = await hashPassword(password);
		const merchantId = `M_${Date.now()}`;

		await merchants.insertOne({
			merchantId,
			phone,
			businessName,
			address: address || "",
			upiId: upiId || null,        // ← used by payout agent
			passwordHash,
			isVerified: false,
			createdAt: new Date().toISOString(),
			role: "merchant",
		});

		const token = generateToken({ merchantId, phone, role: "merchant" });
		return res.json({
			success: true,
			token,
			merchant: {
				merchantId,
				phone,
				businessName,
				isVerified: false,
				role: "merchant",
			},
		});
	} catch (error) {
		console.error("Merchant register error:", error);
		return res.status(500).json({ error: "Registration failed" });
	}
});

router.post("/auth/merchant/login", async (req, res) => {
	try {
		const { phone, password } = req.body || {};
		if (!phone || !password) {
			return res.status(400).json({ error: "Phone and password are required" });
		}

		const db = getDB();
		const merchants = db.collection("merchants");
		const merchant = await merchants.findOne({ phone });
		if (!merchant) {
			return res.status(401).json({ error: "Invalid phone or password" });
		}

		const ok = await comparePassword(password, merchant.passwordHash);
		if (!ok) {
			return res.status(401).json({ error: "Invalid phone or password" });
		}

		const token = generateToken({ merchantId: merchant.merchantId, phone: merchant.phone, role: "merchant" });
		return res.json({
			success: true,
			token,
			merchant: {
				merchantId: merchant.merchantId,
				phone: merchant.phone,
				businessName: merchant.businessName,
				isVerified: merchant.isVerified || false,
				role: "merchant",
			},
		});
	} catch (error) {
		console.error("Merchant login error:", error);
		return res.status(500).json({ error: "Login failed" });
	}
});

router.get("/auth/me", authMiddleware, async (req, res) => {
	try {
		const db = getDB();
		if (req.user.role === "merchant") {
			const merchant = await db.collection("merchants").findOne({ merchantId: req.user.merchantId });
			if (!merchant) return res.status(404).json({ error: "Merchant not found" });
			return res.json({
				merchantId: merchant.merchantId,
				phone: merchant.phone,
				businessName: merchant.businessName,
				isVerified: merchant.isVerified || false,
				role: "merchant",
			});
		}

		const user = await db.collection("users").findOne({ userId: req.user.userId });
		if (!user) return res.status(404).json({ error: "User not found" });
		return res.json({
			userId: user.userId,
			phone: user.phone,
			name: user.name,
			balance: user.balance || 0,
			role: "user",
		});
	} catch (error) {
		console.error("Get me error:", error);
		return res.status(500).json({ error: "Failed to get user info" });
	}
});

router.post("/auth/forgot-password", async (req, res) => {
	try {
		const { phone, newPassword } = req.body || {};
		if (!phone || !newPassword) {
			return res.status(400).json({ error: "Phone and new password are required" });
		}
		if (newPassword.length < 6) {
			return res.status(400).json({ error: "Password must be at least 6 characters" });
		}

		const db = getDB();
		const users = db.collection("users");
		const user = await users.findOne({ phone });
		if (!user) return res.status(404).json({ error: "No account found with this phone" });

		const passwordHash = await hashPassword(newPassword);
		await users.updateOne(
			{ phone },
			{ $set: { passwordHash, updatedAt: new Date().toISOString() } }
		);

		return res.json({ success: true, message: "Password reset successfully" });
	} catch (error) {
		console.error("Forgot password error:", error);
		return res.status(500).json({ error: "Failed to reset password" });
	}
});

router.post("/auth/merchant/forgot-password", async (req, res) => {
	try {
		const { phone, newPassword } = req.body || {};
		if (!phone || !newPassword) {
			return res.status(400).json({ error: "Phone and new password are required" });
		}
		if (newPassword.length < 6) {
			return res.status(400).json({ error: "Password must be at least 6 characters" });
		}

		const db = getDB();
		const merchants = db.collection("merchants");
		const merchant = await merchants.findOne({ phone });
		if (!merchant) return res.status(404).json({ error: "No merchant account found with this phone" });

		const passwordHash = await hashPassword(newPassword);
		await merchants.updateOne(
			{ phone },
			{ $set: { passwordHash, updatedAt: new Date().toISOString() } }
		);

		return res.json({ success: true, message: "Password reset successfully" });
	} catch (error) {
		console.error("Merchant forgot password error:", error);
		return res.status(500).json({ error: "Failed to reset password" });
	}
});

export default router;
