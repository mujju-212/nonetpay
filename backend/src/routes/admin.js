import express from "express";
import { getDB } from "../db/index.js";
import { buildDashboardHTML } from "../utils/dashboard.js";

const router = express.Router();

router.get("/api/admin/users", async (req, res) => {
	try {
		const db = getDB();
		const users = await db.collection("users").find({}, { projection: { passwordHash: 0 } }).toArray();
		return res.json({
			total: users.length,
			users: users.map((u) => ({
				userId: u.userId,
				phone: u.phone,
				name: u.name,
				balance: u.balance || 0,
				createdAt: u.createdAt,
				hasPublicKey: !!u.publicKeyHex,
			})),
		});
	} catch (error) {
		console.error("Admin users error:", error);
		return res.status(500).json({ error: "Database error" });
	}
});

router.get("/api/admin/merchants", async (req, res) => {
	try {
		const db = getDB();
		const merchants = await db.collection("merchants").find({}, { projection: { passwordHash: 0 } }).toArray();
		return res.json({
			total: merchants.length,
			merchants: merchants.map((m) => ({
				merchantId: m.merchantId,
				phone: m.phone,
				businessName: m.businessName,
				address: m.address,
				isVerified: m.isVerified || false,
				createdAt: m.createdAt,
			})),
		});
	} catch (error) {
		console.error("Admin merchants error:", error);
		return res.status(500).json({ error: "Database error" });
	}
});

router.get("/api/health", async (req, res) => {
	try {
		const db = getDB();
		await db.admin().ping();
		return res.json({
			status: "healthy",
			message: "NONETPAY Backend API",
			database: "connected",
			uptime: Math.floor(process.uptime()),
			timestamp: new Date().toISOString(),
			memory: {
				used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
				total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
			},
		});
	} catch (error) {
		console.error("Health check failed:", error);
		return res.status(503).json({
			status: "unhealthy",
			message: "NONETPAY Backend API",
			database: "disconnected",
			uptime: Math.floor(process.uptime()),
			timestamp: new Date().toISOString(),
			error: error.message,
		});
	}
});

router.get("/api/status", (req, res) => {
	return res.json({
		api: "NONETPAY Backend",
		version: "1.0.0",
		status: "online",
		timestamp: new Date().toISOString(),
		endpoints: [
			"GET /api/health",
			"GET /api/status",
			"POST /api/auth/register",
			"POST /api/auth/login",
			"POST /api/auth/merchant/register",
			"POST /api/auth/merchant/login",
			"POST /api/vouchers/sync",
			"GET /",
		],
	});
});

router.get("/", async (req, res) => {
	try {
		const db = getDB();
		const vouchers = await db.collection("vouchers").find().toArray();
		const usersCount = await db.collection("users").countDocuments();
		const totalAmount = vouchers.reduce((sum, v) => sum + (v.amount || 0), 0);
		const syncedCount = vouchers.filter((v) => v.status === "synced").length;
		const offlineCount = vouchers.filter((v) => v.status === "offline").length;

		const html = buildDashboardHTML(
			{
				totalVouchers: vouchers.length,
				syncedCount,
				offlineCount,
				totalAmount,
				registeredUsers: usersCount,
				lastUpdated: new Date().toISOString(),
			},
			vouchers
		);

		return res.send(html);
	} catch (error) {
		console.error("Dashboard error:", error);
		return res.status(500).send("Database error");
	}
});

export default router;
