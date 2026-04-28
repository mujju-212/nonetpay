import express from "express";
import { getDB } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { verifyECDSA } from "../utils/crypto.js";
import { triggerMerchantPayout } from "./payments.js";

const router = express.Router();

router.get("/vouchers", async (req, res) => {
	try {
		const db = getDB();
		const vouchers = await db.collection("vouchers").find().toArray();
		return res.json({ totalVouchers: vouchers.length, vouchers });
	} catch (error) {
		console.error("Get vouchers error:", error);
		return res.status(500).json({ error: "Database error" });
	}
});

router.post("/vouchers/sync", async (req, res) => {
	const { merchantId, vouchers } = req.body || {};
	if (!merchantId || !Array.isArray(vouchers)) {
		return res.status(400).json({ error: "Invalid body" });
	}

	try {
		const db = getDB();
		const vouchersCollection = db.collection("vouchers");
		const usersCollection = db.collection("users");

		const syncedIds = [];
		const rejected = [];

		for (const v of vouchers) {
			if (!v || !v.voucherId || !v.merchantId || typeof v.amount !== "number" || !v.signature) {
				rejected.push({ voucherId: v && v.voucherId, reason: "Invalid format" });
				continue;
			}

			if (v.merchantId !== merchantId) {
				rejected.push({ voucherId: v.voucherId, reason: "Wrong merchantId" });
				continue;
			}

			if (!v.issuedTo) {
				rejected.push({ voucherId: v.voucherId, reason: "Missing issuedTo" });
				continue;
			}

			if (v.expiresAt && new Date() > new Date(v.expiresAt)) {
				rejected.push({ voucherId: v.voucherId, reason: "Voucher expired" });
				continue;
			}

			let userPubHex = v.publicKeyHex;
			if (!userPubHex) {
				const user = await usersCollection.findOne({ userId: v.issuedTo });
				userPubHex = user && user.publicKeyHex;
			}
			if (!userPubHex) {
				rejected.push({ voucherId: v.voucherId, reason: "Missing public key" });
				continue;
			}

			const payload = {
				voucherId: v.voucherId,
				merchantId: v.merchantId,
				amount: v.amount,
				createdAt: v.createdAt,
				issuedTo: v.issuedTo,
			};

			const signatureOk = verifyECDSA(payload, v.signature, userPubHex);
			if (!signatureOk) {
				rejected.push({ voucherId: v.voucherId, reason: "Bad signature" });
				continue;
			}

			const existing = await vouchersCollection.findOne({ voucherId: v.voucherId });
			if (existing) {
				rejected.push({ voucherId: v.voucherId, reason: "Duplicate voucherId" });
				continue;
			}

			const payingUser = await usersCollection.findOne({ userId: v.issuedTo });
			const backendBalance = payingUser && typeof payingUser.balance === "number" ? payingUser.balance : 0;
			if (backendBalance < v.amount) {
				rejected.push({ voucherId: v.voucherId, reason: "Insufficient balance" });
				continue;
			}

			const newBalance = backendBalance - v.amount;
			await usersCollection.updateOne(
				{ userId: v.issuedTo },
				{
					$set: { balance: newBalance },
					$push: {
						balanceHistory: {
							type: "payment",
							amount: v.amount,
							timestamp: new Date().toISOString(),
							previousBalance: backendBalance,
							newBalance,
							merchantId,
							voucherId: v.voucherId,
						},
					},
				}
			);

			await vouchersCollection.insertOne({
				...payload,
				signature: v.signature,
				merchantId,
				merchantName: v.merchantName || null,
				expiresAt: v.expiresAt || null,
				status: "synced",
				syncedAt: new Date().toISOString(),
			});

			syncedIds.push(v.voucherId);

			// 💸 AUTO PAYOUT AGENT — fire and forget (non-blocking)
			// In test mode: Razorpay accepts call but no real money moves
			// In live mode: merchant's UPI receives money within seconds
			triggerMerchantPayout(merchantId, v.amount, v.voucherId)
				.then((result) => {
					if (result.success) {
						console.log(`💸 Auto-payout triggered: ₹${v.amount} → merchant ${merchantId}`);
					} else {
						console.log(`⚠️  Payout skipped for ${merchantId}: ${result.reason}`);
					}
				})
				.catch((err) => console.error("Payout agent error:", err));

		}

		const totalStored = await vouchersCollection.countDocuments();
		return res.json({ syncedIds, rejected, totalStored });
	} catch (error) {
		console.error("Sync vouchers error:", error);
		return res.status(500).json({ error: "Database error" });
	}
});

router.post("/vouchers/refund-expired", authMiddleware, async (req, res) => {
	try {
		const { voucherId, amount } = req.body || {};
		if (!voucherId || typeof amount !== "number" || amount <= 0) {
			return res.status(400).json({ error: "Invalid request body" });
		}

		const db = getDB();
		const vouchersCollection = db.collection("vouchers");
		const usersCollection = db.collection("users");

		const existing = await vouchersCollection.findOne({ voucherId });
		if (existing) {
			return res.json({ success: false, reason: "Voucher already redeemed" });
		}

		const user = await usersCollection.findOne({ userId: req.user.userId });
		if (!user) return res.status(404).json({ error: "User not found" });

		const history = Array.isArray(user.balanceHistory) ? user.balanceHistory : [];
		const alreadyRefunded = history.some((h) => h.voucherId === voucherId && h.type === "refund");
		if (alreadyRefunded) {
			return res.json({ success: true, balance: user.balance || 0, reason: "Already refunded" });
		}

		const previousBalance = user.balance || 0;
		const newBalance = previousBalance + amount;
		await usersCollection.updateOne(
			{ userId: req.user.userId },
			{
				$set: { balance: newBalance },
				$push: {
					balanceHistory: {
						type: "refund",
						amount,
						timestamp: new Date().toISOString(),
						previousBalance,
						newBalance,
						voucherId,
						reason: "voucher_expired",
					},
				},
			}
		);

		return res.json({ success: true, balance: newBalance, amount });
	} catch (error) {
		console.error("Refund expired voucher error:", error);
		return res.status(500).json({ error: "Failed to process refund" });
	}
});

export default router;
