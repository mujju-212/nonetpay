export function buildDashboardHTML(stats = {}, vouchers = []) {
	const safeStats = {
		totalVouchers: stats.totalVouchers || 0,
		syncedCount: stats.syncedCount || 0,
		offlineCount: stats.offlineCount || 0,
		totalAmount: stats.totalAmount || 0,
		registeredUsers: stats.registeredUsers || 0,
		lastUpdated: stats.lastUpdated || new Date().toISOString(),
	};

	const rows = vouchers
		.map((v) => {
			const status = v.status || "offline";
			const when = v.syncedAt || v.createdAt || "-";
			return `
				<tr>
					<td>${v.voucherId || "-"}</td>
					<td>${v.merchantId || "-"}</td>
					<td>Rs ${Number(v.amount || 0).toFixed(2)}</td>
					<td>${v.issuedTo || "-"}</td>
					<td>${status}</td>
					<td>${when}</td>
				</tr>`;
		})
		.join("");

	return `
<!DOCTYPE html>
<html>
<head>
	<title>NONETPAY Backend Dashboard</title>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<style>
		body { font-family: Arial, sans-serif; background: #f5f7fb; margin: 0; padding: 24px; }
		.container { max-width: 1100px; margin: 0 auto; }
		.header { background: #1f2937; color: #fff; padding: 18px 20px; border-radius: 10px; }
		.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 16px 0; }
		.card { background: #fff; border-radius: 10px; padding: 16px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
		table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; }
		th, td { padding: 12px 14px; border-bottom: 1px solid #e5e7eb; text-align: left; }
		th { background: #111827; color: #fff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
		tr:last-child td { border-bottom: none; }
		.muted { color: #6b7280; font-size: 12px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>NONETPAY Backend</h1>
			<div class="muted">Last updated: ${safeStats.lastUpdated}</div>
		</div>

		<div class="stats">
			<div class="card"><strong>Total Vouchers</strong><div>${safeStats.totalVouchers}</div></div>
			<div class="card"><strong>Synced</strong><div>${safeStats.syncedCount}</div></div>
			<div class="card"><strong>Pending</strong><div>${safeStats.offlineCount}</div></div>
			<div class="card"><strong>Total Amount</strong><div>Rs ${Number(safeStats.totalAmount).toFixed(2)}</div></div>
			<div class="card"><strong>Registered Users</strong><div>${safeStats.registeredUsers}</div></div>
		</div>

		<div class="card">
			<h3>All Vouchers</h3>
			<table>
				<thead>
					<tr>
						<th>Voucher ID</th>
						<th>Merchant</th>
						<th>Amount</th>
						<th>User</th>
						<th>Status</th>
						<th>Date</th>
					</tr>
				</thead>
				<tbody>
					${rows || "<tr><td colspan=\"6\">No vouchers yet</td></tr>"}
				</tbody>
			</table>
		</div>
	</div>
	<script>
		setTimeout(() => location.reload(), 5000);
	</script>
</body>
</html>`;
}
