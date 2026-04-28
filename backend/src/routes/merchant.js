import express from "express";
import { getDB } from "../db/index.js";
import { authMiddleware, comparePassword, hashPassword } from "../middleware/auth.js";

const router = express.Router();

router.get("/merchant/:id/summary", async (req, res) => {
	try {
		const db = getDB();
		const merchantId = req.params.id;
		const vouchers = await db.collection("vouchers").find({ merchantId }).toArray();
		const total = vouchers.reduce((sum, v) => sum + (v.amount || 0), 0);

		return res.json({ merchantId, totalRedeemedAmount: total, vouchersCount: vouchers.length });
	} catch (error) {
		console.error("Merchant summary error:", error);
		return res.status(500).json({ error: "Database error" });
	}
});

router.put("/merchant/profile", authMiddleware, async (req, res) => {
	try {
		const merchantId = req.user.merchantId || req.user.userId;
		const { name, shopName, businessName, address } = req.body || {};
		const displayName = name || businessName;

		if (!displayName || !String(displayName).trim()) {
			return res.status(400).json({ error: "Name is required" });
		}

		const db = getDB();
		const result = await db.collection("merchants").updateOne(
			{ merchantId },
			{
				$set: {
					name: String(displayName).trim(),
					businessName: String(displayName).trim(),
					shopName: String(shopName || displayName).trim(),
					address: String(address || "").trim(),
					updatedAt: new Date().toISOString(),
				},
			}
		);

		if (result.matchedCount === 0) {
			return res.status(404).json({ error: "Merchant not found" });
		}

		return res.json({
			success: true,
			message: "Profile updated successfully",
			name: String(displayName).trim(),
			shopName: String(shopName || displayName).trim(),
			address: String(address || "").trim(),
		});
	} catch (error) {
		console.error("Update merchant profile error:", error);
		return res.status(500).json({ error: "Failed to update profile" });
	}
});

router.put("/merchant/change-password", authMiddleware, async (req, res) => {
	try {
		const merchantId = req.user.merchantId || req.user.userId;
		const { oldPassword, newPassword } = req.body || {};
		if (!oldPassword || !newPassword) {
			return res.status(400).json({ error: "Old and new passwords are required" });
		}
		if (newPassword.length < 6) {
			return res.status(400).json({ error: "New password must be at least 6 characters" });
		}

		const db = getDB();
		const merchants = db.collection("merchants");
		const merchant = await merchants.findOne({ merchantId });
		if (!merchant) return res.status(404).json({ error: "Merchant not found" });

		const ok = await comparePassword(oldPassword, merchant.passwordHash);
		if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

		const newHash = await hashPassword(newPassword);
		await merchants.updateOne(
			{ merchantId },
			{ $set: { passwordHash: newHash, updatedAt: new Date().toISOString() } }
		);

		return res.json({ success: true, message: "Password changed successfully" });
	} catch (error) {
		console.error("Change merchant password error:", error);
		return res.status(500).json({ error: "Failed to change password" });
	}
});

router.put("/user/profile", authMiddleware, async (req, res) => {
	try {
		const { name } = req.body || {};
		if (!name || !String(name).trim()) {
			return res.status(400).json({ error: "Name is required" });
		}

		const db = getDB();
		const result = await db.collection("users").updateOne(
			{ userId: req.user.userId },
			{ $set: { name: String(name).trim(), updatedAt: new Date().toISOString() } }
		);

		if (result.matchedCount === 0) {
			return res.status(404).json({ error: "User not found" });
		}

		return res.json({ success: true, message: "Profile updated successfully", name: String(name).trim() });
	} catch (error) {
		console.error("Update user profile error:", error);
		return res.status(500).json({ error: "Failed to update profile" });
	}
});

router.put("/user/change-password", authMiddleware, async (req, res) => {
	try {
		const { oldPassword, newPassword } = req.body || {};
		if (!oldPassword || !newPassword) {
			return res.status(400).json({ error: "Old and new passwords are required" });
		}
		if (newPassword.length < 6) {
			return res.status(400).json({ error: "New password must be at least 6 characters" });
		}

		const db = getDB();
		const users = db.collection("users");
		const user = await users.findOne({ userId: req.user.userId });
		if (!user) return res.status(404).json({ error: "User not found" });

		const ok = await comparePassword(oldPassword, user.passwordHash);
		if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

		const newHash = await hashPassword(newPassword);
		await users.updateOne(
			{ userId: req.user.userId },
			{ $set: { passwordHash: newHash, updatedAt: new Date().toISOString() } }
		);

		return res.json({ success: true, message: "Password changed successfully" });
	} catch (error) {
		console.error("Change user password error:", error);
		return res.status(500).json({ error: "Failed to change password" });
	}
});

export default router;
