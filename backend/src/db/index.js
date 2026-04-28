import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/offline-pay";
const dbName = process.env.MONGODB_DB_NAME || "offline_pay";

const client = new MongoClient(uri);
let db;

export async function connectDB() {
	try {
		console.log("Connecting to MongoDB...");
		await client.connect();
		db = client.db(dbName);
		console.log(`✅ Connected to MongoDB database: ${dbName}`);
		await createIndexesSafely();
	} catch (error) {
		console.error("❌ MongoDB connection error:", error);
		process.exit(1);
	}
}

async function createIndexesSafely() {
	const indexes = [
		{ col: "users",     spec: { userId: 1 },     opts: { unique: true } },
		{ col: "users",     spec: { phone: 1 },      opts: { unique: true, sparse: true } },
		{ col: "merchants", spec: { merchantId: 1 }, opts: { unique: true } },
		{ col: "merchants", spec: { phone: 1 },      opts: { unique: true, sparse: true } },
		{ col: "vouchers",  spec: { voucherId: 1 },  opts: { unique: true } },
		{ col: "vouchers",  spec: { issuedTo: 1 },   opts: {} },
		{ col: "vouchers",  spec: { merchantId: 1 }, opts: {} },
	];

	for (const { col, spec, opts } of indexes) {
		try {
			await db.collection(col).createIndex(spec, opts);
		} catch (err) {
			// Index conflict from existing data — log and continue, don't crash
			console.warn(`⚠️  Index warning on '${col}': ${err.message}`);
		}
	}
	console.log("✅ Database indexes ready");
}

export function getDB() {
	if (!db) throw new Error("Database not initialized. Call connectDB() first.");
	return db;
}

export async function closeDB() {
	await client.close();
}
